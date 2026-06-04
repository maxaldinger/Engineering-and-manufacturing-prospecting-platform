import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { aggregateSignals } from "./aggregate";
import { routeQueryTerms } from "@/lib/discovery";
import { ALL_PRODUCT_TYPES } from "@/lib/catalog";
import { MFG_NAICS_PREFIXES } from "./extract";
import type { Place } from "@/lib/geocode/types";
import type { AdzunaResponse } from "./adzuna";

const KANSAS: Place = {
  type: "state",
  name: "Kansas",
  code: "KS",
  country: "US",
  label: "Kansas (state-wide)",
};

function res(json: unknown, text = ""): unknown {
  return { ok: true, status: 200, json: async () => json, text: async () => text };
}

// Configure Adzuna, force ZoomInfo absent, and route every fetch: Adzuna URLs ->
// the given fixture; every other source -> empty. So the only signals that
// survive are Adzuna's (the free baseline alone).
function stubFreeBaseline(adzuna: AdzunaResponse) {
  process.env.ADZUNA_APP_ID = "test-id";
  process.env.ADZUNA_APP_KEY = "test-key";
  delete process.env.ZOOMINFO_USERNAME;
  delete process.env.ZOOMINFO_PASSWORD;
  delete process.env.ZOOMINFO_CLIENT_ID;
  delete process.env.ZOOMINFO_PRIVATE_KEY;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("api.adzuna.com")) return res(adzuna);
      return res({ results: [], jobs: [] }, "");
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ADZUNA_APP_ID;
  delete process.env.ADZUNA_APP_KEY;
});

// PERMANENT TEST #1. The free baseline must generalize past CAM. CAM-without-
// ZoomInfo is trivial; a NON-CAM route with ZoomInfo absent is the real proof,
// and it rests on Adzuna carrying the load.
describe("free baseline yields results for a NON-CAM route, ZoomInfo absent", () => {
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

  beforeEach(() => stubFreeBaseline(ADZUNA_SIM));

  it("returns Simulation signals from Adzuna with no ZoomInfo", async () => {
    const { signals, meta } = await aggregateSignals(KANSAS, "state", "simulation");

    expect(signals.length).toBeGreaterThan(0);
    expect(signals.some((s) => s.productTypes.includes("simulation"))).toBe(true);
    expect(signals.every((s) => s.sourceLabel.startsWith("Adzuna"))).toBe(true);

    const zi = meta.sources.find((s) => s.name.includes("ZoomInfo"));
    expect(zi?.status).toBe("skipped");
    expect(meta.route?.productType).toBe("simulation");
  });
});

// PERMANENT TEST #2. Gate-scoping: a route's DISCOVERY carries no manufacturing-
// NAICS gate. The mfg-NAICS/SIC filters live only in the product-agnostic
// supplements (USAspending/ZoomInfo) and are additive — they must never narrow a
// route's discovery to manufacturers and drop, say, a research lab the Simulation
// route legitimately found.
describe("route discovery applies no mfg-NAICS gate", () => {
  it("no route's query terms contain a manufacturing NAICS prefix (structural)", () => {
    for (const t of ALL_PRODUCT_TYPES) {
      const terms = routeQueryTerms(t.id);
      for (const naics of MFG_NAICS_PREFIXES) {
        expect(terms).not.toContain(naics);
      }
    }
  });

  it("keeps a NON-manufacturer prospect the Simulation route found (behavioral)", async () => {
    const ADZUNA_SIM_NONMFG: AdzunaResponse = {
      results: [
        {
          id: 950,
          title: "Simulation Engineer",
          description:
            "FEA and CFD research using Ansys at our national research laboratory.",
          company: { display_name: "Quantum Research Institute" },
          location: { display_name: "Lawrence, Kansas" },
          redirect_url: "https://www.adzuna.com/job/950",
          created: "2026-05-20T12:00:00Z",
        },
      ],
    };
    stubFreeBaseline(ADZUNA_SIM_NONMFG);

    const { signals } = await aggregateSignals(KANSAS, "state", "simulation");

    // A research institute is not a manufacturing-NAICS company, yet the
    // Simulation route surfaces it — proof the route applies no mfg gate.
    expect(signals.some((s) => s.company.includes("Quantum Research"))).toBe(true);
    expect(signals.some((s) => s.productTypes.includes("simulation"))).toBe(true);
  });
});
