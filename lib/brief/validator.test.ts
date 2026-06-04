import { describe, it, expect } from "vitest";
import { validateProse } from "./validator";

describe("post-parse validator strips and flags fabrication", () => {
  it("strips an injected fake stat with no sourced backing", () => {
    const r = validateProse("Expect a 60% reduction in cycle time after the switch.");
    expect(r.ok).toBe(false);
    expect(r.flags.some((f) => f.reason === "unsourced-number" && f.span.includes("60"))).toBe(true);
    expect(r.clean).toContain("[unverified]");
    expect(r.clean).not.toMatch(/60\s?%/);
  });

  it("keeps a number that IS sourced (appears in the provided signals)", () => {
    const r = validateProse("Won a $14.6M Navy award last quarter.", ["$14.6M"]);
    expect(r.clean).toContain("$14.6M");
    expect(r.flags.some((f) => f.reason === "unsourced-number")).toBe(false);
  });

  it("flags a sourced number sitting in a proof-stat shape", () => {
    const r = validateProse("Saw a 30% improvement.", ["30%"]);
    expect(r.flags.some((f) => f.reason === "stat-claim")).toBe(true);
  });

  it("catches a spelled-out stat that evades the digit regex", () => {
    const r = validateProse("They improved yield by sixty percent last year.");
    expect(r.ok).toBe(false);
    expect(r.flags.some((f) => f.reason === "unsourced-number")).toBe(true);
    expect(r.clean).toContain("[unverified]");
    expect(r.clean).not.toMatch(/sixty/i);
  });

  it("catches other spelled number shapes (folds, counts, magnitudes)", () => {
    expect(validateProse("a three-fold improvement").flags.some((f) => f.reason === "unsourced-number")).toBe(true);
    expect(validateProse("zero findings across three audits").flags.some((f) => f.reason === "unsourced-number")).toBe(true);
    expect(validateProse("two hundred employees").flags.some((f) => f.reason === "unsourced-number")).toBe(true);
  });

  it("flags a named-customer claim", () => {
    const r = validateProse("Trusted by customers like Boeing and Lockheed.");
    expect(r.flags.some((f) => f.reason === "named-customer")).toBe(true);
  });

  it("passes clean qualitative prose", () => {
    const r = validateProse("They are hiring CNC programmers and run Mastercam in production.");
    expect(r.ok).toBe(true);
    expect(r.flags).toHaveLength(0);
  });
});
