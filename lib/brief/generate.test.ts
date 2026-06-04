import { describe, it, expect } from "vitest";
import { groundProse, parseRawProse, allowedNumbersFromGroup } from "./generate";
import type { CompanyGroup } from "@/lib/signal-grouping";
import type { Signal } from "@/types/signal";

function mkGroup(signalText: { title: string; description: string }[]): CompanyGroup {
  const signals: Signal[] = signalText.map((t, i) => ({
    id: `g${i}`,
    company: "Acme",
    industry: "Aerospace and Defense",
    city: "Denver",
    state: "CO",
    distanceMiles: 0,
    detectedSoftware: [],
    productTypes: [],
    signalType: "Gov Contract",
    title: t.title,
    description: t.description,
    sourceLabel: "USAspending.gov",
    sourceUrl: `https://x/${i}`,
    postedAgo: "1 week ago",
    signalStrength: 70,
    contacts: [],
  }));
  return {
    key: "acme",
    company: "Acme",
    industry: "Aerospace and Defense",
    state: "CO",
    city: "Denver",
    signals,
    topSignal: signals[0],
    maxStrength: 70,
    urgency: "medium",
    detectedSoftware: [],
    productTypes: [],
    oneLiner: "",
    oldestPostedAgo: "1 week ago",
    manufacturingRelevant: true,
    servicesCrossSell: false,
  };
}

describe("groundProse contains the model", () => {
  it("strips an injected fake stat the signals do not support", () => {
    const group = mkGroup([{ title: "CNC Programmer", description: "Hiring for production." }]);
    const { prose, flags } = groundProse(
      { executiveSummary: "Switching cuts cycle time by 60% within a quarter." },
      group
    );
    expect(flags.some((f) => f.reason === "unsourced-number")).toBe(true);
    expect(prose.executiveSummary).toContain("[unverified]");
    expect(prose.executiveSummary).not.toMatch(/60\s?%/);
  });

  it("keeps a number that appears in the signals", () => {
    const group = mkGroup([
      { title: "Navy award", description: "Department of the Navy contract award, $14.6M." },
    ]);
    const { prose, flags } = groundProse(
      { executiveSummary: "Won a $14.6M Navy award." },
      group
    );
    expect(prose.executiveSummary).toContain("$14.6M");
    expect(flags.some((f) => f.reason === "unsourced-number")).toBe(false);
  });

  it("extracts the sourced numbers from the signals", () => {
    const group = mkGroup([{ title: "Award", description: "Worth $14.6M over 3 years." }]);
    const nums = allowedNumbersFromGroup(group);
    expect(nums.some((n) => n.includes("14.6"))).toBe(true);
  });
});

describe("parseRawProse", () => {
  it("parses a valid object and rejects garbage", () => {
    const ok = parseRawProse('{"executiveSummary":"hi","painPoints":[{"text":"p1"}]}');
    expect(ok?.executiveSummary).toBe("hi");
    expect(ok?.painPoints?.[0]?.text).toBe("p1");
    expect(parseRawProse("not json")).toBeNull();
  });
});
