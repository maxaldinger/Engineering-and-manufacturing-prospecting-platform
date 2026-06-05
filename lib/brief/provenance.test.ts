import { describe, it, expect } from "vitest";
import {
  detected,
  computed,
  inferred,
  inferredFromSignals,
  curated,
  curatedGap,
  isCuratedGap,
  registerScorer,
  recompute,
  type SourceRef,
  type DetectedField,
} from "./provenance";

const REF: SourceRef[] = [{ signalId: "s1", label: "a signal", url: "http://x" }];

describe("builders enforce their provenance contract", () => {
  it("detected requires at least one sourceRef", () => {
    expect(() => detected("Acme", [])).toThrow(/sourceRef/);
    const f = detected("Acme", REF);
    expect(f.provenance).toBe("detected");
    expect(f.value).toBe("Acme");
    expect(f.sourceRef).toHaveLength(1);
  });

  it("computed requires a named scorer and its input refs", () => {
    const basis = { fn: "x.v1", inputs: { a: 1 }, weights: {} };
    expect(() => computed(5, { fn: "", inputs: {}, weights: {} }, REF)).toThrow(/scoring function/);
    expect(() => computed(5, basis, [])).toThrow(/sourceRefs/);
    const f = computed(5, basis, REF);
    expect(f.provenance).toBe("computed");
    expect(f.value).toBe(5);
  });

  it("inferred requires a basis; sourceRef is optional (vertical-level only)", () => {
    expect(() => inferred("guess", "  ")).toThrow(/basis/);
    const f = inferred("defense supplier", "hypothesis: defense NAICS 336411");
    expect(f.provenance).toBe("inferred");
    expect(f.sourceRef).toBeUndefined();
  });

  it("inferredFromSignals (LLM prose) requires the source signals", () => {
    expect(() => inferredFromSignals("summary", "paraphrase of signals", [])).toThrow(
      /derived from/
    );
    const f = inferredFromSignals("summary", "paraphrase of signals", REF);
    expect(f.sourceRef).toHaveLength(1);
  });

  it("curated requires a real reference; curatedGap is a typed, visible gap", () => {
    expect(() => curated("claim", "")).toThrow(/library/);
    const gap = curatedGap("pending battlecard");
    expect(isCuratedGap(gap)).toBe(true);
    expect(gap.pending).toBe("pending battlecard");
    expect(isCuratedGap(curated("real claim", "battlecard#12"))).toBe(false);
  });
});

describe("recompute proves a computed number is honest", () => {
  it("re-runs the registered scorer and matches an honest value", () => {
    registerScorer("test.sum", (i) => (i.a ?? 0) + (i.b ?? 0));
    const honest = computed(5, { fn: "test.sum", inputs: { a: 2, b: 3 }, weights: {} }, REF);
    expect(recompute(honest)).toBe(honest.value);
  });

  it("a fabricated value does not survive recompute", () => {
    registerScorer("test.sum2", (i) => (i.a ?? 0) + (i.b ?? 0));
    // value claims 99 but the inputs only sum to 5: recompute exposes the lie.
    const lying = computed(99, { fn: "test.sum2", inputs: { a: 2, b: 3 }, weights: {} }, REF);
    expect(recompute(lying)).not.toBe(lying.value);
  });

  it("throws if the scorer is not registered (no silent pass)", () => {
    const orphan = computed(1, { fn: "never.registered", inputs: {}, weights: {} }, REF);
    expect(() => recompute(orphan)).toThrow(/registered scorer/);
  });
});

// Compile-time invariants. Never executed; tsc validates each @ts-expect-error.
// If the type stops rejecting these, the build fails, which is the point.
function _typeInvariants() {
  // The number rule: a statistic cannot be tagged as a hypothesis or curated.
  // @ts-expect-error inferred rejects a numeric value
  inferred(42, "basis");
  // @ts-expect-error curated rejects a numeric value
  curated(42, "basis");

  // Builder-only construction: a plain literal lacks the module-private brand,
  // so it is not assignable to a Field type. You must go through the builder.
  // @ts-expect-error a hand-built literal is not a DetectedField (no brand)
  const _f: DetectedField<string> = {
    provenance: "detected",
    value: "x",
    sourceRef: REF,
  };
  void _f;
}
void _typeInvariants;
