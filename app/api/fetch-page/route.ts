import { NextRequest, NextResponse } from "next/server";
import { stripHtml } from "@/lib/signal-sources/extract";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 1_500_000; // 1.5MB upstream limit
const MAX_CHARS = 8000; // text returned to client

export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let raw = (body.url ?? "").trim();
  if (!raw) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }
  // Block local addresses to avoid SSRF.
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    host.endsWith(".local")
  ) {
    return NextResponse.json({ error: "blocked host" }, { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": BRAND.userAgent,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream ${upstream.status}` },
        { status: 502 }
      );
    }
    const ctype = upstream.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(ctype) && ctype) {
      return NextResponse.json(
        { error: `unsupported content type: ${ctype}` },
        { status: 415 }
      );
    }

    const reader = upstream.body?.getReader();
    if (!reader) return NextResponse.json({ error: "empty body" }, { status: 502 });
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
    const html = new TextDecoder().decode(
      new Uint8Array(chunks.flatMap((c) => Array.from(c)))
    );

    // Drop scripts, styles, navs, headers, footers before stripping tags.
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ");
    const text = stripHtml(cleaned).slice(0, MAX_CHARS);

    // Pull a title for display.
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : parsed.hostname;

    return NextResponse.json({
      url: parsed.toString(),
      title,
      text,
      truncated: text.length >= MAX_CHARS,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "fetch failed" },
      { status: 502 }
    );
  }
}
