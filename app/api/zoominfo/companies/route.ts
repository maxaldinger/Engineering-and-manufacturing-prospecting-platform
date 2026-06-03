import { NextRequest, NextResponse } from "next/server";
import { detectRegion } from "@/lib/signal-sources/state-codes";
import {
  fetchZoomInfoSignals,
  isZoomInfoConfigured,
} from "@/lib/signal-sources/zoominfo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/zoominfo/companies?location=Michigan
//
// Territory company discovery via ZoomInfo: returns enriched manufacturers in
// the territory as Signal[] (signalType "Tech Adoption", with real contacts
// attached). This is the same data the main /api/signals feed blends in; it is
// exposed standalone so it can be consumed directly or tested in isolation.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location = (searchParams.get("location") ?? "").trim();

  if (!isZoomInfoConfigured()) {
    return NextResponse.json({
      signals: [],
      meta: {
        configured: false,
        message:
          "ZoomInfo is not configured. Set ZOOMINFO_USERNAME plus ZOOMINFO_PASSWORD or ZOOMINFO_CLIENT_ID + ZOOMINFO_PRIVATE_KEY.",
      },
    });
  }

  if (!location) {
    return NextResponse.json({
      signals: [],
      meta: { configured: true, message: "Provide a ?location= query param." },
    });
  }

  const region = detectRegion(location);
  if (!region) {
    return NextResponse.json({
      signals: [],
      meta: {
        configured: true,
        unrecognized: location,
        message:
          "Could not resolve location to a US state or Canadian province.",
      },
    });
  }

  try {
    const signals = await fetchZoomInfoSignals(region.code, region.country);
    return NextResponse.json({
      signals,
      meta: {
        configured: true,
        region: { code: region.code, name: region.name, country: region.country },
        totalCount: signals.length,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        signals: [],
        meta: {
          configured: true,
          error: err instanceof Error ? err.message : "ZoomInfo request failed",
        },
      },
      { status: 502 }
    );
  }
}
