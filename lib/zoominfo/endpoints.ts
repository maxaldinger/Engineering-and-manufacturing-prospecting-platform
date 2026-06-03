// Typed wrappers over the four ZoomInfo endpoints we use, plus normalizers
// that flatten ZoomInfo's nested response envelopes into flat shapes the rest
// of the app can consume.
//
// Enrichment is resilient: we request an extended set of output fields first
// (including technologies, which not every account is entitled to) and, if
// ZoomInfo rejects the request, retry with a guaranteed-core field set. This
// means the integration keeps working across subscription tiers.

import { zoomInfoRequest } from "./client";
import type {
  CodeOrNamed,
  CompanyEnrichResponse,
  CompanySearchItem,
  CompanySearchRequest,
  CompanySearchResponse,
  ContactEnrichResponse,
  ContactSearchItem,
  ContactSearchRequest,
  ContactSearchResponse,
  EnrichResponse,
  NormalizedCompany,
  NormalizedContact,
  ZoomInfoCompany,
  ZoomInfoContact,
} from "./types";

// Enrich endpoints accept at most 25 records per call.
const ENRICH_BATCH = 25;

const COMPANY_CORE_FIELDS = [
  "id",
  "name",
  "website",
  "revenue",
  "employeeCount",
  "sicCodes",
  "naicsCodes",
  "primaryIndustry",
  "street",
  "city",
  "state",
  "zipCode",
  "country",
  "phone",
];
// Requires the technographics entitlement; dropped automatically on 4xx.
const COMPANY_EXTENDED_FIELDS = ["companyTechnologies"];

const CONTACT_CORE_FIELDS = [
  "id",
  "firstName",
  "lastName",
  "jobTitle",
  "managementLevel",
  "companyId",
];
const CONTACT_EXTENDED_FIELDS = [
  "email",
  "phone",
  "directPhoneDoNotCall",
  "mobilePhoneDoNotCall",
  "linkedInUrl",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function codeIds(arr?: CodeOrNamed[]): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => (typeof x === "string" ? x : String(x?.id ?? "")))
    .map((s) => s.trim())
    .filter(Boolean);
}

function codeLabels(arr?: CodeOrNamed[]): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => (typeof x === "string" ? x : (x?.name ?? "")))
    .map((s) => s.trim())
    .filter(Boolean);
}

// Unwrap ZoomInfo's { data: { result: [{ data: T | T[] }] } } envelope. The
// innermost `data` is sometimes a single object, sometimes an array.
function flattenEnrich<T>(resp: EnrichResponse<T> | undefined): T[] {
  const results = resp?.data?.result ?? [];
  const out: T[] = [];
  for (const r of results) {
    if (!r?.data) continue;
    if (Array.isArray(r.data)) out.push(...r.data);
    else out.push(r.data);
  }
  return out;
}

export function normalizeCompany(c: ZoomInfoCompany): NormalizedCompany {
  const technologies = Array.from(
    new Set([
      ...codeLabels(c.companyTechnologies),
      ...codeLabels(c.techStack),
      ...codeLabels(c.technologies),
    ])
  );
  const primary = Array.isArray(c.primaryIndustry)
    ? c.primaryIndustry[0]
    : c.primaryIndustry;
  return {
    id: String(c.id ?? ""),
    name: (c.name ?? "").trim(),
    website: typeof c.website === "string" ? c.website : undefined,
    revenue: typeof c.revenue === "number" ? c.revenue : undefined,
    employeeCount:
      typeof c.employeeCount === "number" ? c.employeeCount : undefined,
    industry:
      primary || codeLabels(c.naicsCodes)[0] || codeLabels(c.sicCodes)[0] || undefined,
    sicCodes: codeIds(c.sicCodes),
    naicsCodes: codeIds(c.naicsCodes),
    city: c.city,
    state: c.state,
    zipCode: c.zipCode,
    country: c.country,
    phone: c.phone,
    technologies,
  };
}

