import { describe, it, expect } from "vitest";
import {
  computeSeverity,
  evidenceFor,
  severityBand,
  SEVERITY_FN,
  type SeveritySignal,
} from "./severity";
import { recompute } from "./provenance";
import type { ProductTypeId } from "@/types/product";

function sig(id: string, strength: number, productTypes: ProductTypeId[]): SeveritySignal {
  return {
    id,
    signalStrength: strength,
    signalType: "Job Posting",
    title: `Signal ${id}`,
    sourceUrl: `https://x/${id}`,
    productTypes,
  };
}

describe("severity is computed and recomputable", () => {
  it("recomputes from its stored basis to the rendered value", () => {
    const evidence = [sig("a", 90, ["cam"]), sig("b", 70, ["cam"])];
    const f = computeSeverity(evidence);
    expect(f.provenance).toBe("computed");
    expect(f.basis.fn).toBe(SEVERITY_FN);
    expect(f.sourceRef.length).toBe(2);
    expect(recompute(f)).toBe(f.value);
  });

  it("more high-strength evidence raises severity", () => {
    const one = computeSeverity([sig("a", 70, ["cam"])]).value;
    const many = computeSeverity([
      sig("a", 70, ["cam"]),
      sig("b", 70, ["cam"]),
      sig("c", 70, ["cam"]),
    ]).value;
    expect(many).toBeGreaterThan(one);
  });

  it("scopes evidence to the discipline, falling back to all signals", () => {
    const signals = [sig("a", 90, ["cam"]), sig("b", 40, ["simulation"])];
    expect(evidenceFor(signals, "cam").map((s) => s.id)).toEqual(["a"]);
    // discipline present but matches nothing -> fall back to the whole set
    expect(evidenceFor(signals, "electrical").length).toBe(2);
    // no discipline -> whole set
    expect(evidenceFor(signals, undefined).length).toBe(2);
  });

  it("bands the number into high / medium / low", () => {
    expect(severityBand(85)).toBe("high");
    expect(severityBand(60)).toBe("medium");
    expect(severityBand(40)).toBe("low");
  });
});
