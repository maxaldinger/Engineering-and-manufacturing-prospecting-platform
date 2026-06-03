// Minimal state/province name and abbreviation lookup. USAspending and
// most federal sources expect 2-letter codes.

export type Country = "US" | "CA";

interface Region {
  code: string;
  name: string;
  country: Country;
}

const REGIONS: Region[] = [
  // US states
  { code: "AL", name: "Alabama", country: "US" },
  { code: "AK", name: "Alaska", country: "US" },
  { code: "AZ", name: "Arizona", country: "US" },
  { code: "AR", name: "Arkansas", country: "US" },
  { code: "CA", name: "California", country: "US" },
  { code: "CO", name: "Colorado", country: "US" },
  { code: "CT", name: "Connecticut", country: "US" },
  { code: "DE", name: "Delaware", country: "US" },
  { code: "FL", name: "Florida", country: "US" },
  { code: "GA", name: "Georgia", country: "US" },
  { code: "HI", name: "Hawaii", country: "US" },
  { code: "ID", name: "Idaho", country: "US" },
  { code: "IL", name: "Illinois", country: "US" },
  { code: "IN", name: "Indiana", country: "US" },
  { code: "IA", name: "Iowa", country: "US" },
  { code: "KS", name: "Kansas", country: "US" },
  { code: "KY", name: "Kentucky", country: "US" },
  { code: "LA", name: "Louisiana", country: "US" },
  { code: "ME", name: "Maine", country: "US" },
  { code: "MD", name: "Maryland", country: "US" },
  { code: "MA", name: "Massachusetts", country: "US" },
  { code: "MI", name: "Michigan", country: "US" },
  { code: "MN", name: "Minnesota", country: "US" },
  { code: "MS", name: "Mississippi", country: "US" },
  { code: "MO", name: "Missouri", country: "US" },
  { code: "MT", name: "Montana", country: "US" },
  { code: "NE", name: "Nebraska", country: "US" },
  { code: "NV", name: "Nevada", country: "US" },
  { code: "NH", name: "New Hampshire", country: "US" },
  { code: "NJ", name: "New Jersey", country: "US" },
  { code: "NM", name: "New Mexico", country: "US" },
  { code: "NY", name: "New York", country: "US" },
  { code: "NC", name: "North Carolina", country: "US" },
  { code: "ND", name: "North Dakota", country: "US" },
  { code: "OH", name: "Ohio", country: "US" },
  { code: "OK", name: "Oklahoma", country: "US" },
  { code: "OR", name: "Oregon", country: "US" },
  { code: "PA", name: "Pennsylvania", country: "US" },
  { code: "RI", name: "Rhode Island", country: "US" },
  { code: "SC", name: "South Carolina", country: "US" },
  { code: "SD", name: "South Dakota", country: "US" },
  { code: "TN", name: "Tennessee", country: "US" },
  { code: "TX", name: "Texas", country: "US" },
  { code: "UT", name: "Utah", country: "US" },
  { code: "VT", name: "Vermont", country: "US" },
  { code: "VA", name: "Virginia", country: "US" },
  { code: "WA", name: "Washington", country: "US" },
  { code: "WV", name: "West Virginia", country: "US" },
  { code: "WI", name: "Wisconsin", country: "US" },
  { code: "WY", name: "Wyoming", country: "US" },
  { code: "DC", name: "District of Columbia", country: "US" },
  // Canadian provinces and territories
  { code: "AB", name: "Alberta", country: "CA" },
  { code: "BC", name: "British Columbia", country: "CA" },
  { code: "MB", name: "Manitoba", country: "CA" },
  { code: "NB", name: "New Brunswick", country: "CA" },
  { code: "NL", name: "Newfoundland and Labrador", country: "CA" },
  { code: "NS", name: "Nova Scotia", country: "CA" },
  { code: "NT", name: "Northwest Territories", country: "CA" },
  { code: "NU", name: "Nunavut", country: "CA" },
  { code: "ON", name: "Ontario", country: "CA" },
  { code: "PE", name: "Prince Edward Island", country: "CA" },
  { code: "QC", name: "Quebec", country: "CA" },
  { code: "SK", name: "Saskatchewan", country: "CA" },
  { code: "YT", name: "Yukon", country: "CA" },
];

