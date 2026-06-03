import { regionCandidates } from "@/lib/signal-sources/state-codes";
import type { Geocoder, Place } from "./types";

// Instant, API-free fast-path over the known region/city tables. Returns
// STATE-WIDE candidates only (no coordinates, so no radius) — cities with
// coordinates come from the network geocoder. Also the offline fallback when
// the network geocoder is unavailable, and the test double.
export const localGazetteer: Geocoder = {
  async geocode(query: string): Promise<Place[]> {
    return regionCandidates(query).map((r) => ({
      type: "state",
      name: r.name,
      code: r.code,
      country: r.country,
      label: `${r.name} (state-wide)`,
    }));
  },
};
