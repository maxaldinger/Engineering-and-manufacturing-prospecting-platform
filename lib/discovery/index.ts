// Discovery routes: the per-product-type query layer that sits IN FRONT of the
// detection/scoring engine. A run picks one product type; its route builds a
// query spec (catalog terms + GTM role/sector lists) that scopes the sources.
export { ROUTE_GTM, type RouteGtm } from "./routes";
export {
  buildDiscoveryQuery,
  routeQueryTerms,
  routeMatches,
  type DiscoveryQuery,
} from "./query";