// Major manufacturing cities mapped back to their region. Some cities
// share names across regions (Richmond VA + Richmond BC, Vancouver WA +
// Vancouver BC, Portland OR + Portland ME). The list preserves all
// matches; lookup picks the entry whose region appears first in the
// comma-suffix of the rep's input, or otherwise the first match.
const CITY_TO_CODE: { city: string; code: string }[] = [
  // US Texas
  { city: "houston", code: "TX" }, { city: "dallas", code: "TX" },
  { city: "austin", code: "TX" }, { city: "san antonio", code: "TX" },
  { city: "fort worth", code: "TX" }, { city: "el paso", code: "TX" },
  { city: "midland", code: "TX" }, { city: "plano", code: "TX" },
  // California
  { city: "los angeles", code: "CA" }, { city: "san diego", code: "CA" },
  { city: "san francisco", code: "CA" }, { city: "san jose", code: "CA" },
  { city: "fremont", code: "CA" }, { city: "long beach", code: "CA" },
  { city: "sacramento", code: "CA" }, { city: "hawthorne", code: "CA" },
  { city: "santa ana", code: "CA" },
  // Washington (state)
  { city: "seattle", code: "WA" }, { city: "bellevue", code: "WA" },
  { city: "redmond", code: "WA" }, { city: "kent", code: "WA" },
  { city: "auburn", code: "WA" }, { city: "tacoma", code: "WA" },
  { city: "everett", code: "WA" }, { city: "spokane", code: "WA" },
  { city: "bremerton", code: "WA" },
  { city: "vancouver", code: "WA" }, // Also exists in BC, see below
  // Michigan
  { city: "detroit", code: "MI" }, { city: "grand rapids", code: "MI" },
  { city: "ann arbor", code: "MI" }, { city: "warren", code: "MI" },
  { city: "lansing", code: "MI" }, { city: "flint", code: "MI" },
  // Illinois
  { city: "chicago", code: "IL" }, { city: "peoria", code: "IL" },
  { city: "rockford", code: "IL" },
  // Massachusetts
  { city: "boston", code: "MA" }, { city: "cambridge", code: "MA" },
  { city: "worcester", code: "MA" }, { city: "springfield", code: "MA" },
  // New York
  { city: "new york", code: "NY" }, { city: "rochester", code: "NY" },
  { city: "buffalo", code: "NY" }, { city: "syracuse", code: "NY" },
  { city: "albany", code: "NY" },
  // Pennsylvania
  { city: "philadelphia", code: "PA" }, { city: "pittsburgh", code: "PA" },
  { city: "erie", code: "PA" }, { city: "allentown", code: "PA" },
  // Ohio
  { city: "cleveland", code: "OH" }, { city: "cincinnati", code: "OH" },
  { city: "columbus", code: "OH" }, { city: "dayton", code: "OH" },
  { city: "akron", code: "OH" }, { city: "toledo", code: "OH" },
  // Georgia
  { city: "atlanta", code: "GA" }, { city: "marietta", code: "GA" },
  { city: "savannah", code: "GA" },
  // Florida
  { city: "miami", code: "FL" }, { city: "tampa", code: "FL" },
  { city: "orlando", code: "FL" }, { city: "jacksonville", code: "FL" },
  // Arizona
  { city: "phoenix", code: "AZ" }, { city: "tucson", code: "AZ" },
  { city: "mesa", code: "AZ" }, { city: "chandler", code: "AZ" },
  // Indiana
  { city: "indianapolis", code: "IN" }, { city: "fort wayne", code: "IN" },
  { city: "elkhart", code: "IN" },
  // Minnesota
  { city: "minneapolis", code: "MN" }, { city: "saint paul", code: "MN" },
  { city: "st. paul", code: "MN" },
  // Colorado
  { city: "denver", code: "CO" }, { city: "boulder", code: "CO" },
  { city: "colorado springs", code: "CO" },
  // Kansas
  { city: "wichita", code: "KS" }, { city: "kansas city", code: "KS" },
  // North Carolina
  { city: "charlotte", code: "NC" }, { city: "raleigh", code: "NC" },
  { city: "greensboro", code: "NC" },
  // Tennessee
  { city: "nashville", code: "TN" }, { city: "memphis", code: "TN" },
  { city: "knoxville", code: "TN" }, { city: "chattanooga", code: "TN" },
  // Kentucky
  { city: "louisville", code: "KY" }, { city: "lexington", code: "KY" },
  // Wisconsin
  { city: "milwaukee", code: "WI" }, { city: "madison", code: "WI" },
  // Iowa
  { city: "des moines", code: "IA" }, { city: "cedar rapids", code: "IA" },
  { city: "davenport", code: "IA" },
  // Utah
  { city: "salt lake city", code: "UT" }, { city: "ogden", code: "UT" },
  // Oregon
  { city: "portland", code: "OR" }, { city: "hillsboro", code: "OR" },
  { city: "eugene", code: "OR" },
  // Louisiana
  { city: "new orleans", code: "LA" }, { city: "baton rouge", code: "LA" },
  // Virginia
  { city: "norfolk", code: "VA" }, { city: "richmond", code: "VA" },
  { city: "newport news", code: "VA" },
  // Maryland
  { city: "baltimore", code: "MD" }, { city: "annapolis", code: "MD" },
  // Alabama
  { city: "huntsville", code: "AL" }, { city: "birmingham", code: "AL" },
  { city: "mobile", code: "AL" },
  // New Mexico
  { city: "albuquerque", code: "NM" },
  // Missouri
  { city: "st. louis", code: "MO" }, { city: "saint louis", code: "MO" },
  // Oklahoma
  { city: "tulsa", code: "OK" }, { city: "oklahoma city", code: "OK" },
  // Rhode Island
  { city: "providence", code: "RI" },
  // New Hampshire
  { city: "manchester", code: "NH" }, { city: "nashua", code: "NH" },
  // New Jersey
  { city: "newark", code: "NJ" }, { city: "trenton", code: "NJ" },
  { city: "princeton", code: "NJ" },
  // Connecticut
  { city: "hartford", code: "CT" }, { city: "stratford", code: "CT" },
  { city: "groton", code: "CT" },
  // South Carolina
  { city: "charleston", code: "SC" }, { city: "greenville", code: "SC" },
  // Maine
  { city: "portland", code: "ME" }, // disambiguates from OR via "Portland, ME"
  { city: "bath", code: "ME" },

  // Canada Ontario
  { city: "toronto", code: "ON" }, { city: "ottawa", code: "ON" },
  { city: "mississauga", code: "ON" }, { city: "hamilton", code: "ON" },
  { city: "windsor", code: "ON" }, { city: "kitchener", code: "ON" },
  { city: "london", code: "ON" }, { city: "brampton", code: "ON" },
  // Quebec
  { city: "montreal", code: "QC" }, { city: "quebec city", code: "QC" },
  { city: "laval", code: "QC" }, { city: "mirabel", code: "QC" },
  // British Columbia
  { city: "vancouver", code: "BC" }, // disambiguates from WA via "Vancouver, BC"
  { city: "burnaby", code: "BC" }, { city: "richmond", code: "BC" }, // disambiguates from VA
  { city: "surrey", code: "BC" }, { city: "victoria", code: "BC" },
  // Alberta
  { city: "calgary", code: "AB" }, { city: "edmonton", code: "AB" },
  { city: "red deer", code: "AB" },
  // Manitoba
  { city: "winnipeg", code: "MB" },
  // Saskatchewan
  { city: "saskatoon", code: "SK" }, { city: "regina", code: "SK" },
  // Nova Scotia
  { city: "halifax", code: "NS" }, { city: "dartmouth", code: "NS" },
  // New Brunswick
  { city: "saint john", code: "NB" }, { city: "moncton", code: "NB" },
  { city: "fredericton", code: "NB" },
  // Newfoundland
  { city: "st. john's", code: "NL" }, { city: "saint john's", code: "NL" },
  // PEI / Territories
  { city: "charlottetown", code: "PE" },
  { city: "whitehorse", code: "YT" }, { city: "yellowknife", code: "NT" },
  { city: "iqaluit", code: "NU" },
];

