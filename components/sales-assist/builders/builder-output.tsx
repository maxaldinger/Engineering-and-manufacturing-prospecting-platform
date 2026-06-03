"use client";

import * as React from "react";
import { Copy, Check, Loader2, Sparkles, RefreshCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BuilderOutputProps {
  content: string;
  streaming: boolean;
  error?: string | null;
  emptyHint?: string;
  onClear?: () => void;
  onRetry?: () => void;
}

export function BuilderOutput({
  content,
  streaming,
  error,
  emptyHint,
  onClear,
  onRetry,
}: BuilderOutputProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  if (!streaming && !content && !error) {
    return emptyHint ? (
      <div className="rounded-xl border border-dashed border-border bg-surface/50 p-6 text-center text-sm text-text-muted">
        {emptyHint}
      </div>
    ) : null;
  }

  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-2/40">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold uppercase tracking-wider">
            {streaming ? "Generating..." : error ? "Error" : "Output"}
          </span>
          {streaming && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
        </div>
        <div className="flex items-center gap-1.5">
          {onRetry && !streaming && (
            <Button variant="ghost" size="sm" onClick={onRetry} type="button">
              <RefreshCcw className="h-3 w-3" />
              Regenerate
            </Button>
          )}
          {content && !streaming && (
            <Button variant="ghost" size="sm" onClick={handleCopy} type="button">
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
            </Button>
          )}
          {onClear && !streaming && (
            <Button variant="ghost" size="sm" onClick={onClear} type="button">
              Clear
            </Button>
          )}
        </div>
      </div>
      <div className={cn("p-5 text-sm leading-relaxed whitespace-pre-wrap text-text-primary", error && "text-red-700")}>
        {error ? (
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          content || (
            <span className="text-text-muted italic">
              Waiting for the model to start...
            </span>
          )
        )}
      </div>
    </div>
  );
}
