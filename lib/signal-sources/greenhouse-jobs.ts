// Real manufacturing and engineering job postings from public Greenhouse job
// boards. No auth required.
//
// Greenhouse exposes a public REST endpoint per company at
// https://boards-api.greenhouse.io/v1/boards/{token}/jobs.json that
// returns the company's full job board as JSON. We curate a list of
// manufacturers, aerospace primes, and digital manufacturing marketplaces that
// publish via Greenhouse, then keep the postings whose titles match the
// SELECTED product's discovery route (routeMatches) in the rep's region.

import type { Signal } from "@/types/signal";
import type { ProductTypeId } from "@/types/product";
import {
  isCamRelevant,
  relativeAge,
  scoreSignal,
  stripHtml,
  summarize,
} from "./extract";
import { regionForCode } from "./state-codes";
import { BRAND } from "@/lib/brand";
import { classifyText } from "@/lib/catalog";
import { routeMatches } from "@/lib/discovery";

interface GreenhouseLocation {
  name?: string;
}

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: GreenhouseLocation;
  company_name?: string;
  first_published?: string;
  updated_at?: string;
  content?: string;
  metadata?: { name?: string; value?: unknown }[] | null;
}

interface GreenhouseBoard {
  jobs: GreenhouseJob[];
}

// Curated company list. Each token is verified live against the
// Greenhouse public board API and the company hires production roles
// (CNC programmer, machinist, CAM engineer, manufacturing engineer,
// etc). Update by probing
// `https://boards-api.greenhouse.io/v1/boards/{token}/jobs.json`.
const COMPANIES: { token: string; name: string; sector: string }[] = [
  { token: "spacex", name: "SpaceX", sector: "Aerospace" },
  { token: "andurilindustries", name: "Anduril Industries", sector: "Defense" },
  { token: "relativity", name: "Relativity Space", sector: "Aerospace" },
  { token: "rocketlab", name: "Rocket Lab", sector: "Aerospace" },
  { token: "waymo", name: "Waymo", sector: "Robotics and Automotive" },
  { token: "vast", name: "Vast", sector: "Aerospace" },
  { token: "appliedintuition", name: "Applied Intuition", sector: "Robotics and Automotive" },
  { token: "nuro", name: "Nuro", sector: "Robotics and Automotive" },
  { token: "redwoodmaterials", name: "Redwood Materials", sector: "Automotive and Energy" },
  { token: "xometry", name: "Xometry", sector: "Digital Manufacturing" },
  { token: "fictiv", name: "Fictiv", sector: "Digital Manufacturing" },
  { token: "formlabs", name: "Formlabs", sector: "Additive Manufacturing" },
  { token: "markforged", name: "Markforged", sector: "Additive Manufacturing" },
  { token: "carbon", name: "Carbon", sector: "Additive Manufacturing" },
  { token: "epirus", name: "Epirus", sector: "Defense" },
  { token: "auterion", name: "Auterion", sector: "Defense" },
  { token: "ursamajor", name: "Ursa Major", sector: "Defense" },
  { token: "vannevarlabs", name: "Vannevar Labs", sector: "Defense" },
  { token: "skyryse", name: "Skyryse", sector: "Aerospace" },
  { token: "shield", name: "Shield AI", sector: "Defense" },
  { token: "apex", name: "Apex Space", sector: "Aerospace" },
  { token: "archer", name: "Archer Aviation", sector: "Aerospace" },
];

// Map a free-text location like "Hawthorne, CA" or "Bastrop, TX or Hawthorne, CA"
// to the set of state codes it covers. A job posted in multiple cities
// is matched against any of them.
const STATE_NAME_TO_CODE: Record<string, string> = {};
for (const r of [
  ["alabama", "AL"], ["alaska", "AK"], ["arizona", "AZ"], ["arkansas", "AR"],
  ["california", "CA"], ["colorado", "CO"], ["connecticut", "CT"],
  ["delaware", "DE"], ["florida", "FL"], ["georgia", "GA"], ["hawaii", "HI"],
  ["idaho", "ID"], ["illinois", "IL"], ["indiana", "IN"], ["iowa", "IA"],
  ["kansas", "KS"], ["kentucky", "KY"], ["louisiana", "LA"], ["maine", "ME"],
  ["maryland", "MD"], ["massachusetts", "MA"], ["michigan", "MI"],
  ["minnesota", "MN"], ["mississippi", "MS"], ["missouri", "MO"],
  ["montana", "MT"], ["nebraska", "NE"], ["nevada", "NV"],
  ["new hampshire", "NH"], ["new jersey", "NJ"], ["new mexico", "NM"],
  ["new york", "NY"], ["north carolina", "NC"], ["north dakota", "ND"],
  ["ohio", "OH"], ["oklahoma", "OK"], ["oregon", "OR"], ["pennsylvania", "PA"],
  ["rhode island", "RI"], ["south carolina", "SC"], ["south dakota", "SD"],
  ["tennessee", "TN"], ["texas", "TX"], ["utah", "UT"], ["vermont", "VT"],
  ["virginia", "VA"], ["washington", "WA"], ["west virginia", "WV"],
  ["wisconsin", "WI"], ["wyoming", "WY"], ["district of columbia", "DC"],
  ["alberta", "AB"], ["british columbia", "BC"], ["manitoba", "MB"],
  ["new brunswick", "NB"], ["newfoundland and labrador", "NL"],
  ["newfoundland", "NL"], ["nova scotia", "NS"], ["northwest territories", "NT"],
  ["nunavut", "NU"], ["ontario", "ON"], ["prince edward island", "PE"],
  ["quebec", "QC"], ["saskatchewan", "SK"], ["yukon", "YT"],
] as [string, string][]) {
  STATE_NAME_TO_CODE[r[0]] = r[1];
}

