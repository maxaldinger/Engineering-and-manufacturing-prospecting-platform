import { describe, it, expect } from "vitest";
import {
  detectProducts,
  COMPETITORS,
  PORTFOLIO,
  type CatalogProductName,
} from "@/lib/catalog";
import { detectCamMentions } from "@/lib/signal-sources/extract";

// Real CAM-domain inputs: job-posting prose, ZoomInfo tech strings, news
// snippets. The golden assertion is that the NEW catalog detector reproduces
// the LEGACY detectCamMentions name set exactly — multi-type enrichment on the
// new side is additive and must not change which products are detected.
const CAM_INPUTS: string[] = [
  "CNC Programmer - 5+ years Mastercam experience required, 5-axis milling.",
  "We run GibbsCAM and SolidWorks across our Swiss-type department.",
  "Manufacturing Engineer familiar with Esprit CAM and post processor development.",
  "Shop uses Autodesk Fusion 360 for CAD/CAM on prototype runs.",
  "Siemens NX CAM programming for aerospace structural parts.",
  "Looking for an HSMWorks / Inventor CAM programmer.",
  "BobCAD-CAM operator, milling and turning, manual setups.",
  "Detected stack: SOLIDWORKS, CAMWorks, SOLIDWORKS PDM Professional.",
  "Edgecam and Surfcam legacy programs being migrated this year.",
  "FeatureCAM feature-based programming plus CATIA V5 data exchange.",
  "General machinist role, manual lathes, no CAM package named.",
];

function names(list: { name: string }[]): string[] {
  return list.map((d) => d.name).sort();
}

const ALL_DETECTABLES = [...COMPETITORS, ...PORTFOLIO];

describe("detection parity: new catalog vs legacy detectCamMentions", () => {
  for (const input of CAM_INPUTS) {
    it(`identical name set: "${input.slice(0, 44)}..."`, () => {
      const legacy = names(detectCamMentions(input));
      const next = names(detectProducts(input));
      expect(next).toEqual(legacy);
    });
  }
});

describe("known-CAM inputs still classify as CAM (parity of intent)", () => {
  for (const input of CAM_INPUTS) {
    // Does the legacy detector find a product the catalog tags as CAM?
    const legacyCamNames = detectCamMentions(input)
      .map((d) => d.name)
      .filter((n) => {
        const p = ALL_DETECTABLES.find((x) => x.name === n);
        return p?.productTypes.some((t) => t === "cam");
      });
    if (legacyCamNames.length === 0) continue; // not a CAM-naming input

    it(`cam ∈ productTypes for: "${input.slice(0, 44)}..."`, () => {
      const types = new Set(
        detectProducts(input).flatMap((d) => d.productTypes)
      );
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
