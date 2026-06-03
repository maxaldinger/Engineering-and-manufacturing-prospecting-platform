import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  buildSystemPrompt,
  type Tab,
  type Tone,
  type Methodology,
  type ActiveCompanyContext,
} from "@/lib/sales-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AssistBody {
  tab: Tab;
  tone: Tone;
  methodology: Methodology;
  company?: ActiveCompanyContext | null;
  systemPromptOverride?: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

export async function POST(req: NextRequest) {
  let body: AssistBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      "ANTHROPIC_API_KEY is not configured. Add it to .env.local and restart the dev server.",
      { status: 500 }
    );
  }

  const system =
    body.systemPromptOverride ??
    buildSystemPrompt({
      tab: body.tab,
      tone: body.tone,
      methodology: body.methodology,
      company: body.company ?? null,
    });

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const llmStream = await client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system,
          messages: body.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        for await (const event of llmStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            // Strip em dashes if the model slips one in.
            const safe = event.delta.text.replace(/—/g, ", ").replace(/–/g, "-");
            controller.enqueue(encoder.encode(safe));
          }
        }

        controller.close();
      } catch (err: any) {
        const msg = err?.message || "Anthropic API error";
        controller.enqueue(encoder.encode(`\n\n[error: ${msg}]`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
