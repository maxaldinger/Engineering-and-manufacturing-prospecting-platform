import type { ProductTypeId } from "@/types/product";

// ===========================================================================
// GTM-tunable scoring weights — set these to match go-to-market priorities.
// ===========================================================================
//
// Per-product-type contribution to a signal's strength in scoreSignal. The
// generalization is strictly additive: CAM and CAD keep their legacy weights
// (so a CAM-only or CAD-only signal scores exactly as before), and the other
// five types — which previously contributed nothing — now add here.
//
//   cam  25  preserved (legacy hasCam)
//   cad  10  preserved (legacy hasCadOnly)
//   simulation / electrical / design-automation / additive  15  — these detect
//            real competitor tools; weighted as a real-but-secondary signal.
//   mfg-services  10  — relevance-only (no competitor software to detect), so
//            it weighs less than the competitor-bearing types.
//
// ZoomInfo company ranking does NOT use these weights: it ranks by equal
// detection count (every detected tool +1, all types equal). Weighting there is
// intentionally decoupled.
export const TYPE_WEIGHTS: Record<ProductTypeId, number> = {
  cam: 25,
  cad: 10,
  simulation: 15,
  electrical: 15,
  "design-automation": 15,
  additive: 15,
  "mfg-services": 10,
};
