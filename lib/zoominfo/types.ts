// TypeScript shapes for the ZoomInfo Enterprise API request/response bodies
// we use. Response fields are intentionally loose (mostly optional) because
// which fields come back depends on the account's entitlements. Treat these
// as a guide, not a guarantee, and read defensively.
//
// Reference: https://docs.zoominfo.com/  (Search + Enrich endpoints)

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

// SIC / NAICS / industry entries can come back as plain strings or as
// { id, name } objects depending on the field and tier.
export type CodeOrNamed = string | { id?: string | number; name?: string };

// ---------------------------------------------------------------------------
// Search Company  (POST /search/company)
// ---------------------------------------------------------------------------

export interface CompanySearchRequest {
  companyName?: string;
  companyWebsite?: string;
  // Location
  state?: string; // 2-letter code or full name
  country?: string;
  zipCode?: string;
  metroRegion?: string;
  // Industry
  sicCodes?: string[];
  naicsCodes?: string[];
  industryKeywords?: string;
  // Firmographics
  revenueMin?: number; // thousands USD
  revenueMax?: number;
  employeeRangeMin?: number;
  employeeRangeMax?: number;
  // Paging / sorting
  rpp?: number; // records per page (ZoomInfo caps this, commonly 25)
  page?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CompanySearchItem {
  id: number | string;
  name?: string;
}

export interface CompanySearchResponse {
  maxResults?: number;
  totalResults?: number;
  currentPage?: number;
  data?: CompanySearchItem[];
}

// ---------------------------------------------------------------------------
// Enrich Company  (POST /enrich/company)
// ---------------------------------------------------------------------------

export interface CompanyEnrichRequest {
  matchCompanyInput: Array<{
    companyId?: number | string;
    companyName?: string;
    companyWebsite?: string;
  }>;
  outputFields: string[];
}

export interface ZoomInfoCompany {
  id?: number | string;
  name?: string;
  website?: string;
  revenue?: number; // thousands USD
  revenueRange?: string;
  employeeCount?: number;
  employeeRange?: string;
  sicCodes?: CodeOrNamed[];
  naicsCodes?: CodeOrNamed[];
  primaryIndustry?: string | string[];
  industries?: string[];
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  foundedYear?: number;
  ticker?: string;
  // Technologies the company is detected to use. Field name varies by tier;
  // we read several candidates in the mapper.
  companyTechnologies?: CodeOrNamed[];
  techStack?: CodeOrNamed[];
  technologies?: CodeOrNamed[];
  socialMediaUrls?: Array<{ type?: string; url?: string }>;
  // Allow unknown extra fields without fighting the type system.
  [key: string]: unknown;
}

// Enrich responses wrap results in { data: { result: [{ data: [...] }] } }.
// The innermost `data` is sometimes a single object rather than an array, so
// callers should normalize.
export interface EnrichResult<T> {
  input?: Record<string, unknown>;
  matchStatus?: string;
  data?: T | T[];
}

export interface EnrichResponse<T> {
  success?: boolean;
  data?: {
    outputFields?: string[][];
    result?: EnrichResult<T>[];
  };
}

export type CompanyEnrichResponse = EnrichResponse<ZoomInfoCompany>;

// ---------------------------------------------------------------------------
// Search Contact  (POST /search/contact)
// ---------------------------------------------------------------------------

export interface ContactSearchRequest {
  companyId?: number | string;
  companyName?: string;
  // Comma-separated ZoomInfo management levels, e.g.
  // "C Level Exec, VP Level Exec, Director, Manager".
  managementLevel?: string;
  jobTitle?: string; // keyword match
  department?: string;
  rpp?: number;
  page?: number;
}

export interface ContactSearchItem {
  id: number | string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  managementLevel?: string | string[];
  hasEmail?: boolean;
  hasDirect?: boolean;
  hasMobile?: boolean;
  companyId?: number | string;
  company?: { id?: number | string; name?: string };
}

export interface ContactSearchResponse {
  maxResults?: number;
  totalResults?: number;
  currentPage?: number;
  data?: ContactSearchItem[];
}

// ---------------------------------------------------------------------------
// Enrich Contact  (POST /enrich/contact)
// ---------------------------------------------------------------------------

export interface ContactEnrichRequest {
  matchPersonInput: Array<{
    personId?: number | string;
    firstName?: string;
    lastName?: string;
    companyId?: number | string;
    companyName?: string;
  }>;
  outputFields: string[];
}

export interface ZoomInfoContact {
  id?: number | string;
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
  managementLevel?: string | string[];
  email?: string;
  phone?: string;
  directPhoneDoNotCall?: string;
  mobilePhoneDoNotCall?: string;
  linkedInUrl?: string;
  companyId?: number | string;
  company?: { id?: number | string; name?: string };
  [key: string]: unknown;
}

export type ContactEnrichResponse = EnrichResponse<ZoomInfoContact>;

// ---------------------------------------------------------------------------
// Normalized shapes returned by our endpoint wrappers (lib/zoominfo/endpoints)
// ---------------------------------------------------------------------------

export interface NormalizedCompany {
  id: string;
  name: string;
  website?: string;
  revenue?: number; // thousands USD
  employeeCount?: number;
  industry?: string;
  sicCodes: string[];
  naicsCodes: string[];
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  phone?: string;
  technologies: string[];
}

export interface NormalizedContact {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  managementLevel?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  companyId?: string;
}