export function detectRegion(query: string): Region | null {
  if (!query || !query.trim()) return null;
  const lower = query.toLowerCase().trim();

  // 2-letter code, possibly with comma e.g. "Vancouver, BC"
  const lastToken = lower.split(",").pop()?.trim() ?? lower;
  if (/^[a-z]{2}$/.test(lastToken)) {
    const match = REGIONS.find((r) => r.code.toLowerCase() === lastToken);
    if (match) return match;
  }

  // Disambiguate "City, ST" by checking the last segment first
  if (lower.includes(",")) {
    const parts = lower.split(",").map((p) => p.trim()).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const exactName = REGIONS.find((r) => r.name.toLowerCase() === parts[i]);
      if (exactName) return exactName;
      const exactCode = REGIONS.find((r) => r.code.toLowerCase() === parts[i]);
      if (exactCode) return exactCode;
    }
  }

  // Full name match
  const exactName = REGIONS.find((r) => r.name.toLowerCase() === lower);
  if (exactName) return exactName;

  // Substring match against name (e.g. "British" -> BC, "North Carolina" -> NC)
  const nameContains = REGIONS.find((r) => lower.includes(r.name.toLowerCase()));
  if (nameContains) return nameContains;

  // City lookup. Some cities exist in multiple regions (Richmond,
  // Vancouver, Portland). Return the first match; the comma-suffix
  // logic above handles disambiguation when the rep types "City, ST".
  for (const entry of CITY_TO_CODE) {
    if (lower.includes(entry.city)) {
      return REGIONS.find((r) => r.code === entry.code) ?? null;
    }
  }

  return null;
}

export function regionForCode(code: string): Region | null {
  return REGIONS.find((r) => r.code === code) ?? null;
}

export const ALL_REGIONS = REGIONS;
