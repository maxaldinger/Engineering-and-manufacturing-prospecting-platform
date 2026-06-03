"use client";

import * as React from "react";
import { TerritoryInput } from "./territory-input";
import { SoftwareFilter } from "./software-filter";
import { SignalTypeFilter } from "./signal-type-filter";
import { ProductTypeFilter } from "./product-type-filter";
import { SignalRow } from "./signal-row";
import { CompanyDossier } from "@/components/dossier/company-dossier";
import { applyFilters } from "./apply-filters";
import { ALL_PRODUCT_TYPES, COMPETITORS } from "@/lib/catalog";
import type { ProductTypeId } from "@/types/product";
import type { Place } from "@/lib/geocode/types";
import { Button } from "@/components/ui/button";
import {
  Radio,
  AlertTriangle,
  CheckCircle2,
  Search,
  ExternalLink,
} from "lucide-react";
import { groupSignalsByCompany, type CompanyGroup } from "@/lib/signal-grouping";
import type { Signal } from "@/types/signal";

const SIGNAL_TYPES = ["Job Posting", "News", "Gov Contract", "Tech Adoption"];

interface SourceStatus {
  name: string;
  status: "ok" | "error" | "skipped";
  count: number;
  error?: string;
}

interface ApiResponse {
  signals: Signal[];
  meta?: {
    region?: { code: string; name: string; country: "US" | "CA" };
    territory?: {
      label: string;
      type: "state" | "city";
      code: string;
      radius: string;
    };
    sources?: SourceStatus[];
    totalCount?: number;
    message?: string;
    error?: string;
  };
}

