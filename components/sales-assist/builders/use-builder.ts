"use client";

import * as React from "react";
import type { Tab, Tone, Methodology, ActiveCompanyContext } from "@/lib/hrs-context";

interface RunArgs {
  tab: Tab;
  tone: Tone;
  methodology: Methodology;
  company: ActiveCompanyContext | null;
  userMessage: string;
}

export function useBuilder() {
  const [content, setContent] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const lastRunRef = React.useRef<RunArgs | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const run = React.useCallback(async (args: RunArgs) => {
    const text = args.userMessage.trim();
    if (!text || streaming) return;

    lastRunRef.current = args;
    setError(null);
    setContent("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: args.tab,
          tone: args.tone,
          methodology: args.methodology,
          company: args.company,
          messages: [{ role: "user", content: text }],
        }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => "");
        throw new Error(errBody || `Request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        setContent(buffer);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      const msg = e?.message || "Request failed";
      setError(
        msg.includes("ANTHROPIC_API_KEY")
          ? "Set ANTHROPIC_API_KEY in your .env.local to enable Sales Assist responses."
          : msg
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [streaming]);

  const stop = React.useCallback(() => abortRef.current?.abort(), []);

  const retry = React.useCallback(() => {
    const last = lastRunRef.current;
    if (last) void run(last);
  }, [run]);

  const clear = React.useCallback(() => {
    setContent("");
    setError(null);
  }, []);

  return { content, streaming, error, run, stop, retry, clear };
}
