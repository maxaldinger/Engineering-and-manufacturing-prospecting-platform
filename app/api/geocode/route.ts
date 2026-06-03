import { NextRequest, NextResponse } from "next/server";
import { getGeocoder } from "@/lib/geocode";

export const runtime = "nodejs";

// Territory autocomplete. Returns candidate places for the rep to CONFIRM — it
// never resolves on its own, so an ambiguous query is disambiguated by a click,
// not a silent guess. Caching lives in the geocoder's upstream fetch.
export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ candidates: [] });
  }
  try {
    const candidates = await getGeocoder().geocode(q);
    return NextResponse.json({ candidates });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        candidates: [],
        error: err instanceof Error ? err.message : "geocode failed",
      },
      { status: 500 }
    );
  }
}
