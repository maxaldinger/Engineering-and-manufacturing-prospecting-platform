import { describe, it, expect } from "vitest";
import { localGazetteer } from "./gazetteer";
import { parseNominatimResults, type NominatimResult } from "./nominatim";
import { compositeGeocoder } from "./index";
import type { Geocoder, Place } from "./types";

describe("local gazetteer — state-wide candidates, never a silent single guess", () => {
  it("resolves an unambiguous city+state to its state", async () => {
    const c = await localGazetteer.geocode("Detroit, MI");
    expect(c).toEqual([
      { type: "state", name: "Michigan", code: "MI", country: "US", label: "Michigan (state-wide)" },
    ]);
  });

  it("returns ALL matches for an ambiguous city (Portland -> OR + ME)", async () => {
    const codes = (await localGazetteer.geocode("Portland")).map((p) => p.code).sort();
    expect(codes).toEqual(["ME", "OR"]);
  });

  it("returns [] for an unknown place (no guess)", async () => {
    expect(await localGazetteer.geocode("zzzz not a place")).toEqual([]);
  });
});

describe("nominatim parser — fixtures, no network", () => {
  it('disambiguates "washington": state + D.C. + city, drops non-US/CA', () => {
    const fixture: NominatimResult[] = [
      { lat: "47.4", lon: "-120.5", addresstype: "state", name: "Washington", address: { state: "Washington", country_code: "us" } },
      { lat: "38.9", lon: "-77.0", addresstype: "city", name: "Washington", address: { city: "Washington", state: "District of Columbia", country_code: "us" } },
      { lat: "40.17", lon: "-80.24", addresstype: "city", name: "Washington", address: { city: "Washington", state: "Pennsylvania", country_code: "us" } },
      { lat: "51.5", lon: "-0.12", addresstype: "city", name: "London", address: { state: "England", country_code: "gb" } },
    ];
    const places = parseNominatimResults(fixture);
    expect(places).toEqual([
      { type: "state", name: "Washington", code: "WA", country: "US", label: "Washington (state-wide)" },
      { type: "city", name: "Washington", code: "DC", country: "US", lat: 38.9, lng: -77.0, label: "Washington, DC" },
      { type: "city", name: "Washington", code: "PA", country: "US", lat: 40.17, lng: -80.24, label: "Washington, PA" },
    ]);
  });

  it("maps a city to its state code and carries coordinates for radius", () => {
    const places = parseNominatimResults([
      { lat: "42.331", lon: "-83.045", addresstype: "city", name: "Detroit", address: { city: "Detroit", state: "Michigan", country_code: "us" } },
    ]);
    expect(places).toEqual([
      { type: "city", name: "Detroit", code: "MI", country: "US", lat: 42.331, lng: -83.045, label: "Detroit, MI" },
    ]);
  });

  it("skips results that cannot be mapped to a US/CA region", () => {
    expect(
      parseNominatimResults([
        { lat: "0", lon: "0", addresstype: "city", name: "Nowhere", address: { state: "Atlantis", country_code: "us" } },
      ])
    ).toEqual([]);
  });
});

describe("composite geocoder — merge + network fallback", () => {
  const mockNetwork = (places: Place[], fail = false): Geocoder => ({
    async geocode() {
      if (fail) throw new Error("network down");
      return places;
    },
  });

  const detroitCity: Place = {
    type: "city", name: "Detroit", code: "MI", country: "US", lat: 42.33, lng: -83.04, label: "Detroit, MI",
  };

  it("merges network cities with gazetteer state-wide, cities first, deduped", async () => {
    const out = await compositeGeocoder(mockNetwork([detroitCity])).geocode("Detroit, MI");
    expect(out.map((p) => `${p.type}:${p.code}`)).toEqual(["city:MI", "state:MI"]);
  });

  it("falls back to the gazetteer (state-wide only) when the network fails", async () => {
    const out = await compositeGeocoder(mockNetwork([], true)).geocode("Detroit, MI");
    expect(out).toEqual([
      { type: "state", name: "Michigan", code: "MI", country: "US", label: "Michigan (state-wide)" },
    ]);
  });
});
