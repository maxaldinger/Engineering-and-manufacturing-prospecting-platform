import { localGazetteer } from "./gazetteer";
import { nominatimGeocoder } from "./nominatim";
import type { Geocoder, Place } from "./types";

export type { Geocoder, Place, PlaceType, Country } from "./types";
export { localGazetteer } from "./gazetteer";
export { nominatimGeocoder, parseNominatimResults } from "./nominatim";

// Dedupe + order candidates: cities (most specific, carry coordinates) first,
// then state-wide. A state is never listed twice.
export function mergeCandidates(local: Place[], remote: Place[]): Place[] {
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
  return out.sort((a, b) => (a.type === b.type ? 0 : a.type === "city" ? -1 : 1));
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
      return mergeCandidates(local, remote);
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
