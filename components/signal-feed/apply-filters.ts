import type { Signal } from "@/types/signal";
import type { ProductTypeId } from "@/types/product";

export interface SignalFilters {
  // Signal types kept (Job Posting / News / Gov Contract / Tech Adoption).
  signalTypes: Set<string>;
  // Selected product types. EMPTY = no constraint (show all classified).
  productTypes: Set<ProductTypeId>;
  // Whether Unclassified (productTypes: []) signals are shown. Independent of
  // productTypes — this is the never-hide-data guarantee.
  showUnclassified: boolean;
  // Effective (already resolved) set of competitor names kept by the secondary
  // software filter.
  software: Set<string>;
}

// Pure, deterministic feed filter. The three stages and their ordering are the
// contract that the unit tests pin (see apply-filters.test.ts) — in particular
// the Unclassified short-circuit MUST run before the product-type check so an
// Unclassified signal can never be dropped by narrowing the product-type chips.
export function applyFilters(signals: Signal[], f: SignalFilters): Signal[] {
  const typeActive = (t: ProductTypeId) =>
    f.productTypes.size === 0 || f.productTypes.has(t);

  return signals.filter((s) => {
    // 1. Signal type.
    if (!f.signalTypes.has(s.signalType)) return false;

    // 2. Product type / Unclassified. Unclassified is decided FIRST and only by
    //    showUnclassified — never by the product-type selection.
    if (s.productTypes.length === 0) return f.showUnclassified;
    if (f.productTypes.size > 0 && !s.productTypes.some((t) => f.productTypes.has(t))) {
      return false;
    }

    // 3. Secondary software filter — only constrains signals that name a
    //    competitor in an in-scope product type; everything else passes.
    const inScope = s.detectedSoftware.filter(
      (d) => d.isCompetitor && d.productTypes.some(typeActive)
    );
    if (inScope.length > 0 && !inScope.some((d) => f.software.has(d.name))) {
      return false;
    }
    return true;
  });
}
