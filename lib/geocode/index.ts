import { localGazetteer } from "./gazetteer";
import { nominatimGeocoder } from "./nominatim";
import type { Geocoder, Place } from "./types";

export type { Geocoder, Place, PlaceType, Country } from "./types";
export { localGazetteer } from "./gazetteer";
export { nominatimGeocoder, parseNominatimResults } from "./nominatim";

// Dedupe + order candidates. Ordering: an EXACT state-name match floats to the
// very top (so "Washington" surfaces WA state, not buried under DC/PA cities),
// then cities (most specific, carry coordinates), then the remaining states.
// A state is never listed twice.
export function mergeCandidates(
  local: Place[],
  remote: Place[],
  query = ""
): Place[] {
  const out: Place[] = [];
  const seen = new Set<string>();
  const key = (p: Place) =>
    p.type === "state" ? `state:${p.code}` : `city:${p.code}:${p.name.toLowerCase()}`;
  for (const p of [...remote, ...local]) {
    const k = key(p);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  const q = query.trim().toLowerCase();
  const rank = (p: Place) => {
    if (p.type === "state" && p.name.toLowerCase() === q) return 0;
    return p.type === "city" ? 1 : 2;
  };
  return out.sort((a, b) => rank(a) - rank(b));
}

// Local gazetteer (instant state-wide candidates) + network geocoder (cities
// with coordinates + richer disambiguation). Network failure degrades to the
// gazetteer alone, so state-wide search still works offline / rate-limited.
export function compositeGeocoder(network: Geocoder = nominatimGeocoder): Geocoder {
  return {
    async geocode(query: string): Promise<Place[]> {
      const [local, remote] = await Promise.all([
        localGazetteer.geocode(query),
        network.geocode(query).catch((err) => {
          console.warn(
            `geocode: network provider failed (${
              err instanceof Error ? err.message : String(err)
            }); falling back to the local gazetteer (state-wide only).`
          );
          return [] as Place[];
        }),
      ]);
      return mergeCandidates(local, remote, query);
    },
  };
}

// Provider selection. Add a paid Places provider here and set GEOCODER to swap
// it in — config, not a rewrite.
export function getGeocoder(): Geocoder {
  switch (process.env.GEOCODER) {
    case "local":
      return localGazetteer;
    case "nominatim":
    default:
      return compositeGeocoder();
  }
}
