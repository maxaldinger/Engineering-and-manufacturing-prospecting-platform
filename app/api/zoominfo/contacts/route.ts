import { NextRequest, NextResponse } from "next/server";
import { isZoomInfoConfigured } from "@/lib/zoominfo/client";
import { searchCompanies } from "@/lib/zoominfo/endpoints";
import { contactsForCompany } from "@/lib/signal-sources/zoominfo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/zoominfo/contacts?companyId=123456
// GET /api/zoominfo/contacts?company=Acme%20Machining
//
// Returns ranked, enriched decision-maker contacts (name, title, email, direct
// phone, LinkedIn) for one company. Accepts a ZoomInfo company id directly, or
// a company name which is resolved to an id via /search/company first.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companyIdParam = (searchParams.get("companyId") ?? "").trim();
  const companyName = (searchParams.get("company") ?? "").trim();

  if (!isZoomInfoConfigured()) {
    return NextResponse.json({
      contacts: [],
      meta: {
        configured: false,
        message: "ZoomInfo is not configured.",
      },
    });
  }

  if (!companyIdParam && !companyName) {
    return NextResponse.json({
      contacts: [],
      meta: { configured: true, message: "Provide ?companyId= or ?company=." },
    });
  }

  try {
    let companyId = companyIdParam;
    let resolvedName = companyName;

    // Resolve a name to a ZoomInfo company id when no id was supplied.
    if (!companyId && companyName) {
      const matches = await searchCompanies({
        companyName,
        rpp: 1,
        page: 1,
      });
      if (!matches.length) {
        return NextResponse.json({
          contacts: [],
          meta: {
            configured: true,
            message: `No ZoomInfo company match for "${companyName}".`,
          },
        });
      }
      companyId = String(matches[0].id);
      resolvedName = matches[0].name ?? companyName;
    }

    const contacts = await contactsForCompany(companyId);
    return NextResponse.json({
      contacts,
      meta: {
        configured: true,
        companyId,
        company: resolvedName || undefined,
        totalCount: contacts.length,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        contacts: [],
        meta: {
          configured: true,
          error: err instanceof Error ? err.message : "ZoomInfo request failed",
        },
      },
      { status: 502 }
    );
  }
}
