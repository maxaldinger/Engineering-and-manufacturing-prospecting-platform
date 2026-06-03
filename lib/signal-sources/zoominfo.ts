// ZoomInfo as a Territory Signal Feed source.
//
// This is the one source that can do what no free feed can: discover real
// manufacturers in a rep's territory, report each company's firmographics and
// installed technology stack (so we can flag CAM/CAD displacement targets),
// and attach real decision-maker contacts with verified emails and phones.
//
// Flow per territory pull:
//   1. /search/company   -> manufacturers in the state (SIC-filtered)
//   2. /enrich/company    -> revenue, headcount, industry, tech stack
//   3. /search/contact    -> decision makers at the top companies
//   4. /enrich/contact     -> their emails, direct phones, LinkedIn
//   5. map -> Signal[]      (signalType "Tech Adoption", with real contacts)
//
// Cost control: ZoomInfo bills per enriched record, so company and contact
// fan-out are capped and tunable via env (see CONFIG below). Contact
// enrichment can be turned off entirely with ZOOMINFO_FETCH_CONTACTS=false.

import type { Contact } from "@/types/contact";
import type { Signal } from "@/types/signal";
import {
  detectCamMentions,
  industryFromNaics,
  isCamRelevant,
  scoreSignal,
  summarize,
} from "./extract";
import { regionForCode } from "./state-codes";
import { productTypesForText } from "@/lib/catalog";
import {
  enrichCompanies,
  enrichContacts,
  searchCompanies,
  searchContacts,
} from "../zoominfo/endpoints";
import type {
  CompanySearchItem,
  CompanySearchRequest,
  ContactSearchItem,
  NormalizedCompany,
  NormalizedContact,
} from "../zoominfo/types";

export { isZoomInfoConfigured } from "../zoominfo/client";

// ---------------------------------------------------------------------------
// Config (env-tunable so HRS can dial targeting + spend without code changes)
// ---------------------------------------------------------------------------

function envInt(name: string, def: number): number {
  const v = process.env[name];
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : def;
}

function envList(name: string): string[] | null {
  const v = process.env[name];
  if (!v) return null;
  const out = v.split(",").map((s) => s.trim()).filter(Boolean);
  return out.length ? out : null;
}

function envBool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v == null || v === "") return def;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

const CONFIG = {
  // How many companies to pull + enrich per territory (1 enrich batch = 25).
  maxCompanies: () => Math.min(25, envInt("ZOOMINFO_MAX_COMPANIES", 25)),
  // Whether to spend credits enriching contacts at all.
  fetchContacts: () => envBool("ZOOMINFO_FETCH_CONTACTS", true),
  // Top N companies (by fit) that get contact enrichment.
  contactCompanies: () => envInt("ZOOMINFO_CONTACT_COMPANIES", 8),
  // Contacts enriched per company.
  contactsPerCompany: () => envInt("ZOOMINFO_CONTACTS_PER_COMPANY", 5),
  // Skip very small shops. 0 = no floor.
  minEmployees: () => envInt("ZOOMINFO_MIN_EMPLOYEES", 0),
  // Industry targeting. Default to a manufacturing SIC set tuned for CAMWorks
  // buyers (machine shops, fabricated metal, industrial machinery, transport
  // equipment, instruments, medical devices). Override with ZOOMINFO_SIC_CODES.
  sicCodes: () => envList("ZOOMINFO_SIC_CODES") ?? DEFAULT_MFG_SIC,
  naicsCodes: () => envList("ZOOMINFO_NAICS_CODES"),
};

// 4-digit manufacturing SIC codes a CAMWorks rep cares about.
const DEFAULT_MFG_SIC = [
  // Fabricated metal products
  "3440", "3442", "3443", "3444", "3448", "3451", "3452",
  "3460", "3462", "3463", "3465", "3469", "3490", "3492", "3494", "3498",
  // Industrial & commercial machinery
  "3510", "3530", "3540", "3541", "3542", "3544", "3545", "3550",
  "3559", "3560", "3561", "3562", "3564", "3566", "3568", "3569", "3590", "3599",
  // Electronic & electrical equipment
  "3670", "3672", "3674", "3678",
  // Transportation equipment
  "3720", "3724", "3728", "3760", "3790", "3799",
  // Measuring/analyzing instruments & medical devices
  "3820", "3821", "3823", "3825", "3827", "3829", "3841", "3845",
];

// CAD tools HRS resells. Detecting these is a warm signal (sell them CAM to
// add to their seat), not a competitive-CAM displacement target.
const CAD_OR_OWN = /solidworks|catia|inventor|camworks/i;

// ---------------------------------------------------------------------------
// Contact targeting
// ---------------------------------------------------------------------------

// ZoomInfo management levels for decision makers and influencers.
const TARGET_MANAGEMENT_LEVELS =
  "C Level Exec, VP Level Exec, Director, Manager";

