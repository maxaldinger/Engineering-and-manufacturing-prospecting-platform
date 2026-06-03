import { stripHtml } from "@/lib/signal-sources/extract";
import type {
  ProductType,
  ProductTypeId,
  CompetitorProduct,
} from "@/types/product";
import { PRODUCT_TYPES, COMPETITORS, PORTFOLIO } from "./data";
import { TYPE_WEIGHTS } from "./weights";

// Re-export raw data + schema types so consumers import everything from
// "@/lib/catalog".
export { PRODUCT_TYPES, COMPETITORS, PORTFOLIO };
export type {
  ProductType,
  ProductTypeId,
  CompetitorProduct,
  PortfolioProduct,
} from "@/types/product";

// --- Derived name unions ----------------------------------------------------
// detectedSoftware names are constrained to catalog keys, never bare string.
export type CompetitorName = (typeof COMPETITORS)[number]["name"];
export type PortfolioName = (typeof PORTFOLIO)[number]["name"];
export type CatalogProductName = CompetitorName | PortfolioName;

// A product detected in a prospect's stack/text. name comes from the catalog;
// productTypes mirrors the matched product's curated types (multi-category).
export interface DetectedProduct {
  name: CatalogProductName;
  productTypes: ProductTypeId[];
  isCompetitor: boolean;
  version?: string;
}

// --- Indexes ----------------------------------------------------------------
export const ALL_PRODUCT_TYPES = PRODUCT_TYPES;

const productTypeById = {} as Record<ProductTypeId, ProductType>;
for (const t of PRODUCT_TYPES) productTypeById[t.id] = t;
export const PRODUCT_TYPE_BY_ID = productTypeById;

export function competitorsForType(id: ProductTypeId) {
  return COMPETITORS.filter((c) => c.productTypes.some((t) => t === id));
}

