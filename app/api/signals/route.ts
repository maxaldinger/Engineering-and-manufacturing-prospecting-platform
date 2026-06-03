import { NextRequest, NextResponse } from "next/server";
import { aggregateSignals } from "@/lib/signal-sources/aggregate";
import type { Place, PlaceType, Country } from "@/lib/geocode/types";
import { PRODUCT_TYPE_BY_ID } from "@/lib/catalog";
import type { ProductTypeId } from "@/types/product";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live signal endpoint. Takes a CONFIRMED place (from /api/geocode, picked by the
// rep) rather than a free-text location, so signals can never be sent to a
// silently-guessed region. Radius is threaded for the geo-capable jobs engine;
// current sources are state-level (see aggregate meta.territory).
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const code = (sp.get("code") ?? "").trim().toUpperCase();
  const radius = (sp.get("radius") ?? "state").trim();
  // Validate the discovery route against known product types; an unknown value
  // is dropped (undefined) rather than echoed back.
  const productParam = (sp.get("product") ?? "").trim();
  const product =
    productParam in PRODUCT_TYPE_BY_ID
      ? (productParam as ProductTypeId)
      : undefined;

  if (!code) {
    return NextResponse.json({
      signals: [],
      meta: {
        sources: [],
        totalCount: 0,
        message: "Confirm a territory to pull live signals.",
      },
    });
  }

  const lat = sp.get("lat");
  const lng = sp.get("lng");
  const place: Place = {
    type: (sp.get("type") === "city" ? "city" : "state") as PlaceType,
    name: sp.get("name") ?? code,
    code,
    country: (sp.get("country") === "CA" ? "CA" : "US") as Country,
    lat: lat ? Number.parseFloat(lat) : undefined,
    lng: lng ? Number.parseFloat(lng) : undefined,
    label: sp.get("label") ?? sp.get("name") ?? code,
  };

  try {
    const { signals, meta } = await aggregateSignals(place, radius, product);
    return NextResponse.json({ signals, meta });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        signals: [],
        meta: {
          sources: [],
          totalCount: 0,
          error: err instanceof Error ? err.message : "Aggregation failed",
        },
      },
      { status: 500 }
    );
  }
}
