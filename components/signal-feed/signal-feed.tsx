"use client";

import * as React from "react";
import { TerritoryInput } from "./territory-input";
import { SoftwareFilter } from "./software-filter";
import { SignalTypeFilter } from "./signal-type-filter";
import { SignalRow } from "./signal-row";
import { CompanyDossier } from "@/components/dossier/company-dossier";
import { CAM_SOFTWARE_NAMES } from "@/lib/cam-software";
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
    unrecognized?: {
      input: string;
      suggestions: { code: string; name: string }[];
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
  const [center, setCenter] = React.useState({ location: "", radius: "state" });
  const [selectedSoftware, setSelectedSoftware] = React.useState<Set<string>>(
    new Set([...CAM_SOFTWARE_NAMES])
  );
  const [selectedTypes, setSelectedTypes] = React.useState<Set<string>>(
    new Set(SIGNAL_TYPES)
  );
  const [hasSearched, setHasSearched] = React.useState(false);
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null);

  const fetchSignals = React.useCallback(async (location: string, radius: string) => {
    if (!location.trim()) return;
    setLoading(true);
    setError(null);
    setHasSearched(true);
    setExpandedKey(null);
    try {
      const res = await fetch(
        `/api/signals?location=${encodeURIComponent(location)}&radius=${encodeURIComponent(radius)}`
      );
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
    if (center.location.trim()) {
      fetchSignals(center.location, center.radius);
    }
  }, [fetchSignals, center.location, center.radius]);

  const filtered = React.useMemo(() => {
    const filterableLower = new Set(
      CAM_SOFTWARE_NAMES.map((n) => n.toLowerCase())
    );
    return allSignals.filter((s) => {
      if (!selectedTypes.has(s.signalType)) return false;
      // The chip filter only operates on the 10 CAM tools. Signals
      // whose only detection is a CAD pairing (SolidWorks, CATIA,
      // Inventor, CAMWorks) or "Unknown" are NOT excluded by the
      // chips. Reps still see them; chips just filter the subset that
      // does mention a CAM tool.
      const camDetections = s.detectedSoftware
        .map((d) => d.name)
        .filter((n) => n && filterableLower.has(n.toLowerCase()));
      if (camDetections.length === 0) return true;
      return camDetections.some((n) => selectedSoftware.has(n));
    });
  }, [allSignals, selectedSoftware, selectedTypes]);

  const groups = React.useMemo<CompanyGroup[]>(
    () => groupSignalsByCompany(filtered),
    [filtered]
  );

  const softwareCounts = React.useMemo(() => {
    return CAM_SOFTWARE_NAMES.map((name) => ({
      name,
      count: allSignals.filter((s) =>
        s.detectedSoftware.some(
          (sw) =>
            sw.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(sw.name.toLowerCase())
        )
      ).length,
    }));
  }, [allSignals]);

  const typeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    SIGNAL_TYPES.forEach((t) => {
      counts[t] = allSignals.filter((s) => s.signalType === t).length;
    });
    return counts;
  }, [allSignals]);

  const handlePull = (location: string, radius: string) => {
    setCenter({ location, radius });
  };

  const toggleSoftware = (name: string) => {
    setSelectedSoftware((prev) => {
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
      <TerritoryInput
        initialLocation={center.location}
        initialRadius={center.radius}
        loading={loading}
        onPull={handlePull}
      />

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <SoftwareFilter
            options={softwareCounts}
            selected={selectedSoftware}
            onToggle={toggleSoftware}
            onSelectAll={() => setSelectedSoftware(new Set([...CAM_SOFTWARE_NAMES]))}
            onClear={() => setSelectedSoftware(new Set())}
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
            onClick={() => fetchSignals(center.location, center.radius)}
            className="ml-auto"
          >
            Retry
          </Button>
        </div>
      )}

      {meta?.unrecognized && !loading ? (
        <UnrecognizedTerritory
          input={meta.unrecognized.input}
          suggestions={meta.unrecognized.suggestions}
          onPick={(name) => setCenter({ location: name, radius: center.radius })}
        />
      ) : !hasSearched && !loading ? (
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
        <NoResultsState location={center.location} sources={meta?.sources} />
      ) : (
        <div className="space-y-2">
          {groups.length < 5 && (
            <ThinCoverageBanner location={center.location} count={groups.length} />
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

function UnrecognizedTerritory({
  input,
  suggestions,
  onPick,
}: {
  input: string;
  suggestions: { code: string; name: string }[];
  onPick: (name: string) => void;
}) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-base font-semibold text-amber-900">
            We could not recognize &quot;{input}&quot; as a territory
          </h3>
          <p className="text-sm text-amber-900/80 mt-1 leading-relaxed">
            The Signal Feed only pulls real data when the territory matches a US state, Canadian province, or a known manufacturing city. Try a state name, a 2-letter code, or a city + state.
          </p>
          {suggestions.length > 0 && (
            <div className="mt-3">
              <p className="text-xs uppercase tracking-wider font-semibold text-amber-800 mb-2">
                Did you mean
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => onPick(s.name)}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-amber-400 bg-white text-amber-900 hover:bg-amber-100 transition-colors"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
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
