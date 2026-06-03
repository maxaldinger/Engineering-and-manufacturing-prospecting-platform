import type { ProductTypeId } from "@/types/product";

// ===========================================================================
// GTM DISCOVERY LISTS — EDIT FREELY. This is go-to-market domain data, not
// engine logic.
//
// For each product type, a discovery route searches for:
//   roles   — job titles a prospect hires for that signal demand for the type.
//             Consumed by the jobs sources (Greenhouse today, Adzuna in Step 4)
//             to decide which postings are on-topic for the route.
//   sectors — industry verticals where the type sells. Consumed by the company
//             / contract sources to scope which organizations to look at.
//
// These lists drive DISCOVERY QUALITY — what a route goes looking for. They are
// deliberately SEPARATE from the catalog's detection keywords (lib/catalog),
// which decide what a found signal IS and are frozen by the detection golden
// snapshot. Editing a list here changes what a route searches for; it can never
// break detection, scoring, or the route-scoping test (those anchor on the
// catalog half of the query, not these lists).
//
// A THIN list = thin discovery for that type. No test can catch a thin list,
// only that a route uses it — so curating these is the human edit pass, not a
// rubber-stamp. Seeded below with a starter set per type.
// ===========================================================================

export interface RouteGtm {
  /** Job-title terms the jobs sources match postings against. */
  roles: string[];
  /** Industry verticals the company / contract sources scope to. */
  sectors: string[];
}

export const ROUTE_GTM: Record<ProductTypeId, RouteGtm> = {
  cam: {
    roles: [
      "cnc programmer",
      "cnc machinist",
      "cam programmer",
      "cam engineer",
      "nc programmer",
      "manufacturing engineer",
      "tooling engineer",
      "machine programmer",
      "5-axis programmer",
      "mill-turn programmer",
      "swiss machinist",
      "manufacturing process engineer",
    ],
    sectors: [
      "aerospace",
      "defense",
      "medical device",
      "automotive",
      "contract manufacturing",
      "job shop",
      "machine shop",
      "precision machining",
      "mold and die",
      "industrial equipment",
    ],
  },
  cad: {
    roles: [
      "mechanical design engineer",
      "mechanical engineer",
      "design engineer",
      "product design engineer",
      "cad designer",
      "design drafter",
      "product development engineer",
      "r&d engineer",
    ],
    sectors: [
      "industrial equipment",
      "consumer products",
      "medical device",
      "aerospace",
      "automotive",
      "machinery",
      "electronics",
      "packaging",
    ],
  },
  simulation: {
    roles: [
      "simulation engineer",
      "fea engineer",
      "fea analyst",
      "cfd engineer",
      "cae engineer",
      "stress analyst",
      "structural analyst",
      "thermal analyst",
      "analysis engineer",
      "design analyst",
    ],
    sectors: [
      "aerospace",
      "defense",
      "automotive",
      "medical device",
      "energy",
      "electronics",
      "consumer products",
      "industrial equipment",
    ],
  },
  electrical: {
    roles: [
      "electrical design engineer",
      "electrical engineer",
      "controls engineer",
      "control systems engineer",
      "panel designer",
      "automation engineer",
      "electrical drafter",
      "wiring harness engineer",
    ],
    sectors: [
      "industrial automation",
      "machinery",
      "controls and panel building",
      "automotive",
      "aerospace",
      "energy and utilities",
      "robotics",
      "building systems",
    ],
  },
  "design-automation": {
    roles: [
      "design automation engineer",
      "engineering automation specialist",
      "applications engineer",
      "configurator developer",
      "solutions engineer",
      "sales engineer",
      "automation engineer",
    ],
    sectors: [
      "engineer-to-order manufacturing",
      "configure-to-order",
      "industrial machinery",
      "building products",
      "capital equipment",
      "modular construction",
      "material handling",
    ],
  },
  additive: {
    roles: [
      "additive manufacturing engineer",
      "am engineer",
      "3d printing engineer",
      "rapid prototyping engineer",
      "am applications engineer",
      "am technician",
      "additive process engineer",
    ],
    sectors: [
      "aerospace",
      "medical device",
      "dental",
      "automotive",
      "consumer products",
      "tooling and fixtures",
      "defense",
      "research and education",
    ],
  },
  "mfg-services": {
    // Services route: roles are titles that signal a CAD/CAM rollout, migration,
    // or standardization effort (who buys implementation / training / support),
    // not a competing-software signal.
    roles: [
      "engineering manager",
      "design engineering manager",
      "cad administrator",
      "plm administrator",
      "engineering operations manager",
      "design systems manager",
    ],
    sectors: [
      "contract manufacturing",
      "aerospace",
      "medical device",
      "automotive",
      "industrial equipment",
      "job shop",
    ],
  },
};