const ALL_STATE_CODES = new Set(Object.values(STATE_NAME_TO_CODE));

function locationStates(loc: string): Set<string> {
  const out = new Set<string>();
  if (!loc) return out;
  const lower = loc.toLowerCase();

  // Match "..., XX" trailing 2-letter codes.
  const codeMatches = lower.match(/(?:^|,\s*)([a-z]{2})(?=\s*(?:,|;|or|\/|\||$))/gi);
  if (codeMatches) {
    for (const m of codeMatches) {
      const code = m.replace(/[^a-z]/gi, "").toUpperCase();
      if (ALL_STATE_CODES.has(code)) out.add(code);
    }
  }

  // Match full state names.
  for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
    if (lower.includes(name)) out.add(code);
  }

  return out;
}

function jobToSignal(
  job: GreenhouseJob,
  company: { token: string; name: string; sector: string },
  stateCode: string
): Signal | null {
  const locName = job.location?.name ?? "";
  const cityFromLoc = locName.split(",")[0]?.trim() ?? "";
  const pubDate = job.first_published
    ? new Date(job.first_published)
    : job.updated_at
    ? new Date(job.updated_at)
    : null;
  const daysOld = pubDate
    ? Math.floor((Date.now() - pubDate.getTime()) / 86_400_000)
    : undefined;

  // stripHtml in extract.ts handles tag removal + entity decoding. We
  // call it here so detection runs against clean prose. Greenhouse
  // sometimes double-encodes content (entity-then-tag) so we run the
  // legacy decodeHtml first, then stripHtml is idempotent.
  const cleanContent = stripHtml(decodeHtml(job.content ?? ""));
  const text = `${job.title} ${cleanContent}`;
  const { detectedSoftware, productTypes } = classifyText(text);
  const camRelevant = isCamRelevant(text);
  const hasCam = detectedSoftware.some(
    (d) => !/solidworks|catia|inventor/i.test(d.name)
  );

  return {
    id: `gh-${company.token}-${job.id}`,
    company: company.name,
    industry: company.sector,
    city: cityFromLoc || stateCode,
    state: stateCode,
    distanceMiles: 0,
    employeeEstimate: undefined,
    revenueEstimate: undefined,
    detectedSoftware,
    // [] = Unclassified (no product type matched in the job text).
    productTypes,
    signalType: "Job Posting",
    title: job.title,
    description: summarize(
      cleanContent ||
        `${company.name} is hiring for ${job.title} in ${locName || stateCode}.`,
      260
    ),
    sourceLabel: `Greenhouse · ${company.name} careers`,
    sourceUrl: job.absolute_url,
    postedAgo: relativeAge(pubDate),
    signalStrength: scoreSignal({ hasCam, productTypes, daysOld }) + (camRelevant ? 5 : 0),
    contacts: [],
    camRelevant,
  };
}

function decodeHtml(html: string): string {
  if (!html) return "";
  // Greenhouse double-encodes content (entities first, then a second
  // entity pass on the wrapping tags). Decode entities first so the
  // tag stripper can see real angle brackets, then strip tags.
  let s = html;
  for (let i = 0; i < 2; i++) {
    s = s
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");
  }
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchBoard(token: string): Promise<GreenhouseJob[]> {
  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${token}/jobs.json?content=true`,
      {
        headers: { "User-Agent": BRAND.userAgent },
        next: { revalidate: 1800 }, // 30 minutes
      }
    );
    if (!res.ok) {
      console.warn(
        `greenhouse-jobs: board "${token}" returned ${res.status}; skipping this board (its jobs will be missing from the feed).`
      );
      return [];
    }
    const data = (await res.json()) as GreenhouseBoard;
    return data.jobs ?? [];
  } catch (err) {
    console.warn(
      `greenhouse-jobs: board "${token}" fetch failed (${
        err instanceof Error ? err.message : String(err)
      }); skipping this board.`
    );
    return [];
  }
}

// Route-scoped: a posting is kept only if its title matches the selected
// product's route (roles + software + keywords). The curated company list is
// manufacturing-centric, so it carries CAM richly and engineering-heavy routes
// (Simulation, Electrical, Additive) more thinly — Adzuna carries the rest.
export async function fetchGreenhouseJobs(
  stateCode: string,
  product: ProductTypeId
): Promise<Signal[]> {
  if (!stateCode) return [];
  const region = regionForCode(stateCode);
  if (!region) return [];

  const all = await Promise.all(COMPANIES.map((c) => fetchBoard(c.token)));
  const out: Signal[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < COMPANIES.length; i++) {
    const company = COMPANIES[i];
    for (const job of all[i]) {
      if (!routeMatches(job.title, product)) continue;
      const states = locationStates(job.location?.name ?? "");
      if (!states.has(stateCode)) continue;
      const sig = jobToSignal(job, company, stateCode);
      if (!sig) continue;
      if (seen.has(sig.id)) continue;
      seen.add(sig.id);
      out.push(sig);
    }
  }

  // Cap to keep the feed digestible. Highest signal strength first.
  out.sort((a, b) => b.signalStrength - a.signalStrength);
  return out.slice(0, 20);
}
