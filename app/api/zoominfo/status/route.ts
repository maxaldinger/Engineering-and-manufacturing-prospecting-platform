import { NextRequest, NextResponse } from "next/server";
import { getZoomInfoToken, zoomInfoConfigStatus } from "@/lib/zoominfo/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/zoominfo/status         -> is ZoomInfo configured? which auth mode?
// GET /api/zoominfo/status?check=1 -> additionally perform a live auth probe.
//
// Never returns secrets: only whether each credential is present and, on
// request, whether authentication actually succeeds. Use this during
// self-hosting setup to confirm credentials are wired correctly.
export async function GET(req: NextRequest) {
  const status = zoomInfoConfigStatus();

  if (!status.configured) {
    return NextResponse.json({ ...status, auth: "not-configured" });
  }

  const check = /^(1|true|yes)$/i.test(
    new URL(req.url).searchParams.get("check") ?? ""
  );
  if (!check) {
    return NextResponse.json({ ...status, auth: "unchecked" });
  }

  try {
    await getZoomInfoToken(true);
    return NextResponse.json({ ...status, auth: "ok" });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ...status,
        auth: "error",
        error: err instanceof Error ? err.message : "Authentication failed",
      },
      { status: 502 }
    );
  }
}
