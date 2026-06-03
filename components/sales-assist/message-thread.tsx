"use client";

import * as React from "react";
import { Copy, Check, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

interface MessageThreadProps {
  messages: ChatMessage[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // ignore clipboard failure
        }
      }}
      className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" />
          Copy
        </>
      )}
    </button>
  );
}

export function MessageThread({ messages }: MessageThreadProps) {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col gap-4 pb-6">
      {messages.map((m) => (
        <div
          key={m.id}
          className={cn(
            "group flex gap-3 max-w-[88%]",
            m.role === "user" ? "self-end flex-row-reverse" : "self-start"
          )}
        >
          <div
            className={cn(
              "h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0",
              m.role === "user"
                ? "bg-surface-2 border border-border"
                : "bg-gradient-to-br from-primary to-primary-hover shadow-sm shadow-primary/20"
            )}
          >
            {m.role === "user" ? (
              <User className="h-3.5 w-3.5 text-text-secondary" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-white" />
            )}
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <div
              className={cn(
                "rounded-lg px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed",
                m.role === "user"
                  ? "bg-primary/15 border border-primary/25 text-text-primary"
                  : "bg-surface border border-border text-text-primary"
              )}
            >
              {m.pending && !m.content ? (
                <span className="inline-flex gap-1.5 items-center text-text-secondary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-soft" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-soft [animation-delay:200ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-soft [animation-delay:400ms]" />
                </span>
              ) : (
                m.content
              )}
            </div>
            {m.role === "assistant" && m.content && (
              <div className="flex items-center justify-end">
                <CopyButton text={m.content} />
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
