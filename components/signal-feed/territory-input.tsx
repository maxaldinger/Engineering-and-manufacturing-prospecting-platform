"use client";

import * as React from "react";
import { Search, MapPin, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Place } from "@/lib/geocode/types";
import { crossStateMetro } from "@/lib/geocode/metros";

interface TerritoryInputProps {
  loading?: boolean;
  onPull: (place: Place, radius: string) => void;
}

const RADIUS_OPTIONS = [
  { value: "10", label: "10 miles" },
  { value: "25", label: "25 miles" },
  { value: "30", label: "30 miles" },
  { value: "50", label: "50 miles" },
  { value: "100", label: "100 miles" },
  { value: "state", label: "State-wide" },
];

export function TerritoryInput({ loading = false, onPull }: TerritoryInputProps) {
  const [query, setQuery] = React.useState("");
  const [candidates, setCandidates] = React.useState<Place[]>([]);
  const [confirmed, setConfirmed] = React.useState<Place | null>(null);
  const [radius, setRadius] = React.useState("25");
  const [open, setOpen] = React.useState(false);
  const [geoLoading, setGeoLoading] = React.useState(false);

  // Debounced geocode candidates. The rep must CONFIRM a candidate — typing
  // never auto-resolves, and editing the text clears a prior confirmation, so a
  // stale or guessed place can never be pulled.
  React.useEffect(() => {
    const q = query.trim();
    if (confirmed && q === confirmed.label) return; // selection set the text
    if (q.length < 2) {
      setCandidates([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    setGeoLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (cancelled) return;
        setCandidates(data.candidates ?? []);
        setOpen(true);
      } catch (err) {
        if (!cancelled) {
          console.warn("territory: geocode lookup failed", err);
          setCandidates([]);
        }
      } finally {
        if (!cancelled) setGeoLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, confirmed]);

  const choose = (p: Place) => {
    setConfirmed(p);
    setQuery(p.label);
    setOpen(false);
    if (p.type === "state") setRadius("state");
    else if (radius === "state") setRadius("25");
  };

  const onType = (v: string) => {
    setQuery(v);
    if (confirmed) setConfirmed(null);
  };

  const isState = confirmed?.type === "state";
  const metro = confirmed ? crossStateMetro(confirmed) : null;

  const submit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!confirmed) return;
    onPull(confirmed, isState ? "state" : radius);
  };

  return (
    <div className="space-y-2">
      <form
        onSubmit={submit}
        className="glass-panel p-4 md:p-5 flex flex-col md:flex-row md:items-end gap-3"
      >
        <div className="flex-1 min-w-0 relative">
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Territory
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <Input
              value={query}
              onChange={(e) => onType(e.target.value)}
              onFocus={() => candidates.length > 0 && setOpen(true)}
              placeholder="City or state — pick a confirmed place"
              className="pl-9"
              autoComplete="off"
            />
            {geoLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-text-muted" />
            )}
          </div>
          {open && candidates.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full rounded-md border border-border bg-surface shadow-lg overflow-hidden max-h-64 overflow-y-auto">
              {candidates.map((c) => (
                <li key={`${c.type}:${c.code}:${c.name}`}>
                  <button
                    type="button"
                    onClick={() => choose(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2 flex items-center justify-between gap-2"
                  >
                    <span className="text-text-primary">{c.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-text-muted">
                      {c.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open && !geoLoading && candidates.length === 0 && query.trim().length >= 2 && (
            <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-surface shadow-lg px-3 py-2 text-xs text-text-muted">
              No matching place. Try a state, &quot;City, ST&quot;, or a larger city.
            </div>
          )}
        </div>
        <div className="md:w-44">
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Radius
          </label>
          <Select
            value={isState ? "state" : radius}
            onChange={(e) => setRadius(e.target.value)}
            disabled={isState}
          >
            {RADIUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} disabled={isState && o.value !== "state"}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={loading || !confirmed} className="md:w-44">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Pulling
            </>
          ) : (
            <>
              <Search className="h-4 w-4" />
              Pull Signals
            </>
          )}
        </Button>
      </form>

      {confirmed && (
        <div className="px-1 text-xs text-text-secondary flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Confirmed:{" "}
            <span className="font-medium text-text-primary">{confirmed.label}</span>
          </span>
          {isState ? (
            <span>State-wide (radius not applicable).</span>
          ) : (
            <span>
              {radius} mi radius applies to geo-capable sources (jobs); other sources
              are state-level for {confirmed.code}.
            </span>
          )}
          {metro && (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              Cross-state metro ({metro.label}): region-level sources cover{" "}
              {confirmed.code} only; radius spans the metro.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