// --- Detection --------------------------------------------------------------
// Word-boundary keyword match, byte-identical to extract.ts detectCamMentions
// (proven by lib/catalog/detection.test.ts) so CAM detection cannot regress.
// stripHtml is reused from extract for the same parity reason.
function escapeForRegex(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

// One flat detectable list: competitors (isCompetitor true) + our portfolio
// (false). Product types come from each product's curated productTypes, NEVER
// inferred from the matched keyword — so an ambiguous keyword cannot fan out
// into multiple types. (Keyword uniqueness is enforced by the test suite.)
type Detectable = {
  name: CatalogProductName;
  productTypes: readonly ProductTypeId[];
  detectionKeywords: readonly string[];
  isCompetitor: boolean;
};

const DETECTABLES: Detectable[] = [
  ...COMPETITORS.map((c) => ({
    name: c.name,
    productTypes: c.productTypes,
    detectionKeywords: c.detectionKeywords,
    isCompetitor: true,
  })),
  ...PORTFOLIO.map((p) => ({
    name: p.name,
    productTypes: p.productTypes,
    detectionKeywords: p.detectionKeywords,
    isCompetitor: false,
  })),
];

export function detectProducts(text: string): DetectedProduct[] {
  if (!text) return [];
  const lower = stripHtml(text).toLowerCase();
  const found = new Map<string, DetectedProduct>();
  for (const d of DETECTABLES) {
    for (const kw of d.detectionKeywords) {
      const regex = new RegExp(
        `(?:^|[^a-z])${escapeForRegex(kw)}(?:[^a-z]|$)`,
        "i"
      );
      if (regex.test(lower)) {
        if (!found.has(d.name)) {
          found.set(d.name, {
            name: d.name,
            productTypes: [...d.productTypes],
            isCompetitor: d.isCompetitor,
          });
        }
        break;
      }
    }
  }
  return Array.from(found.values());
}

// Product types a text is relevant to even when no competitor is named, via
// each type's relevanceKeywords. Generalizes the old isCamRelevant.
export function detectRelevantTypes(text: string): ProductTypeId[] {
  if (!text) return [];
  const lower = stripHtml(text).toLowerCase();
  const out: ProductTypeId[] = [];
  for (const t of PRODUCT_TYPES) {
    const hit = t.relevanceKeywords.some((kw) =>
      new RegExp(`(?:^|[^a-z])${escapeForRegex(kw)}(?:[^a-z]|$)`, "i").test(lower)
    );
    if (hit) out.push(t.id);
  }
  return out;
}

// Single-pass classification for a signal source: the detected products plus
// the union of their product types and any relevance-keyword hits. This is the
// normalization entry point each source uses. productTypes [] = Unclassified
// (surfaced, never dropped).
export function classifyText(text: string): {
  detectedSoftware: DetectedProduct[];
  productTypes: ProductTypeId[];
} {
  const detectedSoftware = detectProducts(text);
  const set = new Set<ProductTypeId>();
  for (const d of detectedSoftware) for (const t of d.productTypes) set.add(t);
  for (const t of detectRelevantTypes(text)) set.add(t);
  return { detectedSoftware, productTypes: Array.from(set) };
}

// Convenience: just the product types implied by a text (detected + relevance).
export function productTypesForText(text: string): ProductTypeId[] {
  return classifyText(text).productTypes;
}

// Weighted relevance of a text for ZoomInfo company ranking. Each detected
// product contributes the weight of its highest-weighted product type, using
// the SAME TYPE_WEIGHTS as scoreSignal — so a CAM competitor (25) outranks a
// Simulation tool (15) for enrichment priority. CAM-only / empty order is
// preserved: CAM tools each add 25, so the key stays monotonic in CAM tool
// count (a 2-CAM company outranks a 1-CAM company, as before).
export function rankingScore(text: string): number {
  return detectProducts(text).reduce((sum, d) => {
    const weights = d.productTypes.map((t) => TYPE_WEIGHTS[t]);
    return sum + (weights.length ? Math.max(...weights) : 0);
  }, 0);
}

// Displacement fit for a detected competitor. Preserves the legacy
// getReplacementFor semantics: exact name match, then substring fallback.
// Viewed through the CompetitorProduct interface so `fit` reads as optional
// (the as-const union has members that omit it entirely).
export function getFitFor(name: string): CompetitorProduct["fit"] {
  const list = COMPETITORS as readonly CompetitorProduct[];
  const exact = list.find((c) => c.name === name);
  if (exact?.fit) return exact.fit;
  const sub = list.find(
    (c) => c.fit && name.toLowerCase().includes(c.name.toLowerCase())
  );
  return sub?.fit;
}

export interface PromptFit {
  competitor: string;
  replacement: string;
  secondary?: string;
  // EMPTY for draft competitors — the structural guard below withholds them.
  reasons: readonly string[];
  draft: boolean;
  // Product-type label(s) of the competitor, e.g. "Simulation" — used to frame
  // draft mappings as a category offering rather than a validated replacement.
  categoryLabel: string;
}

// Draft-aware fit for PROMPT injection. For a draft (unvalidated) competitor the
// specific differentiators are WITHHELD: only the neutral competitor ->
// replacement mapping is returned (reasons: []), so no fabricated competitive
// claim can ever reach a prompt for the model to assert. Non-draft (CAM)
// competitors return their real, assertable reasons.
export function fitForPrompt(name: string): PromptFit | null {
  const list = COMPETITORS as readonly CompetitorProduct[];
  const c =
    list.find((x) => x.name === name) ??
    list.find((x) => x.fit && name.toLowerCase().includes(x.name.toLowerCase()));
  if (!c?.fit) return null;
  return {
    competitor: c.name,
    replacement: c.fit.replacement,
    secondary: c.fit.secondary,
    reasons: c.draft ? [] : c.fit.reasons,
    draft: !!c.draft,
    categoryLabel: c.productTypes
      .map((t) => PRODUCT_TYPE_BY_ID[t]?.label ?? t)
      .join(" / "),
  };
}
