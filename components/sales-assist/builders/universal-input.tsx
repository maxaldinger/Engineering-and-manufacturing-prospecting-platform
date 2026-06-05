"use client";

import * as React from "react";
import { Globe, Loader2, Check, X, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field } from "./common";

export interface UniversalContext {
  notes: string;
  url: string;
  fetchedTitle?: string;
  fetchedText?: string;
}

interface Props {
  notesPlaceholder?: string;
  context: UniversalContext;
  onChange: (next: UniversalContext) => void;
  notesLabel?: string;
  // Notes-only modes (MEDDPICC, LOU) hide the company-website pull. Modes where a
  // capability page genuinely helps (Product Fit, Email, Ask Anything) keep it.
  hideUrl?: boolean;
}

export function UniversalContextInput({
  notesPlaceholder = "Paste meeting notes, call transcripts, email threads, capability briefs, or anything else relevant about the prospect...",
  context,
  onChange,
  notesLabel = "Meeting notes or context",
  hideUrl = false,
}: Props) {
  const [fetching, setFetching] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchUrl = async () => {
    if (!context.url.trim()) return;
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/fetch-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: context.url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed ${res.status}`);
      }
      onChange({
        ...context,
        url: data.url ?? context.url,
        fetchedTitle: data.title,
        fetchedText: data.text,
      });
    } catch (e: any) {
      setError(e?.message ?? "Could not fetch the page");
    } finally {
      setFetching(false);
    }
  };

  const clearFetched = () => {
    onChange({ ...context, fetchedTitle: undefined, fetchedText: undefined });
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label={notesLabel} htmlFor="ctx-notes">
        <Textarea
          id="ctx-notes"
          value={context.notes}
          onChange={(e) => onChange({ ...context, notes: e.target.value })}
          placeholder={notesPlaceholder}
          className="min-h-[160px]"
        />
      </Field>

      {!hideUrl && (
      <div className="flex flex-col gap-2">
        <Field
          label="Or pull from a company website"
          htmlFor="ctx-url"
          optional
          hint="Paste a company URL and we'll fetch the page text. Useful for capability statements, about pages, news posts."
        >
          <div className="flex items-stretch gap-2">
            <Input
              id="ctx-url"
              value={context.url}
              onChange={(e) => onChange({ ...context, url: e.target.value })}
              placeholder="https://example.com/about"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void fetchUrl();
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={fetchUrl}
              disabled={fetching || !context.url.trim()}
            >
              {fetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Globe className="h-4 w-4" />
              )}
              Pull
            </Button>
          </div>
        </Field>

        {error && (
          <div className="text-xs text-red-700 inline-flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" />
            {error}
          </div>
        )}

        {context.fetchedText && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                <Check className="h-3 w-3" />
                Pulled {context.fetchedText.length.toLocaleString()} chars from{" "}
                {context.fetchedTitle ?? context.url}
              </span>
              <button
                type="button"
                onClick={clearFetched}
                className="text-emerald-700 hover:text-emerald-900"
                aria-label="Clear fetched content"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="text-emerald-900/80 line-clamp-3">
              {context.fetchedText.slice(0, 280)}
              {context.fetchedText.length > 280 ? "..." : ""}
            </p>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

export function emptyContext(): UniversalContext {
  return { notes: "", url: "" };
}

// Compose the user message that gets shipped to /api/assist. Drops the
// URL field if no fetched text exists.
export function composeContextMessage(
  context: UniversalContext,
  prefix?: string
): string {
  const parts: string[] = [];
  if (prefix) parts.push(prefix);
  if (context.notes.trim()) parts.push(`Notes:\n${context.notes.trim()}`);
  if (context.fetchedText) {
    const head = context.fetchedTitle
      ? `${context.fetchedTitle} (${context.url})`
      : context.url;
    parts.push(`From website ${head}:\n${context.fetchedText}`);
  }
  return parts.join("\n\n");
}

export function hasContext(context: UniversalContext): boolean {
  return Boolean(context.notes.trim() || context.fetchedText);
}
