import { describe, it, expect } from "vitest";
import { groupSignalsByCompany } from "./signal-grouping";
import { DISCOVERY_ROUTE_TYPES } from "@/lib/catalog";
import type { Signal } from "@/types/signal";
import type { ProductTypeId } from "@/types/product";

function sig(company: string, productTypes: ProductTypeId[], id: string): Signal {
  return {
    id,
    company,
    industry: "Manufacturing",
    city: "Wichita",
    state: "KS",
    distanceMiles: 0,
    detectedSoftware: [],
    productTypes,
    signalType: "Job Posting",
    title: "t",
    description: "d",
    sourceLabel: "Test",
    sourceUrl: "",
    postedAgo: "today",
    signalStrength: 50,
    contacts: [],
  };
}

describe("mfg-services derived cross-sell flag", () => {
  it("fires when a company spans >=2 discovery-route disciplines", () => {
    const groups = groupSignalsByCompany([
      sig("Alpha Industries", ["cam"], "a"),
      sig("Alpha Industries", ["simulation"], "b"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].servicesCrossSell).toBe(true);
  });

  it("does not fire for a single discipline", () => {
    const groups = groupSignalsByCompany([
      sig("Beta Industries", ["cam"], "a"),
      sig("Beta Industries", ["cam"], "b"),
    ]);
    expect(groups[0].servicesCrossSell).toBe(false);
  });

  it("does not count mfg-services itself as a discipline", () => {
    // cam + mfg-services spans only ONE discovery-route discipline (cam), so the
    // derived flag — which is ABOUT services — must not be self-triggered by a
    // mfg-services-classified signal.
    const groups = groupSignalsByCompany([
      sig("Gamma Industries", ["cam"], "a"),
      sig("Gamma Industries", ["mfg-services"], "b"),
    ]);
    expect(groups[0].servicesCrossSell).toBe(false);
  });
});

describe("discovery routes exclude derived types (data-driven)", () => {
  it("mfg-services is not a selectable route", () => {
    expect(DISCOVERY_ROUTE_TYPES.map((t) => t.id)).not.toContain("mfg-services");
    expect(DISCOVERY_ROUTE_TYPES).toHaveLength(6);
  });
});
