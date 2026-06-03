import type { Signal } from "@/types/signal";
import { fetchUSAspendingAwards } from "./usaspending";
import { fetchNewsSignalsForRegion } from "./rss-news";
import { fetchCncJobsForRegion } from "./greenhouse-jobs";
import { fetchZoomInfoSignals, isZoomInfoConfigured } from "./zoominfo";
import { ALL_REGIONS, detectRegion } from "./state-codes";

const ZOOMINFO_SOURCE_NAME = "ZoomInfo (territory companies + contacts)";

export interface AggregateMeta {
  region?: { code: string; name: string; country: "US" | "CA" };
  unrecognized?: { input: string; suggestions: { code: string; name: string }[] };
  sources: { name: string; status: "ok" | "error" | "skipped"; count: number; error?: string }[];
  totalCount: number;
  detectionCounts?: Record<string, number>;
  camRelevantCount?: number;
  manufacturingRelevantCount?: number;
  audit?: {
    company: string;
    title: string;
    type: string;
    descriptionExcerpt: string;
    detectedSoftware: string[];
    camRelevant: boolean;
    manufacturingRelevant: boolean;
  }[];
}

export interface AggregateResult {
  signals: Signal[];
  meta: AggregateMeta;
}

// Levenshtein distance for fuzzy "did you mean" suggestions on
// unrecognized territory input. Small + standalone, no deps.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(cur + 1, prev[j] + 1, prev[j - 1] + cost);
      prev[j - 1] = cur;
      cur = next;
    }
    prev[b.length] = cur;
  }
  return prev[b.length];
}

function suggestRegions(input: string, limit = 3): { code: string; name: string }[] {
  const lower = input.toLowerCase().trim();
  if (!lower) return [];
  return ALL_REGIONS
    .map((r) => ({
      code: r.code,
      name: r.name,
      d: levenshtein(lower, r.name.toLowerCase()),
    }))
    .filter((x) => x.d <= 3)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => ({ code: x.code, name: x.name }));
}

export async function aggregateSignals(location: string): Promise<AggregateResult> {
  const region = detectRegion(location);
  const meta: AggregateMeta = {
    region: region
      ? { code: region.code, name: region.name, country: region.country }
      : undefined,
    sources: [],
    totalCount: 0,
  };

  // No silent fallback. If we cannot recognize the input, surface an
  // explicit "unrecognized" payload with did-you-mean suggestions and
  // return zero signals. Better to show "not recognized" than to bleed
  // Texas signals into a Louisiana search.
  if (!region) {
    meta.unrecognized = {
      input: location,
      suggestions: suggestRegions(location),
    };
    return { signals: [], meta };
  }

  // ZoomInfo is the primary source (real companies + contacts) when the rep
  // has configured credentials. It runs alongside the free public sources.
  const zoomInfoConfigured = isZoomInfoConfigured();

  const tasks: { name: string; run: () => Promise<Signal[]> }[] = [];
  if (zoomInfoConfigured) {
    tasks.push({
      name: ZOOMINFO_SOURCE_NAME,
      run: () => fetchZoomInfoSignals(region.code, region.country),
    });
  }
  tasks.push(
    {
      name: "USAspending.gov (federal contracts)",
      run: () => fetchUSAspendingAwards(region.code, region.country),
    },
    {
      name: "Greenhouse boards (CNC and manufacturing jobs)",
      run: () => fetchCncJobsForRegion(region.code),
    },
    {
      name: "Trade press RSS (Modern Machine Shop, IndustryWeek, American Machinist, AM&D)",
      run: () => fetchNewsSignalsForRegion(region.code),
    }
  );

  const results = await Promise.all(
    tasks.map(async (task) => {
      try {
        const sigs = await task.run();
        return { name: task.name, signals: sigs, status: "ok" as const };
      } catch (err: any) {
        return {
          name: task.name,
          signals: [] as Signal[],
          status: "error" as const,
          error: err?.message ?? "Unknown error",
        };
      }
    })
  );

  const merged: Signal[] = [];
  const seenIds = new Set<string>();
  for (const r of results) {
    meta.sources.push({
      name: r.name,
      status: r.status,
      count: r.signals.length,
      error: "error" in r ? r.error : undefined,
    });
    for (const s of r.signals) {
      if (seenIds.has(s.id)) continue;
      seenIds.add(s.id);
      merged.push(s);
    }
  }

  // Surface ZoomInfo as an explicitly skipped source when credentials are
  // absent, so the rep sees it is available but not yet wired rather than
  // silently missing. Shown first since it is the primary source.
  if (!zoomInfoConfigured) {
    meta.sources.unshift({
      name: ZOOMINFO_SOURCE_NAME,
      status: "skipped",
      count: 0,
    });
  }

  // Sort by signal strength desc.
  merged.sort((a, b) => b.signalStrength - a.signalStrength);
  meta.totalCount = merged.length;

  // Detection roll-ups for the audit log.
  const detectionCounts: Record<string, number> = {};
  let camRelevantCount = 0;
  let manufacturingRelevantCount = 0;
  for (const s of merged) {
    for (const sw of s.detectedSoftware) {
      if (sw.name && sw.name !== "Unknown") {
        detectionCounts[sw.name] = (detectionCounts[sw.name] ?? 0) + 1;
      }
    }
    if (s.camRelevant) camRelevantCount += 1;
    if (s.manufacturingRelevant) manufacturingRelevantCount += 1;
  }
  meta.detectionCounts = detectionCounts;
  meta.camRelevantCount = camRelevantCount;
  meta.manufacturingRelevantCount = manufacturingRelevantCount;

  // Audit sample: 5 job postings showing detection result so the rep
  // can verify detection works on real data.
  const jobSample = merged
    .filter((s) => s.signalType === "Job Posting")
    .slice(0, 5)
    .map((s) => ({
      company: s.company,
      title: s.title,
      type: s.signalType,
      descriptionExcerpt: s.description.slice(0, 240),
      detectedSoftware: s.detectedSoftware
        .map((d) => d.name)
        .filter((n) => n && n !== "Unknown"),
      camRelevant: !!s.camRelevant,
      manufacturingRelevant: !!s.manufacturingRelevant,
    }));
  meta.audit = jobSample;

  return { signals: merged, meta };
}
