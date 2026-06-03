import { describe, it, expect } from "vitest";
import { buildSignalDigest } from "./brief";
import { buildSystemPrompt } from "@/lib/sales-context";
import type { CompanyGroup } from "@/lib/signal-grouping";
import type { Signal } from "@/types/signal";

// Synthetic prospect running BOTH Mastercam (non-draft CAM, validated fit) and
// Ansys (draft Simulation, unvalidated). Live sources won't reliably produce
// this combination, so we construct it to lock the structural draft guard.
function syntheticGroup(): CompanyGroup {
  const sig: Signal = {
    id: "syn-1",
    company: "Synthetic Precision",
    industry: "Aerospace and Defense",
    city: "Detroit",
    state: "MI",
    distanceMiles: 0,
    detectedSoftware: [
      { name: "Mastercam", productTypes: ["cam"], isCompetitor: true },
      { name: "Ansys", productTypes: ["simulation"], isCompetitor: true },
    ],
    productTypes: ["cam", "simulation"],
    signalType: "Tech Adoption",
    title: "Runs Mastercam and Ansys",
    description: "Aerospace machining shop.",
    sourceLabel: "ZoomInfo",
    sourceUrl: "",
    postedAgo: "current",
    signalStrength: 80,
    contacts: [],
  };
  return {
    key: "synthetic-precision",
    company: "Synthetic Precision",
    industry: "Aerospace and Defense",
    state: "MI",
    city: "Detroit",
    signals: [sig],
    topSignal: sig,
    maxStrength: 80,
    urgency: "high",
    detectedSoftware: ["Mastercam", "Ansys"],
    productTypes: ["cam", "simulation"],
    oneLiner: "Runs Mastercam and Ansys",
    oldestPostedAgo: "current",
    camRelevant: true,
    manufacturingRelevant: true,
  };
}

// The exact unvalidated reason text the catalog holds for draft competitors.
// It must NEVER appear in any prompt — that is the structural guarantee.
const WITHHELD_DRAFT_REASON = "pending domain-SME review";
// A real, assertable Mastercam reason that MUST appear.
const REAL_CAM_REASON = "Native SOLIDWORKS integration";

describe("dossier digest — structural draft guard", () => {
  const digest = buildSignalDigest(syntheticGroup());

  it("Mastercam (validated CAM): arrow mapping + real reasons are present", () => {
    expect(digest).toContain("Mastercam -> CAMWorks");
    expect(digest).toContain(REAL_CAM_REASON);
  });

  it("Ansys (draft): category-offering framing, no replacement assertion", () => {
    expect(digest).toContain("Our Simulation (FEA/CFD) offering is SOLIDWORKS Simulation");
    expect(digest).toContain("worth a conversation");
    expect(digest).toContain("NOT a validated replacement for Ansys");
  });

  it("Ansys (draft): NO arrow mapping and NO unvalidated reason injected", () => {
    expect(digest).not.toContain("Ansys -> ");
    expect(digest).not.toContain(WITHHELD_DRAFT_REASON);
  });
});

describe("sales-context fitBlock — same structural guard", () => {
  const prompt = buildSystemPrompt({
    tab: "Product Fit",
    tone: "Direct",
    methodology: "MEDDPICC",
    company: {
      company: "Synthetic Precision",
      city: "Detroit",
      state: "MI",
      detectedSoftware: ["Mastercam", "Ansys"],
    },
  });

  it("Mastercam: arrow mapping + real reasons present", () => {
    expect(prompt).toContain("Mastercam -> CAMWorks");
    expect(prompt).toContain(REAL_CAM_REASON);
  });

  it("Ansys (draft): category-offering, no replacement arrow, no unvalidated reason", () => {
    expect(prompt).toContain("our Simulation (FEA/CFD) offering is SOLIDWORKS Simulation");
    expect(prompt).not.toContain("Ansys -> ");
    expect(prompt).not.toContain(WITHHELD_DRAFT_REASON);
  });
});
