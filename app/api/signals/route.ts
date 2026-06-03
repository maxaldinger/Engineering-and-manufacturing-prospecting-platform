import { NextRequest, NextResponse } from "next/server";
import { aggregateSignals } from "@/lib/signal-sources/aggregate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live signal endpoint. Aggregates real signals for a US state or Canadian
// province. No fabricated companies, no synthetic contacts.
//
// Sources wired (see lib/signal-sources/aggregate.ts):
// - ZoomInfo - territory company discovery, firmographics, installed CAM/CAD
//   technology detection, and real decision-maker contacts. Primary source;
//   runs when ZOOMINFO_* credentials are set, otherwise reported as "skipped".
// - USAspending.gov (https://api.usaspending.gov/) - federal manufacturing
//   contract awards, filtered to manufacturing NAICS in the rep's state. No auth.
// - Greenhouse public boards - CNC / CAM / machinist job postings. No auth.
// - Modern Machine Shop, IndustryWeek, American Machinist, Aerospace
//   Manufacturing and Design via public RSS. No auth.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location = searchParams.get("location") || "";

  if (!location.trim()) {
    return NextResponse.json({
      signals: [],
      meta: {
        sources: [],
        totalCount: 0,
        message: "Type a state, province, or city to pull live signals.",
      },
    });
  }

  try {
    const { signals, meta } = await aggregateSignals(location);
    return NextResponse.json({ signals, meta });
  } catch (err: any) {
    return NextResponse.json(
      {
        signals: [],
        meta: {
          sources: [],
          totalCount: 0,
          error: err?.message ?? "Aggregation failed",
        },
      },
      { status: 500 }
    );
  }
}
