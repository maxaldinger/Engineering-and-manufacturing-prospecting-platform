import { ALL_REGIONS } from "@/lib/signal-sources/state-codes";
import { BRAND } from "@/lib/brand";
import type { Country, Geocoder, Place } from "./types";

// Raw Nominatim (OpenStreetMap) search result (jsonv2 + addressdetails).
export interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  type?: string;
  addresstype?: string;
  address?: {
    state?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    country_code?: string;
  };
}

const NAME_TO_CODE = new Map(
  ALL_REGIONS.map((r) => [r.name.toLowerCase(), r.code] as const)
);

function stateCode(name?: string): string | undefined {
  return name ? NAME_TO_CODE.get(name.toLowerCase()) : undefined;
}

// Pure parse: Nominatim results -> Place[] candidates. Results that don't map to
// a US/CA region we can query are skipped. Exported so tests can feed fixtures
// without hitting the network.
export function parseNominatimResults(results: NominatimResult[]): Place[] {
  const out: Place[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    const cc = r.address?.country_code?.toUpperCase();
    const country: Country | undefined =
      cc === "US" ? "US" : cc === "CA" ? "CA" : undefined;
    if (!country) continue;

    const isState = r.addresstype === "state" || r.type === "state";
    if (isState) {
      const name = r.name ?? r.address?.state;
      const code = stateCode(name);
      if (!name || !code) continue;
      const key = `state:${code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ type: "state", name, code, country, label: `${name} (state-wide)` });
    } else {
      const name =
        r.name ?? r.address?.city ?? r.address?.town ?? r.address?.village;
      const code = stateCode(r.address?.state);
      const lat = Number.parseFloat(r.lat);
      const lng = Number.parseFloat(r.lon);
      if (!name || !code || Number.isNaN(lat) || Number.isNaN(lng)) continue;
      const key = `city:${code}:${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ type: "city", name, code, country, lat, lng, label: `${name}, ${code}` });
    }
  }
  return out;
}

export const nominatimGeocoder: Geocoder = {
  async geocode(query: string): Promise<Place[]> {
    const q = query.trim();
    if (!q) return [];
    const url =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({
        q,
        format: "jsonv2",
        addressdetails: "1",
        countrycodes: "us,ca",
        limit: "8",
      }).toString();
    const res = await fetch(url, {
      headers: { "User-Agent": BRAND.userAgent },
      next: { revalidate: 86400 }, // 1 day — places don't move
    });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const data = (await res.json()) as NominatimResult[];
    return parseNominatimResults(data);
  },
};