export function normalizeContact(c: ZoomInfoContact): NormalizedContact {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  const ml = Array.isArray(c.managementLevel)
    ? c.managementLevel[0]
    : c.managementLevel;
  const phone =
    c.directPhoneDoNotCall || c.phone || c.mobilePhoneDoNotCall || undefined;
  return {
    id: String(c.id ?? ""),
    name: name || "Unknown",
    firstName: c.firstName,
    lastName: c.lastName,
    title: c.jobTitle,
    managementLevel: ml,
    email: typeof c.email === "string" ? c.email : undefined,
    phone,
    linkedinUrl: typeof c.linkedInUrl === "string" ? c.linkedInUrl : undefined,
    companyId: c.companyId != null ? String(c.companyId) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

// POST /search/company → lightweight { id, name } previews. Enrich for detail.
export async function searchCompanies(
  req: CompanySearchRequest
): Promise<CompanySearchItem[]> {
  const resp = await zoomInfoRequest<CompanySearchResponse>("/search/company", {
    body: req,
  });
  return resp?.data ?? [];
}

// POST /enrich/company → full firmographics (+ technologies when entitled).
export async function enrichCompanies(
  ids: Array<string | number>
): Promise<NormalizedCompany[]> {
  const unique = Array.from(new Set(ids.map((i) => String(i)).filter(Boolean)));
  if (!unique.length) return [];

  const out: NormalizedCompany[] = [];
  for (let i = 0; i < unique.length; i += ENRICH_BATCH) {
    const batch = unique.slice(i, i + ENRICH_BATCH);
    const matchCompanyInput = batch.map((companyId) => ({ companyId }));
    const attempt = (outputFields: string[]) =>
      zoomInfoRequest<CompanyEnrichResponse>("/enrich/company", {
        body: { matchCompanyInput, outputFields },
      });
    let resp: CompanyEnrichResponse;
    try {
      resp = await attempt([...COMPANY_CORE_FIELDS, ...COMPANY_EXTENDED_FIELDS]);
    } catch {
      console.warn(
        "zoominfo: extended company fields rejected (subscription/entitlements); falling back to the core field set. Technology-stack detection (companyTechnologies) may be unavailable, reducing product detection from ZoomInfo."
      );
      resp = await attempt(COMPANY_CORE_FIELDS);
    }
    for (const c of flattenEnrich(resp)) {
      const n = normalizeCompany(c);
      if (n.id || n.name) out.push(n);
    }
  }
  return out;
}

// POST /search/contact → lightweight contact previews at a company.
export async function searchContacts(
  req: ContactSearchRequest
): Promise<ContactSearchItem[]> {
  const resp = await zoomInfoRequest<ContactSearchResponse>("/search/contact", {
    body: req,
  });
  return resp?.data ?? [];
}

// POST /enrich/contact → emails, phones, LinkedIn for the given person ids.
export async function enrichContacts(
  ids: Array<string | number>
): Promise<NormalizedContact[]> {
  const unique = Array.from(new Set(ids.map((i) => String(i)).filter(Boolean)));
  if (!unique.length) return [];

  const out: NormalizedContact[] = [];
  for (let i = 0; i < unique.length; i += ENRICH_BATCH) {
    const batch = unique.slice(i, i + ENRICH_BATCH);
    const matchPersonInput = batch.map((personId) => ({ personId }));
    const attempt = (outputFields: string[]) =>
      zoomInfoRequest<ContactEnrichResponse>("/enrich/contact", {
        body: { matchPersonInput, outputFields },
      });
    let resp: ContactEnrichResponse;
    try {
      resp = await attempt([...CONTACT_CORE_FIELDS, ...CONTACT_EXTENDED_FIELDS]);
    } catch {
      console.warn(
        "zoominfo: extended contact fields rejected; falling back to the core field set. Some contact channels (direct phone, LinkedIn) may be unavailable."
      );
      resp = await attempt(CONTACT_CORE_FIELDS);
    }
    for (const c of flattenEnrich(resp)) {
      const n = normalizeContact(c);
      if (n.id) out.push(n);
    }
  }
  return out;
}
