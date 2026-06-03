import type { Place } from "./types";

// Known cross-state metros. We code a city to a SINGLE state by default, which
// keys region-level sources (USAspending, news) to one state and misses the
// cross-line portion — worst case the DC defense corridor, mostly VA/MD. This
// table drives an HONEST note in the UI (so a rep knows the region-level slice
// is single-state) and is the extension point for promoting a metro to
// multi-region querying later (populate Place.regionCodes from `codes`).
// Radius-capable sources (jobs) span the metro regardless — radius ignores
// state lines. GTM data — edit freely.
export const CROSS_STATE_METROS: {
  match: string[]; // lowercase city-name substrings
  codes: string[]; // the metro's region codes (primary first)
  label: string;
}[] = [
  { match: ["washington", "district of columbia"], codes: ["DC", "VA", "MD"], label: "DC / Northern Virginia / Maryland" },
  { match: ["kansas city"], codes: ["KS", "MO"], label: "Kansas City (KS + MO)" },
  { match: ["new york", "newark", "jersey city"], codes: ["NY", "NJ", "CT"], label: "New York metro (NY + NJ + CT)" },
  { match: ["philadelphia", "camden"], codes: ["PA", "NJ", "DE"], label: "Philadelphia (PA + NJ + DE)" },
  { match: ["st. louis", "saint louis"], codes: ["MO", "IL"], label: "St. Louis (MO + IL)" },
  { match: ["cincinnati"], codes: ["OH", "KY", "IN"], label: "Cincinnati (OH + KY + IN)" },
  { match: ["memphis"], codes: ["TN", "MS", "AR"], label: "Memphis (TN + MS + AR)" },
  { match: ["charlotte"], codes: ["NC", "SC"], label: "Charlotte (NC + SC)" },
];

// If a confirmed CITY is a known cross-state metro, the metro's codes + label;
// otherwise null. Used for the UI's honesty note (not for multi-query — that is
// the deferred extension).
export function crossStateMetro(
  place: Pick<Place, "name" | "type">
): { codes: string[]; label: string } | null {
  if (place.type !== "city") return null;
  const n = place.name.toLowerCase();
  for (const m of CROSS_STATE_METROS) {
    if (m.match.some((x) => n.includes(x))) {
      return { codes: m.codes, label: m.label };
    }
  }
  return null;
}
