import type { Country } from "@/lib/signal-sources/state-codes";

export type { Country };
export type PlaceType = "state" | "city";

// A confirmed, disambiguated location. The territory input resolves the rep's
// text to one of these via the geocoder's candidate list — never a silent
// guess. `code` is always a state/province 2-letter code (used by region-level
// sources); a city additionally carries `lat`/`lng` for radius filtering.
export interface Place {
  type: PlaceType;
  name: string; // "Washington", "Detroit", "District of Columbia"
  code: string; // state/province code; for a city, the state it sits in
  country: Country;
  lat?: number; // city only — used for radius
  lng?: number; // city only
  label: string; // disambiguation display, e.g. "Detroit, MI" / "Washington (state-wide)"
}

// A geocoder returns CANDIDATES for disambiguation. It never auto-resolves —
// the UI requires the rep to confirm one, so an ambiguous query like "washington"
// can never be silently sent to the wrong region. Swappable behind this
// interface (local gazetteer, Nominatim, a paid Places provider later).
export interface Geocoder {
  geocode(query: string): Promise<Place[]>;
}