export function SignalFeed() {
  const [allSignals, setAllSignals] = React.useState<Signal[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<ApiResponse["meta"]>(undefined);
  // A confirmed Place (from the geocoder) plus its requested radius — never a
  // free-text location. Null until the rep picks + pulls a territory.
  const [territory, setTerritory] = React.useState<{
    place: Place | null;
    radius: string;
  }>({ place: null, radius: "state" });
  // Primary filter: product types (all on by default).
  const [selectedProductTypes, setSelectedProductTypes] = React.useState<
    Set<ProductTypeId>
  >(new Set(ALL_PRODUCT_TYPES.map((t) => t.id)));
  // Unclassified (productTypes: []) is an INDEPENDENT bucket, on by default, so
  // narrowing the product-type chips never silently hides it.
  const [showUnclassified, setShowUnclassified] = React.useState(true);
  // Secondary filter tracked as the set the user has turned OFF. Effective
  // selection = (available, in-scope) minus deselected — so software whose
  // product type is no longer selected drops out automatically (no stale
  // orphan), and newly in-scope software defaults on.
  const [deselectedSoftware, setDeselectedSoftware] = React.useState<Set<string>>(
    new Set()
  );
  const [selectedTypes, setSelectedTypes] = React.useState<Set<string>>(
    new Set(SIGNAL_TYPES)
  );
  const [hasSearched, setHasSearched] = React.useState(false);
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null);

  const fetchSignals = React.useCallback(async (place: Place, radius: string) => {
    setLoading(true);
    setError(null);
    setHasSearched(true);
    setExpandedKey(null);
    try {
      // Build the query from the CONFIRMED place's fields, not free text — the
      // API reconstructs the Place and never re-geocodes a guess.
      const params = new URLSearchParams({
        code: place.code,
        type: place.type,
        name: place.name,
        label: place.label,
        country: place.country,
        radius,
      });
      if (place.lat != null) params.set("lat", String(place.lat));
      if (place.lng != null) params.set("lng", String(place.lng));
      const res = await fetch(`/api/signals?${params.toString()}`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data: ApiResponse = await res.json();
      setAllSignals(data.signals ?? []);
      setMeta(data.meta);
    } catch (e: any) {
      setError(e?.message || "Failed to load signals");
      setAllSignals([]);
      setMeta(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (territory.place) {
      fetchSignals(territory.place, territory.radius);
    }
  }, [fetchSignals, territory.place, territory.radius]);

  // competitor name -> its product types, for scoping the software sub-filter.
  const competitorTypes = React.useMemo(() => {
    const m = new Map<string, readonly ProductTypeId[]>();
    for (const c of COMPETITORS) m.set(c.name, c.productTypes);
    return m;
  }, []);


  // Empty product-type selection means "no constraint" (show all classified),
  // never a blank feed.
  const typeActive = React.useCallback(
    (t: ProductTypeId) =>
      selectedProductTypes.size === 0 || selectedProductTypes.has(t),
    [selectedProductTypes]
  );

  // Secondary software options: competitor detections whose product type is in
  // scope. Rescopes automatically when the product-type selection changes.
  const softwareCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of allSignals) {
      for (const d of s.detectedSoftware) {
        if (!d.isCompetitor) continue;
        if (!d.productTypes.some(typeActive)) continue;
        counts.set(d.name, (counts.get(d.name) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allSignals, typeActive]);

  // Effective software selection: everything in scope that the user has not
  // turned off. Orphaned selections from a now-deselected product type simply
  // are not in softwareCounts, so they cannot keep filtering.
  const effectiveSoftware = React.useMemo(
    () =>
      new Set(
        softwareCounts.map((o) => o.name).filter((n) => !deselectedSoftware.has(n))
      ),
    [softwareCounts, deselectedSoftware]
  );

  const productTypeCounts = React.useMemo(
    () =>
      ALL_PRODUCT_TYPES.map((pt) => ({
        id: pt.id,
        label: pt.label,
        count: allSignals.filter((s) => s.productTypes.includes(pt.id)).length,
      })),
    [allSignals]
  );

  const unclassifiedCount = React.useMemo(
    () => allSignals.filter((s) => s.productTypes.length === 0).length,
    [allSignals]
  );

  const filtered = React.useMemo(
    () =>
      applyFilters(allSignals, {
        signalTypes: selectedTypes,
        productTypes: selectedProductTypes,
        showUnclassified,
        software: effectiveSoftware,
      }),
    [
      allSignals,
      selectedTypes,
      selectedProductTypes,
      showUnclassified,
      effectiveSoftware,
    ]
  );

  const groups = React.useMemo<CompanyGroup[]>(
    () => groupSignalsByCompany(filtered),
    [filtered]
  );

  const typeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    SIGNAL_TYPES.forEach((t) => {
      counts[t] = allSignals.filter((s) => s.signalType === t).length;
    });
    return counts;
  }, [allSignals]);

  const handlePull = (place: Place, radius: string) => {
    setTerritory({ place, radius });
  };

  const toggleProductType = (id: ProductTypeId) => {
    const turningOff = selectedProductTypes.has(id);
    const next = new Set(selectedProductTypes);
    if (turningOff) next.delete(id);
    else next.add(id);
    setSelectedProductTypes(next);

    // Clear deselections for software no longer in scope, in the SAME action
    // that narrowed the selection (not an effect reacting afterward). Keep a
    // multi-type tool's deselection if it is still in scope via another type.
    if (turningOff) {
      setDeselectedSoftware((ds) => {
        if (ds.size === 0) return ds;
        let changed = false;
        const kept = new Set<string>();
        for (const name of ds) {
          const types = competitorTypes.get(name);
          const stillInScope =
            !!types && types.some((t) => next.size === 0 || next.has(t));
          if (stillInScope) kept.add(name);
          else changed = true;
        }
        return changed ? kept : ds;
      });
    }
  };

  // Track deselection: a name present in the set means the chip is turned off.
  const toggleSoftware = (name: string) => {
    setDeselectedSoftware((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <TerritoryInput loading={loading} onPull={handlePull} />

      <ProductTypeFilter
        options={productTypeCounts}
        selected={selectedProductTypes}
        onToggle={toggleProductType}
        onSelectAll={() =>
          setSelectedProductTypes(new Set(ALL_PRODUCT_TYPES.map((t) => t.id)))
        }
        onClear={() => setSelectedProductTypes(new Set())}
        unclassifiedCount={unclassifiedCount}
        showUnclassified={showUnclassified}
        onToggleUnclassified={() => setShowUnclassified((v) => !v)}
      />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <SoftwareFilter
            options={softwareCounts}
            selected={effectiveSoftware}
            onToggle={toggleSoftware}
            onSelectAll={() => setDeselectedSoftware(new Set())}
            onClear={() =>
              setDeselectedSoftware(new Set(softwareCounts.map((o) => o.name)))
            }
          />
        </div>
        <SignalTypeFilter
          counts={typeCounts}
          selected={selectedTypes}
          onToggle={toggleType}
        />
      </div>

      {meta?.sources && meta.sources.length > 0 && (
        <SourceStatusBar
          sources={meta.sources}
          region={meta.region}
          totalCount={groups.length}
        />
      )}

      {error && (
        <div className="glass-panel p-6 flex items-center gap-3 text-red-700">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              territory.place && fetchSignals(territory.place, territory.radius)
            }
            className="ml-auto"
          >
            Retry
          </Button>
        </div>
      )}

      {!hasSearched && !loading ? (
        <InitialPrompt />
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-surface h-16 animate-pulse-soft"
            />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <NoResultsState
          location={territory.place?.label ?? ""}
          sources={meta?.sources}
        />
      ) : (
        <div className="space-y-2">
          {groups.length < 5 && (
            <ThinCoverageBanner
              location={territory.place?.label ?? ""}
              count={groups.length}
            />
          )}
          {groups.map((group) => (
            <SignalRow
              key={group.key}
              group={group}
              expanded={expandedKey === group.key}
              onToggle={() =>
                setExpandedKey((prev) => (prev === group.key ? null : group.key))
              }
            >
              <CompanyDossier group={group} />
            </SignalRow>
          ))}
        </div>
      )}
    </div>
  );
}

function InitialPrompt() {
  return (
    <div className="glass-panel p-12 text-center">
      <Search className="h-8 w-8 text-text-muted mx-auto mb-3" />
      <h3 className="text-base font-semibold text-text-primary mb-1">
        Type a territory to pull live signals
      </h3>
      <p className="text-sm text-text-secondary max-w-md mx-auto">
        Try a state name (Michigan, Texas, Ontario), a 2-letter code (WA, CA, BC), or a city + state (Detroit, MI). Live data comes from ZoomInfo company and contact intelligence (when configured), USAspending.gov federal contracts, Greenhouse CNC job boards, and free manufacturing trade press feeds.
      </p>
    </div>
  );
}

function SourceStatusBar({
  sources,
  region,
  totalCount,
}: {
  sources: SourceStatus[];
  region?: { code: string; name: string; country: "US" | "CA" };
  totalCount: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 px-4 py-3 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <Radio className="h-3.5 w-3.5 text-primary" />
        <span>
          <span className="font-semibold text-text-primary">{totalCount}</span> live{" "}
          {totalCount === 1 ? "company" : "companies"}
          {region && (
            <>
              {" "}
              in <span className="font-semibold text-text-primary">{region.name}</span>
            </>
          )}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap text-[11px]">
        {sources.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            {s.status === "ok" ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-amber-600" />
            )}
            <span className="text-text-muted">
              {s.name}: <span className="text-text-secondary font-medium">{s.count}</span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function NoResultsState({
  location,
  sources,
}: {
  location: string;
  sources?: SourceStatus[];
}) {
  const errored = (sources ?? []).filter((s) => s.status === "error");
  const highCoverage = ["California", "Washington", "Texas", "Massachusetts", "Florida"];
  return (
    <div className="glass-panel p-10 text-center">
      <Radio className="h-7 w-7 text-text-muted mx-auto mb-3" />
      <h3 className="text-base font-semibold text-text-primary mb-1">
        No live signals matched {location || "this territory"}
      </h3>
      <p className="text-sm text-text-secondary max-w-xl mx-auto mb-4 leading-relaxed">
        Greenhouse public boards are sparse outside major aerospace and defense hubs,
        and USAspending may not have a recent contract here. Try a higher-coverage state
        or expand the radius to state-wide.
      </p>
      <div className="flex items-center justify-center gap-2 flex-wrap mb-4">
        {highCoverage.map((name) => (
          <span
            key={name}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-primary/30 bg-primary-subtle text-primary"
          >
            {name}
          </span>
        ))}
      </div>
      {errored.length > 0 && (
        <div className="text-xs text-amber-700 max-w-md mx-auto">
          {errored.map((s) => (
            <p key={s.name}>
              {s.name} reported an error{s.error ? `: ${s.error}` : "."}
            </p>
          ))}
        </div>
      )}
      <a
        href="https://www.usaspending.gov/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover mt-4"
      >
        USAspending.gov
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function ThinCoverageBanner({ location, count }: { location: string; count: number }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 leading-relaxed">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold">
            Limited signal coverage in {location || "this territory"}
          </p>
          <p className="text-xs mt-1">
            {count} {count === 1 ? "company" : "companies"} surfaced. Greenhouse public
            boards are sparse outside major aerospace and defense hubs. Try state-wide
            radius or check adjacent states like California, Washington, Texas, Massachusetts,
            or Florida for richer signal density.
          </p>
        </div>
      </div>
    </div>
  );
}
