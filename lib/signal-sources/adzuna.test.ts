import { describe, it, expect } from "vitest";
import {
  parseAdzunaResults,
  describeAdzunaFailure,
  type AdzunaResponse,
} from "./adzuna";
import { canonicalCompany } from "./company";
import { groupSignalsByCompany } from "@/lib/signal-grouping";

// A realistic-shaped Adzuna page: a CAM posting, a Simulation posting, and a
// generic posting that classifies to nothing (Unclassified).
const PAGE: AdzunaResponse = {
  count: 3,
  results: [
    {
      id: 101,
      title: "CNC Programmer",
      description:
        "Seeking a CNC programmer experienced with Mastercam for 5-axis aerospace parts.",
      company: { display_name: "Precision Aerospace Inc" },
      location: { display_name: "Wichita, Kansas", area: ["US", "Kansas", "Wichita"] },
      redirect_url: "https://www.adzuna.com/job/101",
      created: "2026-05-20T12:00:00Z",
      category: { label: "Engineering Jobs", tag: "engineering-jobs" },
    },
    {
      id: 102,
      title: "FEA Engineer",
      description: "Structural stress analysis using Ansys for turbine components.",
      company: { display_name: "Structural Dynamics LLC" },
      location: { display_name: "Wichita, Kansas" },
      redirect_url: "https://www.adzuna.com/job/102",
      created: "2026-05-22T12:00:00Z",
    },
    {
      id: 103,
      title: "Logistics Coordinator",
      description: "Coordinate inbound and outbound shipments for the facility.",
      company: { display_name: "Midwest Distribution Co" },
      location: { display_name: "Topeka, Kansas" },
      redirect_url: "https://www.adzuna.com/job/103",
      created: "2026-05-25T12:00:00Z",
    },
  ],
};

describe("Adzuna standalone (parse) yields real, classified results", () => {
  const signals = parseAdzunaResults(PAGE, { stateCode: "KS" });

  it("produces one signal per posting, all Job Postings in the queried state", () => {
    expect(signals).toHaveLength(3);
    expect(signals.every((s) => s.signalType === "Job Posting")).toBe(true);
    expect(signals.every((s) => s.state === "KS")).toBe(true);
    expect(signals.every((s) => s.sourceLabel.startsWith("Adzuna"))).toBe(true);
  });

  it("classifies the CAM and Simulation postings via the catalog", () => {
    const cam = signals.find((s) => s.title === "CNC Programmer")!;
    expect(cam.detectedSoftware.map((d) => d.name)).toContain("Mastercam");
    expect(cam.productTypes).toContain("cam");
    expect(cam.camRelevant).toBe(true);

    const sim = signals.find((s) => s.title === "FEA Engineer")!;
    expect(sim.detectedSoftware.map((d) => d.name)).toContain("Ansys");
    expect(sim.productTypes).toContain("simulation");
  });

  it("surfaces an unclassifiable posting rather than dropping it", () => {
    const generic = signals.find((s) => s.title === "Logistics Coordinator")!;
    // [] = Unclassified — present in the output, never silently filtered out.
    expect(generic.productTypes).toEqual([]);
  });
});

// Company-level aggregation: per-JOB listings under name variants of one
// employer must collapse into ONE prospect, not fragment into several.
const VARIANTS: AdzunaResponse = {
  results: [
    {
      id: 201,
      title: "CNC Programmer",
      description: "Mastercam programming for defense parts.",
      company: { display_name: "Lockheed Martin" },
      location: { display_name: "Fort Worth, Texas" },
      redirect_url: "https://www.adzuna.com/job/201",
      created: "2026-05-20T12:00:00Z",
    },
    {
      id: 202,
      title: "Machinist",
      description: "5-axis machining center operator.",
      company: { display_name: "Lockheed Martin Corp" },
      location: { display_name: "Fort Worth, Texas" },
      redirect_url: "https://www.adzuna.com/job/202",
      created: "2026-05-21T12:00:00Z",
    },
    {
      id: 203,
      title: "Manufacturing Engineer",
      description: "Process engineering for assembly.",
      company: { display_name: "LMCO" },
      location: { display_name: "Fort Worth, Texas" },
      redirect_url: "https://www.adzuna.com/job/203",
      created: "2026-05-22T12:00:00Z",
    },
  ],
};

describe("Adzuna company-level aggregation", () => {
  it("collapses name variants (incl. the LMCO acronym) into one prospect", () => {
    const signals = parseAdzunaResults(VARIANTS, { stateCode: "TX" });
    expect(signals).toHaveLength(3);

    const groups = groupSignalsByCompany(signals);
    expect(groups).toHaveLength(1);
    expect(groups[0].signals).toHaveLength(3);
  });
});

describe("canonicalCompany alias resolution", () => {
  it("resolves known acronyms and leaves everything else as-is", () => {
    expect(canonicalCompany("LMCO")).toBe("Lockheed Martin");
    expect(canonicalCompany("lmco")).toBe("Lockheed Martin");
    // Suffix variants are intentionally left to the grouping key, not rewritten.
    expect(canonicalCompany("Lockheed Martin Corp")).toBe("Lockheed Martin Corp");
    expect(canonicalCompany("Acme Machining LLC")).toBe("Acme Machining LLC");
    expect(canonicalCompany("")).toBe("");
  });
});

// Degradation must be DISTINGUISHABLE from an empty territory: a throttle /
// quota / auth failure maps to a descriptive error, never silence.
describe("Adzuna failure is distinguishable from empty results", () => {
  it("describes a quota / rate-limit hit (429) as unavailable, not empty", () => {
    const msg = describeAdzunaFailure(429);
    expect(msg).toMatch(/quota|rate limit/i);
    expect(msg).toMatch(/not empty|unavailable/i);
  });

  it("describes auth failures (401/403)", () => {
    expect(describeAdzunaFailure(401)).toMatch(/auth/i);
    expect(describeAdzunaFailure(403)).toMatch(/auth/i);
  });

  it("describes server and generic failures", () => {
    expect(describeAdzunaFailure(500)).toMatch(/service error/i);
    expect(describeAdzunaFailure(400)).toMatch(/request failed/i);
  });
});
