import { describe, it, expect } from "vitest";
import { validateProse, extractNumbers } from "./validator";

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

  it("spares a bare 'one' determiner but masks 'one' in a number or stat shape", () => {
    // bare determiner survives, unflagged
    const a = validateProse("Just one more thought before we wrap.");
    expect(a.clean).toContain("one more thought");
    expect(a.flags.some((f) => f.reason === "unsourced-number")).toBe(false);
    expect(validateProse("There is one challenge here.").clean).toContain("one challenge");

    // number / stat shapes stay masked
    const hundred = validateProse("improved by one hundred percent");
    expect(hundred.clean).not.toMatch(/one\s+hundred/i);
    expect(hundred.flags.some((f) => f.reason === "unsourced-number")).toBe(true);

    const minute = validateProse("a one-minute conversation");
    expect(minute.clean).not.toMatch(/one-minute/i);
    expect(minute.flags.some((f) => f.reason === "unsourced-number")).toBe(true);

    expect(validateProse("cut it by one third").flags.some((f) => f.reason === "unsourced-number")).toBe(true);
    expect(validateProse("a one percent gain").flags.some((f) => f.reason === "unsourced-number")).toBe(true);
  });

  it("a magnitude suffix no longer swallows the next word's first letter", () => {
    // "30 minutes": mask the number, keep "minutes" intact, not "[unverified]inutes".
    const r = validateProse("Carve out 30 minutes this week.");
    expect(r.flags.some((f) => f.reason === "unsourced-number")).toBe(true);
    expect(r.clean).toContain("[unverified] minutes");
    expect(r.clean).not.toContain("[unverified]inutes");
    // an attached suffix still parses as one token and masks cleanly.
    expect(validateProse("about 30k seats").clean).toContain("[unverified] seats");
  });

  it("keeps a source number that precedes an m/k/b word (AS9100 machine shop)", () => {
    const allowed = extractNumbers("AS9100 machine shop, 5-axis work");
    expect(allowed).toContain("9100"); // not "9100 m"
    const r = validateProse("They are AS9100 certified for documentation.", allowed);
    expect(r.clean).toContain("9100");
    expect(r.flags.some((f) => f.reason === "unsourced-number")).toBe(false);
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
