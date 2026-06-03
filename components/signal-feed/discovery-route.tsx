"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ProductTypeId } from "@/types/product";
import { ALL_PRODUCT_TYPES } from "@/lib/catalog";
import { buildDiscoveryQuery, type DiscoveryQuery } from "@/lib/discovery";

interface DiscoveryRouteProps {
  selected: ProductTypeId;
  onSelect: (id: ProductTypeId) => void;
}

// Single-product selector (one product line per run) + a live preview of the
// route's query terms. The preview surfaces BOTH halves of the route: the
// GTM-editable role/sector lists (lib/discovery/routes.ts) and the catalog-
// derived detection terms (frozen by the golden snapshot), visually distinct.
export function DiscoveryRoute({ selected, onSelect }: DiscoveryRouteProps) {
  const query = React.useMemo(() => buildDiscoveryQuery(selected), [selected]);

  return (
    <div className="glass-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-secondary">
          Discovery Route
        </h3>
        <span className="text-[11px] text-text-muted">One product per run</span>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label="Discovery route product"
      >
        {ALL_PRODUCT_TYPES.map((t) => {
          const on = t.id === selected;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(t.id)}
              className={cn(
                "chip-base",
                on
                  ? "bg-primary/15 text-primary-hover border-primary/40 hover:bg-primary/25"
                  : "bg-surface-2 text-text-secondary border-border hover:border-border-strong hover:text-text-primary"
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <RoutePreview query={query} />
    </div>
  );
}

function RoutePreview({ query }: { query: DiscoveryQuery }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3 space-y-2">
      <p className="text-xs text-text-secondary">
        The{" "}
        <span className="font-medium text-text-primary">{query.label}</span>{" "}
        route searches for:
      </p>

      {/* GTM half (your edit pass) — primary-tinted. */}
      <TermGroup label="Roles (jobs)" terms={query.roles} tone="gtm" />
      <TermGroup label="Sectors" terms={query.sectors} tone="gtm" />

      {/* Catalog half (frozen detection terms) — neutral. */}
      {query.software.length > 0 && (
        <TermGroup label="Competitor software" terms={query.software} tone="catalog" />
      )}
      <TermGroup label="Keywords" terms={query.keywords} tone="catalog" />

      <p className="text-[11px] text-text-muted pt-1 leading-relaxed">
        We position{" "}
        <span className="text-text-secondary">{query.ourProducts.join(", ")}</span>.{" "}
        <span className="text-amber-700">
          Route scoping reaches the live sources in Step 5 — for now every route
          returns the territory&apos;s full signal set; this previews what the{" "}
          {query.label} route will search.
        </span>
      </p>
    </div>
  );
}

function TermGroup({
  label,
  terms,
  tone,
}: {
  label: string;
  terms: string[];
  tone: "gtm" | "catalog";
}) {
  if (terms.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-text-muted mr-0.5">
        {label}
      </span>
      {terms.map((t) => (
        <span
          key={t}
          className={cn(
            "inline-block px-1.5 py-0.5 rounded text-[11px] border",
            tone === "gtm"
              ? "bg-primary-subtle text-primary border-primary/20"
              : "bg-surface text-text-secondary border-border"
          )}
        >
          {t}
        </span>
      ))}
    </div>
  );
}
