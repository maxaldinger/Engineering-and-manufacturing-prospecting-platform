// The product-type dimension — the new top-level axis the whole tool segments
// by. Adding an 8th product type is a DATA change: add one id to this union,
// one entry to PRODUCT_TYPES in lib/catalog, and tag competitors with it. No
// component or control-flow changes required.
export type ProductTypeId =
  | "cad"
  | "cam"
  | "simulation"
  | "electrical"
  | "design-automation"
  | "additive"
  | "mfg-services";

// Metadata for one product type. Pure description: it does NOT own a competitor
// list. Competitors are multi-category and live in a flat list queried by type,
// which is exactly what lets a suite tool (NX) belong to cad + cam + simulation
// at once without being duplicated.
export interface ProductType {
  id: ProductTypeId;
  // Display label, e.g. "Simulation (FEA/CFD)".
  label: string;
  description: string;
  // Portfolio products WE sell in this category (the SOLIDWORKS / Dassault +
  // partner catalog, unbranded). Real data — this is the reseller portfolio.
  ourProducts: readonly string[];
  // Terms that mark a signal relevant to THIS type even when no competitor tool
  // is named. Generalizes the old camRelevant / CAM_ADJACENT_KEYWORDS. For
  // non-CAM types these are a starter set pending a domain-SME pass.
  relevanceKeywords: readonly string[];
  // Whether the type's filter chip starts on. Defaults to on when omitted.
  enabledByDefault?: boolean;
  // How this type is discovered. "route" (default) = a selectable discovery
  // route with its own source scoping. "derived" = NOT cold-discovered; inferred
  // from cross-route signals and surfaced as a flag. mfg-services is "derived":
  // services attach to transition events (multi-discipline hiring = scaling), not
  // a static search, so a cold route over-matches.
  discoveryMode?: "route" | "derived";
}

// A competitor / incumbent tool we can detect and (usually) displace.
//
// productTypes is an ARRAY (locked design decision): single-discipline tools
// carry one type (Mastercam -> ["cam"]); genuine suites carry several
// (Fusion 360 -> ["cad","cam"], NX -> ["cad","cam","simulation"]). A keyword
// never expands into multiple types on its own — types are a curated property
// of the matched PRODUCT, so ambiguity can't fan out (see lib/catalog).
export interface CompetitorProduct {
  name: string;
  vendor: string;
  productTypes: readonly ProductTypeId[];
  marketShareTier?: "primary" | "secondary" | "niche";
  detectionKeywords: readonly string[];
  // What we displace it with. Optional: some tools are tracked for stack
  // awareness without an authoritative displacement mapping yet.
  fit?: {
    replacement: string;
    secondary?: string;
    reasons: readonly string[];
  };
  // True for seed data whose marketShareTier, detectionKeywords, AND fit are
  // NOT authoritative and need a domain-SME pass. CAM is fully real (never
  // draft); the other product types are seeded minimally with draft: true.
  draft?: boolean;
}

// A portfolio product of OURS that we also detect in a prospect's stack — a
// warm signal (they already run part of the catalog) rather than a displacement
// target. Shares the detection shape but never carries a fit.
export interface PortfolioProduct {
  name: string;
  vendor: string;
  productTypes: readonly ProductTypeId[];
  detectionKeywords: readonly string[];
}
