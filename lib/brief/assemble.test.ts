import { describe, it, expect } from "vitest";
import { assembleBrief, type GroundedBrief, type BriefProse } from "./assemble";
import { recompute, isCuratedGap, type AnyField } from "./provenance";
import type { CompanyGroup } from "@/lib/signal-grouping";
import type { Signal } from "@/types/signal";
import type { DetectedProduct, CatalogProductName } from "@/lib/catalog";
import type { ProductTypeId } from "@/types/product";

function det(
  name: CatalogProductName,
  productTypes: ProductTypeId[],
  isCompetitor: boolean
): DetectedProduct {
  return { name, productTypes, isCompetitor };
}

function mkSignal(
  id: string,
  partial: Partial<Signal> & { detectedSoftware?: DetectedProduct[]; productTypes?: ProductTypeId[] }
): Signal {
  return {
    id,
    company: "Acme Aerospace",
    industry: "Aerospace and Defense",
    city: "Denver",
    state: "CO",
    distanceMiles: 0,
    detectedSoftware: partial.detectedSoftware ?? [],
    productTypes: partial.productTypes ?? [],
    signalType: partial.signalType ?? "Job Posting",
    title: partial.title ?? `Signal ${id}`,
    description: partial.description ?? "A signal description.",
    sourceLabel: partial.sourceLabel ?? "Adzuna",
    sourceUrl: partial.sourceUrl ?? `https://x/${id}`,
    postedAgo: partial.postedAgo ?? "3 days ago",
    signalStrength: partial.signalStrength ?? 70,
    contacts: partial.contacts ?? [],
  };
}

function mkGroup(signals: Signal[], detectedSoftware: string[], productTypes: ProductTypeId[]): CompanyGroup {
  return {
    key: "acme-aerospace",
    company: "Acme Aerospace",
    industry: "Aerospace and Defense",
    state: "CO",
    city: "Denver",
    signals,
    topSignal: signals[0],
    maxStrength: Math.max(...signals.map((s) => s.signalStrength)),
    urgency: "high",
    detectedSoftware,
    productTypes,
    oneLiner: "",
    oldestPostedAgo: "1 week ago",
    manufacturingRelevant: true,
    servicesCrossSell: productTypes.length >= 2,
  };
}

// Walk every Field in the brief so the grounding assertions cover all of them.
function collectFields(b: GroundedBrief): AnyField[] {
  const out: AnyField[] = [
    b.header.company,
    b.header.vertical,
    b.header.fitScore,
    b.header.motionField,
    b.executiveSummary,
    ...b.disciplines,
  ];
  for (const p of b.painPoints) {
    out.push(p.text, p.solution, p.severity);
    if (p.discipline) out.push(p.discipline);
  }
  for (const p of b.talkingPoints) out.push(p.text, p.proof);
  if ("subject" in b.outreach) out.push(b.outreach.subject, b.outreach.body);
  else out.push(b.outreach);
  for (const d of b.displacement) out.push(d.competitor, d.positioning);
  for (const c of b.keyContacts) out.push(c.role, c.dept, c.valueProp, c.tier);
  for (const r of b.relatedSignals) out.push(r.headline, r.source, r.date, r.relevance);
  return out;
}

const MIXED_GROUP = mkGroup(
  [
    mkSignal("s1", {
      title: "CNC Programmer",
      signalType: "Job Posting",
      detectedSoftware: [det("Mastercam", ["cam"], true)],
      productTypes: ["cam"],
      signalStrength: 80,
    }),
    mkSignal("s2", {
      title: "Mechanical Design Engineer",
      signalType: "Job Posting",
      detectedSoftware: [det("SolidWorks", ["cad"], false)],
      productTypes: ["cad"],
      signalStrength: 70,
    }),
  ],
  ["Mastercam", "SolidWorks"],
  ["cam", "cad"]
);

