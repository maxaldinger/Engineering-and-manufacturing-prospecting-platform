import { describe, it, expect } from "vitest";
import {
  detectProducts,
  productTypesForText,
  COMPETITORS,
  PORTFOLIO,
  type CatalogProductName,
} from "@/lib/catalog";

// FROZEN GOLDEN SNAPSHOT of CAM detection. Captured from detectProducts while
// the legacy detectCamMentions oracle still existed and the two were proven
// equal (see git history). The oracle has since been deleted; THIS snapshot is
// now the regression truth. If a catalog/keyword/regex change moves CAM
// detection, these expected values must be re-reviewed deliberately, never
// updated to silence a failure.
const GOLDEN: { input: string; expected: CatalogProductName[] }[] = [
  { input: "CNC Programmer - 5+ years Mastercam experience required, 5-axis milling.", expected: ["Mastercam"] },
  { input: "We run GibbsCAM and SolidWorks across our Swiss-type department.", expected: ["GibbsCAM", "SolidWorks"] },
  { input: "Manufacturing Engineer familiar with Esprit CAM and post processor development.", expected: ["Esprit"] },
  { input: "Shop uses Autodesk Fusion 360 for CAD/CAM on prototype runs.", expected: ["Fusion 360"] },
  { input: "Siemens NX CAM programming for aerospace structural parts.", expected: ["NX CAM"] },
  { input: "Looking for an HSMWorks / Inventor CAM programmer.", expected: ["HSMWorks"] },
  { input: "BobCAD-CAM operator, milling and turning, manual setups.", expected: ["BobCAD-CAM"] },
  { input: "Detected stack: SOLIDWORKS, CAMWorks, SOLIDWORKS PDM Professional.", expected: ["CAMWorks", "SolidWorks"] },
  { input: "Edgecam and Surfcam legacy programs being migrated this year.", expected: ["Edgecam", "Surfcam"] },
  { input: "FeatureCAM feature-based programming plus CATIA V5 data exchange.", expected: ["CATIA", "FeatureCAM"] },
  { input: "General machinist role, manual lathes, no CAM package named.", expected: [] },
];

function names(list: { name: string }[]): string[] {
  return list.map((d) => d.name).sort();
}

const ALL_DETECTABLES = [...COMPETITORS, ...PORTFOLIO];

describe("CAM detection — frozen golden snapshot", () => {
  for (const { input, expected } of GOLDEN) {
    it(`detects ${JSON.stringify(expected)} for: "${input.slice(0, 40)}..."`, () => {
      expect(names(detectProducts(input))).toEqual([...expected].sort());
    });
  }
});

describe("known-CAM inputs still classify as CAM", () => {
  for (const { input, expected } of GOLDEN) {
    // Which of the frozen names does the catalog tag as a CAM product?
    const camNames = expected.filter((n) => {
      const p = ALL_DETECTABLES.find((x) => x.name === n);
      return p?.productTypes.some((t) => t === "cam");
    });
    if (camNames.length === 0) continue; // not a CAM-naming input

    it(`cam ∈ productTypes for: "${input.slice(0, 40)}..."`, () => {
      const types = new Set(detectProducts(input).flatMap((d) => d.productTypes));
      expect(types.has("cam")).toBe(true);
    });
  }
});

describe("keyword uniqueness: one keyword maps to exactly one product", () => {
  it("no detection keyword is registered under two products", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const p of ALL_DETECTABLES) {
      for (const kw of p.detectionKeywords) {
        const key = kw.toLowerCase();
        const owner = seen.get(key);
        if (owner && owner !== p.name) {
          dupes.push(`"${kw}" claimed by both ${owner} and ${p.name}`);
        }
        seen.set(key, p.name);
      }
    }
    expect(dupes).toEqual([]);
  });
});

describe("fallback: unmatched text is Unclassified, not dropped", () => {
  const UNMATCHED = [
    "We provide corporate catering and event staffing services.",
    "Hiring a payroll administrator and an office receptionist.",
    "",
  ];
  for (const input of UNMATCHED) {
    it(`productTypes:[] and no detections for: "${input.slice(0, 30)}"`, () => {
      expect(detectProducts(input)).toEqual([]);
      expect(productTypesForText(input)).toEqual([]);
    });
  }

  it("a manufacturing contract with no named tool still yields []", () => {
    // USAspending-style description: manufacturing-relevant but names no
    // CAD/CAM/sim tool. Must classify as [] (Unclassified), surfaced via
    // manufacturingRelevant rather than a product type.
    const desc =
      "Award for fabrication and assembly of steel brackets per drawing.";
    expect(productTypesForText(desc)).toEqual([]);
  });
});

describe("catalog name type is derived from catalog keys", () => {
  it("detected names are assignable to CatalogProductName", () => {
    // Compile-time guard: if detectProducts widened name to string, this
    // assignment would fail typecheck.
    const sample: CatalogProductName | undefined = detectProducts(
      "Mastercam shop"
    )[0]?.name;
    expect(sample).toBe("Mastercam");
  });
});
