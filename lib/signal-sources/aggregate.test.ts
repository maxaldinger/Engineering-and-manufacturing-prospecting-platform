import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { aggregateSignals } from "./aggregate";
import type { Place } from "@/lib/geocode/types";
import type { AdzunaResponse } from "./adzuna";

// A page of Adzuna SIMULATION jobs. Greenhouse is a ~22-company manufacturing
// list and trade-press RSS skews CAM, so on a non-CAM route Adzuna carries the
// load — this fixture is what it returns.
const ADZUNA_SIM: AdzunaResponse = {
  results: [
    {
      id: 901,
      title: "FEA Engineer",
      description:
        "Structural and thermal stress analysis using Ansys for turbine components.",
      company: { display_name: "Turbine Dynamics Inc" },
      location: { display_name: "Wichita, Kansas" },
      redirect_url: "https://www.adzuna.com/job/901",
      created: "2026-05-20T12:00:00Z",
    },
    {
      id: 902,
      title: "Simulation Engineer (CFD)",
      description: "Computational fluid dynamics modeling for aerospace structures.",
      company: { display_name: "Aero Analysis LLC" },
      location: { display_name: "Wichita, Kansas" },
      redirect_url: "https://www.adzuna.com/job/902",
      created: "2026-05-22T12:00:00Z",
    },
  ],
};

function res(json: unknown, text = ""): unknown {
  return { ok: true, status: 200, json: async () => json, text: async () => text };
}

// PERMANENT TEST. The whole point of the free baseline is that it generalizes
// past CAM. CAM-without-ZoomInfo is trivial (Greenhouse + Adzuna both cover it);
// a NON-CAM route with ZoomInfo absent is the real proof — and it rests on
// Adzuna carrying the load.
describe("free baseline yields results for a NON-CAM route, ZoomInfo absent", () => {
  beforeEach(() => {
    process.env.ADZUNA_APP_ID = "test-id";
    process.env.ADZUNA_APP_KEY = "test-key";
    // Force ZoomInfo unconfigured -> skipped, so this is the FREE baseline alone.
    delete process.env.ZOOMINFO_USERNAME;
    delete process.env.ZOOMINFO_PASSWORD;
    delete process.env.ZOOMINFO_CLIENT_ID;
    delete process.env.ZOOMINFO_PRIVATE_KEY;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.includes("api.adzuna.com")) return res(ADZUNA_SIM);
        // Every other source (USAspending, Greenhouse boards, RSS feeds) returns
        // empty, so the only signals that survive are Adzuna's.
        return res({ results: [], jobs: [] }, "");
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;
  });

  it("returns Simulation signals from Adzuna with no ZoomInfo", async () => {
    const place: Place = {
      type: "state",
      name: "Kansas",
      code: "KS",
      country: "US",
      label: "Kansas (state-wide)",
    };
    const { signals, meta } = await aggregateSignals(place, "state", "simulation");

    expect(signals.length).toBeGreaterThan(0);
    expect(signals.some((s) => s.productTypes.includes("simulation"))).toBe(true);
    // Every surviving signal is Adzuna's (others mocked empty) — the baseline
    // carried a non-CAM route on its own.
    expect(signals.every((s) => s.sourceLabel.startsWith("Adzuna"))).toBe(true);

    // ZoomInfo really was absent.
    const zi = meta.sources.find((s) => s.name.includes("ZoomInfo"));
    expect(zi?.status).toBe("skipped");
    // The route echo confirms the run was scoped to Simulation.
    expect(meta.route?.productType).toBe("simulation");
  });
});
