import { describe, it, expect } from "vitest";
import { recompute } from "./provenance";
import {
  computeFitScore,
  FIT_SCORE_FN,
  FIT_SCORE_WEIGHTS,
  type FitScoreSignal,
} from "./fit-score";

function sig(
  id: string,
  signalStrength: number,
  signalType: FitScoreSignal["signalType"]
): FitScoreSignal {
  return { id, signalStrength, signalType, title: `t-${id}`, sourceUrl: `http://x/${id}` };
}

describe("fit score is computed, recomputable, and cites its full input set", () => {
  it("recompute(field) equals the rendered value (Refinement 1)", () => {
    const field = computeFitScore({
      signals: [sig("a", 80, "Job Posting"), sig("b", 70, "Gov Contract"), sig("c", 60, "News")],
      routeCount: 3,
    });
    expect(recompute(field)).toBe(field.value);
  });

  it("the basis names the scorer and carries inputs + weights", () => {
    const field = computeFitScore({ signals: [sig("a", 50, "Job Posting")], routeCount: 1 });
    expect(field.basis.fn).toBe(FIT_SCORE_FN);
    expect(field.basis.inputs).toMatchObject({
      meanStrength: 50,
      routeCount: 1,
      signalTypeCount: 1,
    });
    expect(field.basis.weights).toEqual({ ...FIT_SCORE_WEIGHTS });
  });

  it("cites every signal it was computed over (test 3: ref count = signal count)", () => {
    const signals = [sig("a", 80, "Job Posting"), sig("b", 70, "Gov Contract")];
    const field = computeFitScore({ signals, routeCount: 2 });
    expect(field.sourceRef).toHaveLength(signals.length);
    expect(field.sourceRef.map((r) => r.signalId).sort()).toEqual(["a", "b"]);
  });
});

// Surfaced scores for the initial weights (Decision 1: visible + tunable, not a
// sign-off in the abstract). These lock the weights' behavior; change a weight
// and these update, which is the tuning signal. Real-output tuning follows once
// generation renders live scores.
describe("initial fit-score weights, resulting scores", () => {
  const cases: { name: string; signals: FitScoreSignal[]; routeCount: number; expected: number }[] = [
    {
      name: "single weak signal -> base only",
      signals: [sig("a", 50, "Job Posting")],
      routeCount: 1,
      expected: 50, // 50 + 0 + 0
    },
    {
      name: "two signals, two routes, one type",
      signals: [sig("a", 40, "Job Posting"), sig("b", 40, "Job Posting")],
      routeCount: 2,
      expected: 45, // mean 40 + min(15, 1*5)=5 + 0
    },
    {
      name: "activity-rich: 3 routes, 2 types",
      signals: [sig("a", 80, "Job Posting"), sig("b", 70, "Gov Contract"), sig("c", 60, "Job Posting")],
      routeCount: 3,
      expected: 83, // mean 70 + min(15,2*5)=10 + min(9,1*3)=3
    },
    {
      name: "strong + full type spread, clamps at 100",
      signals: [
        sig("a", 90, "Job Posting"),
        sig("b", 85, "Gov Contract"),
        sig("c", 88, "News"),
        sig("d", 82, "Tech Adoption"),
      ],
      routeCount: 3,
      expected: 100, // 86.25 + 10 + 9 = 105.25 -> clamp 100
    },
  ];

  for (const c of cases) {
    it(`${c.name} -> ${c.expected}`, () => {
      const field = computeFitScore({ signals: c.signals, routeCount: c.routeCount });
      expect(field.value).toBe(c.expected);
      expect(recompute(field)).toBe(c.expected);
    });
  }
});
