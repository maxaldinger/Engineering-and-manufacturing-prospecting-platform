import { describe, it, expect } from "vitest";
import { scoreSignal } from "@/lib/signal-sources/extract";
import { rankingScore } from "@/lib/catalog";

// Characterization + invariant guard for the D1 scoring/ranking generalization.
// Detection parity does not cover scoring/ranking, so this is the safety net.
//
// INVARIANT (must hold after generalization): CAM-only and empty/Unclassified
// inputs score and rank IDENTICALLY to before. The generalization is strictly
// additive — the five non-CAM/CAD types contribute where they previously
// contributed nothing. Mixed/non-CAM inputs change intentionally and are
// snapshotted below.

describe("scoreSignal INVARIANT — CAM-only / CAD-only / empty unchanged", () => {
  // These are the pinned current-behavior values; they must not move.
  const cases: Array<[string, Parameters<typeof scoreSignal>[0], number]> = [
    ["empty / base", {}, 50],
    ["CAM only", { hasCam: true }, 75],
    ["CAD only", { hasCadOnly: true }, 60],
    ["CAM + amount > 1M", { hasCam: true, amount: 2_000_000 }, 80],
    ["CAM + amount > 10M", { hasCam: true, amount: 20_000_000 }, 85],
    ["CAM + fresh (<=7d)", { hasCam: true, daysOld: 3 }, 83],
    ["CAM + recent (<=30d)", { hasCam: true, daysOld: 20 }, 79],
    ["CAM + stale (>365d)", { hasCam: true, daysOld: 400 }, 65],
    ["empty + fresh", { daysOld: 3 }, 58],
    ["empty + stale", { daysOld: 400 }, 40],
    // Passing the CAM type explicitly must NOT double-count (cam is scored by
    // the hasCam branch and excluded from the additive sum).
    ["CAM-only with productTypes:['cam']", { hasCam: true, productTypes: ["cam"] }, 75],
  ];
  for (const [label, args, expected] of cases) {
    it(`${label} -> ${expected}`, () => {
      expect(scoreSignal(args)).toBe(expected);
    });
  }
});

describe("scoreSignal GENERALIZATION — mixed/non-CAM (intentional)", () => {
  // The additive contributions from TYPE_WEIGHTS: cam 25, cad 10, the four
  // competitor-bearing types 15, mfg-services 10.
  const cases: Array<[string, Parameters<typeof scoreSignal>[0], number]> = [
    ["CAM + Simulation", { hasCam: true, productTypes: ["cam", "simulation"] }, 90], // 75 + 15
    ["Simulation only", { productTypes: ["simulation"] }, 65], // 50 + 15
    ["Electrical only", { productTypes: ["electrical"] }, 65],
    ["Design Automation only", { productTypes: ["design-automation"] }, 65],
    ["Additive only", { productTypes: ["additive"] }, 65],
    ["Mfg-Services only (weight 10)", { productTypes: ["mfg-services"] }, 60], // 50 + 10
    ["CAD + Electrical", { hasCadOnly: true, productTypes: ["cad", "electrical"] }, 75], // 60 + 15
    ["CAM + Sim + Electrical (capped 98)", { hasCam: true, productTypes: ["cam", "simulation", "electrical"] }, 98], // 50+25+15+15=105 -> 98
  ];
  for (const [label, args, expected] of cases) {
    it(`${label} -> ${expected}`, () => {
      expect(scoreSignal(args)).toBe(expected);
    });
  }
});

// ZoomInfo ranking key: weighted sum of detected-type weights (the SAME
// TYPE_WEIGHTS that drive scoreSignal).
function rankKey(text: string): number {
  return rankingScore(text);
}

const RANK_STACKS = [
  { id: "A_two_cam", text: "Mastercam, GibbsCAM" }, // 25 + 25 = 50
  { id: "B_one_cam", text: "Mastercam" }, // 25
  { id: "C_cad_only", text: "SOLIDWORKS" }, // 10 (CAD)
  { id: "D_none", text: "QuickBooks and Salesforce" }, // 0
];

describe("ranking INVARIANT — CAM-only/empty order preserved", () => {
  it("order is A, B, C, D", () => {
    const order = RANK_STACKS.map((s, i) => ({ ...s, i }))
      .sort((a, b) => rankKey(b.text) - rankKey(a.text) || a.i - b.i)
      .map((s) => s.id);
    expect(order).toEqual(["A_two_cam", "B_one_cam", "C_cad_only", "D_none"]);
  });
  it("CAM-only stays monotonic in tool count (2 CAM tools > 1)", () => {
    expect(rankKey("Mastercam, GibbsCAM")).toBeGreaterThan(rankKey("Mastercam"));
  });
});

describe("ranking — weighted: CAM (25) outranks Simulation (15)", () => {
  it("a single CAM competitor outranks a single Simulation tool", () => {
    expect(rankKey("Mastercam")).toBe(25);
    expect(rankKey("Ansys")).toBe(15);
    expect(rankKey("Mastercam")).toBeGreaterThan(rankKey("Ansys"));
  });
  it("CAM + Simulation ranks below two CAM and above one CAM", () => {
    // Mastercam(25) + Ansys(15) = 40; two CAM = 50; one CAM = 25.
    expect(rankKey("Mastercam and Ansys")).toBe(40);
    expect(rankKey("Mastercam and Ansys")).toBeLessThan(
      rankKey("Mastercam, GibbsCAM")
    );
    expect(rankKey("Mastercam and Ansys")).toBeGreaterThan(rankKey("Mastercam"));
  });
});
