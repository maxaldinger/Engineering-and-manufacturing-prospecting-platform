import { describe, it, expect } from "vitest";
import { buildDiscoveryQuery, routeQueryTerms } from "./query";
import { ROUTE_GTM } from "./routes";
import {
  ALL_PRODUCT_TYPES,
  competitorsForType,
  PRODUCT_TYPE_BY_ID,
} from "@/lib/catalog";
import type { ProductTypeId } from "@/types/product";

const ALL_IDS = ALL_PRODUCT_TYPES.map((t) => t.id);

describe("discovery route query construction", () => {
  it("derives software + keywords + ourProducts from the catalog for every type", () => {
    for (const id of ALL_IDS) {
      const q = buildDiscoveryQuery(id);
      const expectedSoftware = competitorsForType(id)
        .map((c) => c.name)
        .sort();
      expect([...q.software].sort()).toEqual(expectedSoftware);
      expect(q.keywords).toEqual([...PRODUCT_TYPE_BY_ID[id].relevanceKeywords]);
      expect(q.ourProducts).toEqual([...PRODUCT_TYPE_BY_ID[id].ourProducts]);
    }
  });

  it("carries the GTM role + sector lists verbatim for every type", () => {
    for (const id of ALL_IDS) {
      const q = buildDiscoveryQuery(id);
      expect(q.roles).toEqual(ROUTE_GTM[id].roles);
      expect(q.sectors).toEqual(ROUTE_GTM[id].sectors);
      // A thin list is a discovery-quality problem the human edit pass owns; an
      // EMPTY list is a wiring bug — the route would search for nothing.
      expect(q.roles.length).toBeGreaterThan(0);
      expect(q.sectors.length).toBeGreaterThan(0);
    }
  });
});

// Positive: the term MUST be in the route. Negative: it MUST NOT. The .not
// assertion is what proves SCOPING (not just that a route produces output) —
// same rigor as the Unclassified-128 filter test and the brief draft guard.
//
// Every anchor is CATALOG-derived (competitor names / detection keywords /
// relevance keywords), all frozen by the detection golden snapshot. So the
// human GTM edit pass on roles/sectors can rewrite every list here without
// breaking scoping — the proof rests on the catalog half of the query.
const SCOPING: {
  id: ProductTypeId;
  includes: string[];
  excludes: string[];
}[] = [
  {
    id: "cam",
    includes: ["mastercam", "gibbscam", "cnc programmer", "toolpath"],
    excludes: ["ansys", "fea", "catia", "autocad electrical", "tacton", "stratasys"],
  },
  {
    id: "simulation",
    includes: ["ansys", "abaqus", "comsol", "fea", "finite element"],
    excludes: ["mastercam", "gibbscam", "cnc programmer", "catia", "autocad electrical", "stratasys"],
  },
  {
    id: "cad",
    includes: ["catia", "creo", "solid edge", "mechanical design"],
    excludes: ["mastercam", "ansys", "autocad electrical", "tacton", "stratasys"],
  },
  {
    id: "electrical",
    includes: ["autocad electrical", "eplan", "schematic capture"],
    excludes: ["mastercam", "ansys", "catia", "tacton", "stratasys"],
  },
  {
    id: "design-automation",
    includes: ["tacton", "configit", "design automation"],
    excludes: ["mastercam", "ansys", "catia", "autocad electrical", "stratasys"],
  },
  {
    id: "additive",
    includes: ["stratasys", "formlabs", "additive manufacturing", "3d printing"],
    excludes: ["mastercam", "ansys", "catia", "autocad electrical", "tacton"],
  },
  {
    id: "mfg-services",
    includes: ["implementation services", "cad migration", "training"],
    excludes: ["mastercam", "ansys", "catia", "autocad electrical", "tacton", "stratasys"],
  },
];

describe("discovery route scoping (positive AND negative)", () => {
  for (const { id, includes, excludes } of SCOPING) {
    it(`${id} route emits its own terms and none of the other routes'`, () => {
      const terms = routeQueryTerms(id);
      for (const t of includes) expect(terms).toContain(t);
      for (const t of excludes) expect(terms).not.toContain(t);
    });
  }
});

// Stronger structural proof: each type's single-category flagship term appears
// in its OWN route and NO other (all 7x7 pairs). Catches a future catalog edit
// that accidentally cross-tags a competitor, which the hand-picked table above
// might miss.
const FLAGSHIP: Record<ProductTypeId, string> = {
  cam: "mastercam",
  cad: "catia",
  simulation: "ansys",
  electrical: "autocad electrical",
  "design-automation": "tacton",
  additive: "stratasys",
  "mfg-services": "implementation services",
};

describe("single-category flagships never leak across routes", () => {
  for (const owner of ALL_IDS) {
    const term = FLAGSHIP[owner];
    it(`only the ${owner} route contains "${term}"`, () => {
      for (const other of ALL_IDS) {
        expect(routeQueryTerms(other).includes(term)).toBe(other === owner);
      }
    });
  }
});
