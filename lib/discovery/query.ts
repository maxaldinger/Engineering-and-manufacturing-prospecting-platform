import type { ProductTypeId } from "@/types/product";
import { competitorsForType, PRODUCT_TYPE_BY_ID } from "@/lib/catalog";
import { ROUTE_GTM } from "./routes";

// A per-product discovery route's query spec. Built fresh per run from two
// sources that never mix:
//   - CATALOG half (software / softwareKeywords / keywords / ourProducts) is
//     derived from lib/catalog and frozen by the detection golden snapshot.
//   - GTM half (roles / sectors) comes from lib/discovery/routes.ts and is the
//     human edit pass.
// The route layer sits IN FRONT of the engine: this spec tells the sources what
// to go looking for, while detection/scoring/fit on what comes back are
// unchanged.
export interface DiscoveryQuery {
  productType: ProductTypeId;
  label: string;
  /** Competitor display names for this type (catalog). */
  software: string[];
  /** Their detection keywords, lowercased + deduped (catalog). */
  softwareKeywords: string[];
  /** The type's relevance keywords (catalog). */
  keywords: string[];
  /** Our portfolio products to position for this type (catalog). */
  ourProducts: string[];
  /** Job-title terms the jobs sources match against (GTM). */
  roles: string[];
  /** Industry verticals the company / contract sources scope to (GTM). */
  sectors: string[];
}

export function buildDiscoveryQuery(id: ProductTypeId): DiscoveryQuery {
  const type = PRODUCT_TYPE_BY_ID[id];
  const competitors = competitorsForType(id);
  const gtm = ROUTE_GTM[id];
  return {
    productType: id,
    label: type.label,
    software: competitors.map((c) => c.name),
    softwareKeywords: dedupeLower(
      competitors.flatMap((c) => [...c.detectionKeywords])
    ),
    keywords: [...type.relevanceKeywords],
    ourProducts: [...type.ourProducts],
    roles: [...gtm.roles],
    sectors: [...gtm.sectors],
  };
}

// Every lowercased LEXICAL term a route searches text with: software names +
// their detection keywords + relevance keywords + GTM roles. Sectors are
// EXCLUDED here — they scope companies/contracts (and overlap across types by
// design, e.g. aerospace buys both CAM and Simulation), so they are not a
// lexical role/keyword match. Used by route-scoped sources to decide if a
// posting/article is on-topic for the route, and by the scoping test.
export function routeQueryTerms(id: ProductTypeId): string[] {
  const q = buildDiscoveryQuery(id);
  return dedupeLower([
    ...q.software,
    ...q.softwareKeywords,
    ...q.keywords,
    ...q.roles,
  ]);
}

function dedupeLower(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const l = x.toLowerCase();
    if (!seen.has(l)) {
      seen.add(l);
      out.push(l);
    }
  }
  return out;
}
