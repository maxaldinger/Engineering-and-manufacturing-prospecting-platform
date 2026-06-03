import type { ProductTypeId } from "@/types/product";
import { TYPE_WEIGHTS } from "@/lib/catalog/weights";

// Word-boundary keyword matching. Surrounding a keyword with non-letter or
// string boundaries prevents false positives (e.g. "esprit" inside "espresso").
function escapeForRegex(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

// Strip HTML tags so detection runs on actual prose, not markup. Many
// upstream sources serve HTML (Greenhouse content, RSS content:encoded).
export function stripHtml(input: string): string {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// CAM-adjacent role and capability keywords that imply a CAM environment
// even without a specific brand match. Used to flag job postings as
// camRelevant so they stay prominent in the feed.
const CAM_ADJACENT_KEYWORDS = [
  "cam programmer",
  "cam engineer",
  "cnc programmer",
  "cnc machinist",
  "cnc programming",
  "5-axis programming",
  "5-axis machining",
  "5 axis",
  "multi-axis programming",
  "g-code",
  "g code",
  "post processor",
  "postprocessor",
  "toolpath",
  "tool path",
  "swiss-type",
  "mill-turn",
  "milling and turning",
  "feature recognition",
  "tolerance-based machining",
];

export function isCamRelevant(text: string): boolean {
  if (!text) return false;
  const lower = stripHtml(text).toLowerCase();
  return CAM_ADJACENT_KEYWORDS.some((kw) => {
    const re = new RegExp(`(?:^|[^a-z])${escapeForRegex(kw)}(?:[^a-z]|$)`, "i");
    return re.test(lower);
  });
}

// Manufacturing keywords that mark a federal contract as relevant when
// no CAM tool is named in the description. Industries that machine,
// fabricate, mill, turn, or finish parts.
const MFG_KEYWORDS = [
  "machining",
  "machined",
  "machine shop",
  "fabrication",
  "fabricated",
  "manufacturing",
  "precision",
  "cnc",
  "milling",
  "turning",
  "5-axis",
  "swiss",
  "weldment",
  "tolerance",
  "tooling",
  "fixture",
];

// 4-digit NAICS prefixes that map to manufacturing sectors a CAM rep
// cares about. Aligns with the user's spec (332/333/336 chapters plus
// 339 medical equipment).
const MFG_NAICS_4DIGIT = new Set([
  "3327", "3331", "3332", "3333", "3335", "3336", "3339",
  "3344", "3345",
  "3361", "3362", "3363", "3364", "3365", "3366",
  "3391",
]);

export function isManufacturingRelevant(opts: {
  naics?: string | null;
  description?: string | null;
}): boolean {
  const { naics, description } = opts;
  if (naics) {
    const prefix4 = naics.slice(0, 4);
    if (MFG_NAICS_4DIGIT.has(prefix4)) return true;
    if (naics.startsWith("33")) return true; // any 33xxxx = manufacturing
  }
  if (description) {
    const lower = stripHtml(description).toLowerCase();
    if (MFG_KEYWORDS.some((k) => lower.includes(k))) return true;
  }
  return false;
}

// Manufacturing NAICS prefixes that map to readable industry labels.
// Source: 2022 NAICS, https://www.census.gov/naics/
const NAICS_INDUSTRY: { prefix: string; label: string }[] = [
  { prefix: "3361", label: "Automotive" },
  { prefix: "3362", label: "Automotive" },
  { prefix: "3363", label: "Automotive" },
  { prefix: "33641", label: "Aerospace and Defense" },
  { prefix: "3364", label: "Aerospace and Defense" },
  { prefix: "3365", label: "Rail and Transit" },
  { prefix: "3366", label: "Marine" },
  { prefix: "33641", label: "Aerospace and Defense" },
  { prefix: "3344", label: "Electronics and Semiconductors" },
  { prefix: "3345", label: "Instruments and Optics" },
  { prefix: "3391", label: "Medical Devices" },
  { prefix: "33991", label: "Medical Devices" },
  { prefix: "3331", label: "Heavy Equipment" },
  { prefix: "33311", label: "Agricultural Equipment" },
  { prefix: "33312", label: "Construction Equipment" },
  { prefix: "33313", label: "Mining Equipment" },
  { prefix: "33314", label: "Oil and Gas Equipment" },
  { prefix: "3332", label: "Industrial Machinery" },
  { prefix: "3333", label: "Commercial Machinery" },
  { prefix: "3335", label: "Metalworking Machinery" },
  { prefix: "3336", label: "Engine and Turbine" },
  { prefix: "3327", label: "Job Shop and Machine Shop" },
  { prefix: "33271", label: "Job Shop and Machine Shop" },
  { prefix: "332", label: "Fabricated Metal Products" },
  { prefix: "333", label: "Machinery Manufacturing" },
  { prefix: "334", label: "Computer and Electronic" },
  { prefix: "336", label: "Transportation Equipment" },
];

export function industryFromNaics(naics: string | null | undefined): string {
  if (!naics) return "Manufacturing";
  // Match longest prefix first
  const sorted = [...NAICS_INDUSTRY].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const m of sorted) {
    if (naics.startsWith(m.prefix)) return m.label;
  }
  return "Manufacturing";
}

// Manufacturing NAICS codes for filtering at the source. USAspending
// only accepts code lengths of 2, 4, or 6. We use 4-digit codes that
// cover the manufacturing sub-sectors a CAM rep cares about.
export const MFG_NAICS_PREFIXES = [
  "3327", // Machine shops
  "3331", // Ag/construction/mining machinery
  "3332", // Industrial machinery
  "3333", // Commercial machinery
  "3335", // Metalworking machinery
  "3336", // Engine, turbine, power transmission
  "3339", // Other general purpose machinery
  "3344", // Semiconductors
  "3345", // Instruments and optics
  "3361", // Motor vehicle
  "3362", // Motor vehicle body and trailer
  "3363", // Motor vehicle parts
  "3364", // Aerospace product and parts
  "3365", // Railroad rolling stock
  "3366", // Ship and boat building
  "3391", // Medical equipment and supplies
];

// A signal description should never be empty. Returns a one-line plain
// description from raw text, trimmed and ellipsised.
export function summarize(text: string, max = 220): string {
  if (!text) return "";
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  const cut = cleaned.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 100 ? lastSpace : max)}...`;
}

// Estimate how interesting a contract or news item is for the rep on a
// 0 to 99 scale. Boosts on detected CAM mentions and dollar size.
export function scoreSignal(opts: {
  hasCam?: boolean;
  hasCadOnly?: boolean;
  productTypes?: ProductTypeId[];
  amount?: number;
  daysOld?: number;
}): number {
  let score = 50;
  // CAM/CAD axis — preserved exactly (TYPE_WEIGHTS.cam/.cad = 25/10).
  if (opts.hasCam) score += TYPE_WEIGHTS.cam;
  else if (opts.hasCadOnly) score += TYPE_WEIGHTS.cad;
  // Additive contribution from the other product types. cam/cad are excluded
  // here (scored by the branch above), so a CAM-only or CAD-only signal is
  // unchanged; non-CAM types contribute where they previously contributed zero.
  for (const t of opts.productTypes ?? []) {
    if (t === "cam" || t === "cad") continue;
    score += TYPE_WEIGHTS[t] ?? 0;
  }
  if (opts.amount && opts.amount > 1_000_000) score += 5;
  if (opts.amount && opts.amount > 10_000_000) score += 5;
  if (opts.daysOld !== undefined) {
    if (opts.daysOld <= 7) score += 8;
    else if (opts.daysOld <= 30) score += 4;
    else if (opts.daysOld > 365) score -= 10;
  }
  return Math.max(0, Math.min(98, Math.round(score)));
}

export function relativeAge(date: Date | null | undefined): string {
  if (!date) return "recent";
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}