describe("assembleBrief grounding", () => {
  const brief = assembleBrief({ group: MIXED_GROUP, routeCount: 2, generatedAt: "2026-06-04T00:00:00Z" });

  it("every field carries a provenance tag and honors its contract", () => {
    for (const f of collectFields(brief)) {
      expect(f.provenance).toBeTruthy();
      if (f.provenance === "detected") expect(f.sourceRef.length).toBeGreaterThan(0);
      if (f.provenance === "computed") {
        expect(f.basis.fn).toBeTruthy();
        expect(f.sourceRef.length).toBeGreaterThan(0);
      }
      if (f.provenance === "inferred") expect(f.basis.length).toBeGreaterThan(0);
    }
  });

  it("relevance score is DETECTED (read from the signal), not computed", () => {
    expect(brief.relatedSignals.every((r) => r.relevance.provenance === "detected")).toBe(true);
  });

  it("fit score is computed and recomputes to its rendered value", () => {
    expect(brief.header.fitScore.provenance).toBe("computed");
    expect(recompute(brief.header.fitScore)).toBe(brief.header.fitScore.value);
  });

  it("a detected competitor produces a displacement entry with real catalog positioning", () => {
    const mc = brief.displacement.find((d) => d.competitor.value === "Mastercam");
    expect(mc).toBeDefined();
    expect(mc!.positioning.provenance).toBe("curated");
    expect(isCuratedGap(mc!.positioning)).toBe(false); // Mastercam is non-draft, real reasons
  });

  it("motion reflects ours + theirs (mixed)", () => {
    expect(brief.header.motion).toBe("mixed");
  });

  it("without ZoomInfo, key contacts are role templates with no names", () => {
    expect(brief.keyContacts.length).toBeGreaterThan(0);
    expect(brief.keyContacts.every((c) => c.named === false)).toBe(true);
    expect(brief.keyContacts.every((c) => c.role.provenance === "curated")).toBe(true);
  });

  it("without prose, the AI sections are visible pending gaps, not invented", () => {
    const es = brief.executiveSummary;
    expect(es.provenance).toBe("curated");
    if (es.provenance === "curated") expect(isCuratedGap(es)).toBe(true);
    expect(brief.painPoints).toHaveLength(0);
    expect(brief.talkingPoints).toHaveLength(0);
  });

  it("without prose, outreach is a visible pending gap, never an invented draft", () => {
    expect("subject" in brief.outreach).toBe(false);
    if (!("subject" in brief.outreach)) expect(isCuratedGap(brief.outreach)).toBe(true);
  });
});

describe("assembleBrief with prose: every prose section carries its refs", () => {
  const prose: BriefProse = {
    executiveSummary: "Acme is hiring CNC programmers and mechanical designers in Denver.",
    painPoints: [{ text: "CAD to CAM handoff friction implied by parallel hiring.", discipline: "cam" }],
    talkingPoints: [{ text: "Open on their CNC Programmer posting.", discipline: "cam" }],
    outreach: {
      subject: "Quick note on your CNC hiring in Denver",
      body: "Saw your CNC Programmer and Mechanical Design Engineer openings. Worth a short conversation.",
    },
  };
  const brief = assembleBrief({ group: MIXED_GROUP, routeCount: 2, generatedAt: "2026-06-04T00:00:00Z", prose });

  it("LLM prose is inferred and carries non-empty sourceRef", () => {
    const summary = brief.executiveSummary;
    expect(summary.provenance).toBe("inferred");
    if (summary.provenance === "inferred") expect(summary.sourceRef?.length).toBeGreaterThan(0);

    for (const p of [...brief.painPoints, ...brief.talkingPoints]) {
      expect(p.text.provenance).toBe("inferred");
      if (p.text.provenance === "inferred") expect(p.text.sourceRef?.length).toBeGreaterThan(0);
    }
  });

  it("outreach draft is inferred from signals and carries non-empty sourceRef", () => {
    expect("subject" in brief.outreach).toBe(true);
    if ("subject" in brief.outreach) {
      expect(brief.outreach.subject.provenance).toBe("inferred");
      expect(brief.outreach.body.provenance).toBe("inferred");
      if (brief.outreach.body.provenance === "inferred") {
        expect(brief.outreach.body.sourceRef?.length).toBeGreaterThan(0);
      }
    }
  });

  it("each pain point carries a COMPUTED severity that recomputes to its value", () => {
    expect(brief.painPoints.length).toBeGreaterThan(0);
    for (const p of brief.painPoints) {
      expect(p.severity.provenance).toBe("computed");
      expect(p.severity.sourceRef.length).toBeGreaterThan(0);
      expect(recompute(p.severity)).toBe(p.severity.value);
      // the solution slot is a visible pending gap, never invented prose
      expect(p.solution.provenance).toBe("curated");
      expect(isCuratedGap(p.solution)).toBe(true);
    }
  });
});

describe("active vs implied disciplines", () => {
  it("a suite-tool-only discipline is inferred, a directly detected one is detected", () => {
    const suiteGroup = mkGroup(
      [
        mkSignal("n1", {
          title: "Manufacturing Engineer",
          detectedSoftware: [det("NX CAM", ["cad", "cam", "simulation"], true)],
          productTypes: ["cad", "cam", "simulation"],
        }),
      ],
      ["NX CAM"],
      ["cad", "cam", "simulation"]
    );
    const brief = assembleBrief({ group: suiteGroup, routeCount: 1, generatedAt: "2026-06-04T00:00:00Z" });
    // All three disciplines come only from the NX suite tool, so all are inferred.
    expect(brief.disciplines.every((d) => d.provenance === "inferred")).toBe(true);

    // Mastercam (single-discipline) makes cam directly detected.
    const camField = assembleBrief({
      group: MIXED_GROUP,
      routeCount: 2,
      generatedAt: "2026-06-04T00:00:00Z",
    }).disciplines.find((d) => (d.value as string).toLowerCase() === "cam");
    expect(camField?.provenance).toBe("detected");
  });
});