// Prefer manufacturing/engineering ownership and leadership. Lower index =
// higher priority when we decide which contacts to spend enrich credits on.
const ROLE_PRIORITY: RegExp[] = [
  /owner|president|founder|principal/i,
  /manufactur|production|machin\b|cnc|\bcam\b|tooling|fabricat/i,
  /engineer/i,
  /vp|vice president|chief|\bceo\b|\bcoo\b/i,
  /director/i,
  /manager|operations|plant/i,
];

function contactRank(title?: string): number {
  if (!title) return ROLE_PRIORITY.length + 1;
  for (let i = 0; i < ROLE_PRIORITY.length; i++) {
    if (ROLE_PRIORITY[i].test(title)) return i;
  }
  return ROLE_PRIORITY.length;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function websiteUrl(site?: string): string | null {
  if (!site) return null;
  const t = site.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function sizeLabel(company: NormalizedCompany): string | null {
  if (company.employeeCount && company.employeeCount > 0) {
    return `${company.employeeCount.toLocaleString()} employees`;
  }
  if (company.revenue && company.revenue > 0) {
    const millions = company.revenue / 1000; // revenue is in thousands USD
    return `$${millions.toFixed(millions >= 10 ? 0 : 1)}M revenue`;
  }
  return null;
}

function toContacts(normalized: NormalizedContact[]): Contact[] {
  return normalized
    .filter((c) => c.name && c.name !== "Unknown")
    .map((c) => ({
      name: c.name,
      title: c.title || c.managementLevel || "Contact",
      email: c.email,
      phone: c.phone,
      linkedinUrl: c.linkedinUrl,
    }));
}

// Pull the best contacts for one company: search, rank by role, enrich the
// top few for emails/phones. Returns [] on any failure (never throws).
// Exported for the /api/zoominfo/contacts route.
export async function contactsForCompany(companyId: string): Promise<Contact[]> {
  try {
    const found = await searchContacts({
      companyId,
      managementLevel: TARGET_MANAGEMENT_LEVELS,
      rpp: 25,
      page: 1,
    });
    if (!found.length) return [];

    const ranked = [...found].sort(
      (a: ContactSearchItem, b: ContactSearchItem) =>
        contactRank(a.jobTitle) - contactRank(b.jobTitle)
    );
    const ids = ranked
      .slice(0, CONFIG.contactsPerCompany())
      .map((c) => c.id)
      .filter(Boolean);
    if (!ids.length) return [];

    const enriched = await enrichContacts(ids);
    return toContacts(enriched);
  } catch {
    return [];
  }
}

function companyToSignal(
  company: NormalizedCompany,
  contacts: Contact[],
  stateCode: string,
  regionName: string
): Signal | null {
  const name = company.name.trim();
  if (!name) return null;

  // Run CAM/CAD detection across the company's technology stack plus industry
  // text. ZoomInfo tech names like "Mastercam" / "SOLIDWORKS" match directly.
  const techText = company.technologies.join(", ");
  const detectText = `${techText} ${company.industry ?? ""}`;
  const detected = detectCamMentions(detectText);
  const camNames = detected.map((d) => d.name).filter((n) => !CAD_OR_OWN.test(n));
  const cadNames = detected.map((d) => d.name).filter((n) => CAD_OR_OWN.test(n));
  const hasCam = camNames.length > 0;
  const hasCad = cadNames.length > 0;

  const naics = company.naicsCodes[0] ?? "";
  const industry =
    industryFromNaics(naics) !== "Manufacturing"
      ? industryFromNaics(naics)
      : company.industry || "Manufacturing";

  const size = sizeLabel(company);

  // Title: lead with the most sales-relevant fact.
  let title: string;
  if (hasCam) title = `Runs ${camNames.join(", ")}`;
  else if (hasCad) title = `${cadNames.join(", ")} shop`;
  else title = `Active ${industry.toLowerCase()} manufacturer`;
  if (size) title += ` · ${size}`;

  // Description: a grounded one-liner from real firmographics.
  const descParts: string[] = [];
  descParts.push(
    `${name} is a ${industry.toLowerCase()} company in ${
      company.city || regionName
    }, ${company.state || stateCode}.`
  );
  if (size) descParts.push(`Size: ${size}.`);
  if (company.technologies.length) {
    descParts.push(`Detected stack: ${company.technologies.slice(0, 8).join(", ")}.`);
  }
  if (contacts.length) {
    descParts.push(
      `${contacts.length} decision-maker contact${
        contacts.length === 1 ? "" : "s"
      } available.`
    );
  }
  const description = summarize(descParts.join(" "), 260);

  // Score: CAM detection is the strongest displacement signal; CAD is warm;
  // size and available contacts add a little.
  let strength = scoreSignal({ hasCam, hasCadOnly: hasCad && !hasCam });
  if (company.employeeCount) {
    if (company.employeeCount >= 200) strength += 6;
    else if (company.employeeCount >= 50) strength += 3;
  }
  if (contacts.length) strength += 4;
  strength = Math.max(0, Math.min(98, strength));

  const detectedSoftware = detected.length
    ? detected.map((d) => ({ name: d.name }))
    : [{ name: "Unknown" }];

  const camRelevant =
    hasCam || hasCad || isCamRelevant(`${techText} ${company.industry ?? ""}`);
  // These companies came from a manufacturing SIC/NAICS search, so they are
  // manufacturing-relevant by construction. (isManufacturingRelevant is the
  // keyword/NAICS heuristic used for the free sources that lack that filter.)
  const manufacturingRelevant = true;

  const source = websiteUrl(company.website);

  return {
    id: `zi-${company.id || name}`,
    company: name,
    industry,
    city: company.city || regionName,
    state: company.state || stateCode,
    distanceMiles: 0,
    employeeEstimate: company.employeeCount
      ? `${company.employeeCount.toLocaleString()}`
      : undefined,
    revenueEstimate:
      company.revenue && company.revenue > 0
        ? `$${(company.revenue / 1000).toFixed(0)}M`
        : undefined,
    detectedSoftware,
    // [] = Unclassified (no product type in the tech stack / industry text).
    productTypes: productTypesForText(detectText),
    signalType: "Tech Adoption",
    title,
    description,
    sourceLabel: "ZoomInfo",
    sourceUrl:
      source ?? `https://www.google.com/search?q=${encodeURIComponent(name)}`,
    postedAgo: "current intel",
    signalStrength: strength,
    contacts,
    camRelevant,
    manufacturingRelevant,
  };
}

// Search manufacturers in the territory, preferring precise SIC targeting and
// degrading to an industry keyword if the account rejects SIC filtering.
async function searchTerritoryCompanies(
  stateCode: string,
  country: "US" | "CA"
): Promise<CompanySearchItem[]> {
  const base: CompanySearchRequest = {
    state: stateCode,
    country: country === "CA" ? "Canada" : "United States",
    rpp: CONFIG.maxCompanies(),
    page: 1,
    ...(CONFIG.minEmployees() > 0
      ? { employeeRangeMin: CONFIG.minEmployees() }
      : {}),
  };

  const naics = CONFIG.naicsCodes();
  const attempts: CompanySearchRequest[] = [];
  if (naics?.length) attempts.push({ ...base, naicsCodes: naics });
  attempts.push({ ...base, sicCodes: CONFIG.sicCodes() });
  attempts.push({ ...base, industryKeywords: "manufacturing" });

  for (const req of attempts) {
    try {
      const items = await searchCompanies(req);
      if (items.length) return items;
    } catch {
      // try the next, less specific filter
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Public entry point used by the aggregate pipeline + the /api/zoominfo routes
// ---------------------------------------------------------------------------

export async function fetchZoomInfoSignals(
  stateCode: string,
  country: "US" | "CA"
): Promise<Signal[]> {
  if (!stateCode) return [];
  const region = regionForCode(stateCode);
  const regionName = region?.name ?? stateCode;

  // 1. Discover manufacturers in the territory.
  const found = await searchTerritoryCompanies(stateCode, country);
  if (!found.length) return [];

  const ids = found
    .map((c) => c.id)
    .filter(Boolean)
    .slice(0, CONFIG.maxCompanies());

  // 2. Enrich them for firmographics + technology stack.
  const companies = await enrichCompanies(ids);
  if (!companies.length) return [];

  // Rank by fit so contact-enrichment credits go to the best accounts first:
  // CAM/CAD detection, then headcount.
  const ranked = [...companies].sort((a, b) => {
    const techA = detectCamMentions(a.technologies.join(", ")).length;
    const techB = detectCamMentions(b.technologies.join(", ")).length;
    if (techA !== techB) return techB - techA;
    return (b.employeeCount ?? 0) - (a.employeeCount ?? 0);
  });

  // 3 + 4. Enrich contacts for the top companies (bounded, parallel).
  const contactsById = new Map<string, Contact[]>();
  if (CONFIG.fetchContacts()) {
    const targets = ranked
      .slice(0, CONFIG.contactCompanies())
      .filter((c) => c.id);
    const results = await Promise.all(
      targets.map(async (c) => ({
        id: c.id,
        contacts: await contactsForCompany(c.id),
      }))
    );
    for (const r of results) contactsById.set(r.id, r.contacts);
  }

  // 5. Map to Signals.
  const signals: Signal[] = [];
  for (const company of ranked) {
    const contacts = contactsById.get(company.id) ?? [];
    const sig = companyToSignal(company, contacts, stateCode, regionName);
    if (sig) signals.push(sig);
  }

  signals.sort((a, b) => b.signalStrength - a.signalStrength);
  return signals;
}
