import { describe, it, expect } from "vitest";
import { applyFilters, type SignalFilters } from "./apply-filters";
import { ALL_PRODUCT_TYPES, type DetectedProduct } from "@/lib/catalog";
import type { Signal } from "@/types/signal";
import type { ProductTypeId } from "@/types/product";

const ALL_IDS = ALL_PRODUCT_TYPES.map((t) => t.id);

// Minimal Signal factory — applyFilters only reads signalType, productTypes,
// and detectedSoftware, but we build a full Signal so the types are honest.
function sig(over: {
  id: string;
  productTypes: ProductTypeId[];
  signalType?: Signal["signalType"];
  detectedSoftware?: DetectedProduct[];
}): Signal {
  return {
    id: over.id,
    company: "Acme",
    industry: "",
    city: "",
    state: "",
    distanceMiles: 0,
    detectedSoftware: over.detectedSoftware ?? [],
    productTypes: over.productTypes,
    signalType: over.signalType ?? "News",
    title: "",
    description: "",
    sourceLabel: "",
    sourceUrl: "",
    postedAgo: "",
    signalStrength: 50,
    contacts: [],
  };
}

function allSubsets<T>(arr: T[]): T[][] {
  return arr.reduce<T[][]>(
    (subsets, el) => subsets.concat(subsets.map((s) => [...s, el])),
    [[]]
  );
}

const base = (over: Partial<SignalFilters>): SignalFilters => ({
  signalTypes: new Set(["News"]),
  productTypes: new Set(ALL_IDS),
  showUnclassified: true,
  software: new Set(),
  ...over,
});

// ===========================================================================
// EDGE CASE 1 (hard priority): Unclassified survives EVERY product-type combo.
// This is the never-hide-data guarantee. It is held only by check-ordering in
// applyFilters; this exhaustive test is what stops a future refactor from
// silently dropping prospects from the feed.
// ===========================================================================
describe("edge case 1: Unclassified survives every product-type combination", () => {
  const unclassified = sig({ id: "u", productTypes: [] });
  const classified = sig({ id: "c", productTypes: ["cam"] });
  const signals = [unclassified, classified];

  it(`shown for all ${1 << ALL_IDS.length} product-type subsets (showUnclassified=true)`, () => {
    for (const subset of allSubsets(ALL_IDS)) {
      const out = applyFilters(
        signals,
        base({ productTypes: new Set(subset), showUnclassified: true })
      );
      expect(
        out.map((s) => s.id),
        `subset={${subset.join(",") || "∅"}}`
      ).toContain("u");
    }
  });

  it("hidden ONLY by its own toggle (showUnclassified=false)", () => {
    const out = applyFilters(signals, base({ showUnclassified: false }));
    expect(out.map((s) => s.id)).not.toContain("u");
    expect(out.map((s) => s.id)).toContain("c");
  });
});

// ===========================================================================
// EDGE CASE 2: scoped software — only in-scope competitors can filter.
// ===========================================================================
describe("edge case 2: software filter only constrains in-scope competitors", () => {
  const cam = (): DetectedProduct[] => [
    { name: "Mastercam", productTypes: ["cam"], isCompetitor: true },
  ];

  it("an out-of-scope competitor cannot filter (signal gone via product-type stage)", () => {
    const s = sig({ id: "s", productTypes: ["cam"], detectedSoftware: cam() });
    // CAM deselected (CAD only) -> the CAM signal is excluded at stage 2, not
    // silently filtered by a now-hidden Mastercam chip.
    const out = applyFilters(
      [s],
      base({ productTypes: new Set<ProductTypeId>(["cad"]), software: new Set() })
    );
    expect(out).toHaveLength(0);
  });

  it("an in-scope competitor NOT in the software set is filtered out", () => {
    const s = sig({ id: "s", productTypes: ["cam"], detectedSoftware: cam() });
    const out = applyFilters(
      [s],
      base({ productTypes: new Set<ProductTypeId>(["cam"]), software: new Set() })
    );
    expect(out).toHaveLength(0);
  });

  it("an in-scope competitor IN the software set passes", () => {
    const s = sig({ id: "s", productTypes: ["cam"], detectedSoftware: cam() });
    const out = applyFilters(
      [s],
      base({
        productTypes: new Set<ProductTypeId>(["cam"]),
        software: new Set(["Mastercam"]),
      })
    );
    expect(out).toHaveLength(1);
  });

  it("a classified signal with NO competitor detection is never excluded by software", () => {
    // productTypes from relevance only (no named tool) -> software is moot.
    const s = sig({ id: "s", productTypes: ["cam"], detectedSoftware: [] });
    const out = applyFilters(
      [s],
      base({ productTypes: new Set<ProductTypeId>(["cam"]), software: new Set() })
    );
    expect(out).toHaveLength(1);
  });
});

// ===========================================================================
// EDGE CASE 3: empty product-type selection = show all classified, never blank.
// ===========================================================================
describe("edge case 3: empty product-type selection shows all classified", () => {
  it("all classified pass when nothing is selected", () => {
    const a = sig({ id: "a", productTypes: ["cam"] });
    const b = sig({ id: "b", productTypes: ["simulation"] });
    const out = applyFilters([a, b], base({ productTypes: new Set() }));
    expect(out.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("never blank: empty types + Unclassified off still shows classified", () => {
    const a = sig({ id: "a", productTypes: ["cam"] });
    const u = sig({ id: "u", productTypes: [] });
    const out = applyFilters(
      [a, u],
      base({ productTypes: new Set(), showUnclassified: false })
    );
    expect(out.map((s) => s.id)).toEqual(["a"]);
  });
});

// Signal-type stage sanity.
describe("signal-type stage", () => {
  it("excludes signals whose signalType is deselected", () => {
    const job = sig({ id: "j", productTypes: ["cam"], signalType: "Job Posting" });
    const news = sig({ id: "n", productTypes: ["cam"], signalType: "News" });
    const out = applyFilters([job, news], base({ signalTypes: new Set(["News"]) }));
    expect(out.map((s) => s.id)).toEqual(["n"]);
  });
});
