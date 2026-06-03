import { NextRequest, NextResponse } from "next/server";
import { isZoomInfoConfigured } from "@/lib/zoominfo/client";
import { enrichCompanies, enrichContacts } from "@/lib/zoominfo/endpoints";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/zoominfo/enrich
//   { "type": "company", "ids": ["123", "456"] }  -> firmographics + tech stack
//   { "type": "contact", "ids": ["789"] }          -> emails, phones, LinkedIn
//
// On-demand enrichment for ids you already have (e.g. from a prior search).
// Returns normalized records. ZoomInfo bills per enriched record, so callers
// should pass only the ids they need (max 25 per call; extras are batched).
export async function POST(req: NextRequest) {
  if (!isZoomInfoConfigured()) {
    return NextResponse.json(
      { data: [], meta: { configured: false, message: "ZoomInfo is not configured." } },
      { status: 200 }
    );
  }

  let body: { type?: string; ids?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: [], meta: { error: "Invalid JSON body." } },
      { status: 400 }
    );
  }

  const type = body.type === "contact" ? "contact" : "company";
  const ids = Array.isArray(body.ids)
    ? body.ids.map((x) => String(x)).filter(Boolean)
    : [];

  if (!ids.length) {
    return NextResponse.json(
      { data: [], meta: { error: "Provide a non-empty 'ids' array." } },
      { status: 400 }
    );
  }

  try {
    const data =
      type === "contact"
        ? await enrichContacts(ids)
        : await enrichCompanies(ids);
    return NextResponse.json({ data, meta: { type, count: data.length } });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        data: [],
        meta: {
          type,
          error: err instanceof Error ? err.message : "ZoomInfo request failed",
        },
      },
      { status: 502 }
    );
  }
}
