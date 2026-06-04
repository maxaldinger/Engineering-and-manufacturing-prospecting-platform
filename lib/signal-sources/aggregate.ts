import type { Signal } from "@/types/signal";
import type { Place } from "@/lib/geocode/types";
import type { ProductTypeId } from "@/types/product";
import { PRODUCT_TYPE_BY_ID } from "@/lib/catalog";
import { fetchUSAspendingAwards } from "./usaspending";
import { fetchNewsSignalsForRegion } from "./rss-news";
import { fetchGreenhouseJobs } from "./greenhouse-jobs";
import { fetchZoomInfoSignals, isZoomInfoConfigured } from "./zoominfo";
import { fetchAdzunaJobs, isAdzunaConfigured } from "./adzuna";
import { ALL_REGIONS, regionForCode } from "./state-codes";
import { buildDiscoveryQuery } from "@/lib/discovery";

const ZOOMINFO_SOURCE_NAME = "ZoomInfo (territory companies + contacts)";
const ADZUNA_SOURCE_NAME = "Adzuna (job postings — primary free jobs)";

export interface AggregateMeta {
  region?: { code: string; name: string; country: "US" | "CA" };
  // The confirmed territory + requested radius. No current source honors radius
  // (all are state-level for `code`); the radius-capable jobs engine is added in
  // a later step. Surfaced so the UI can be honest about radius scope.
  territory?: { label: string; type: "state" | "city"; code: string; radius: string };
  // The discovery route this pull ran for. Echoed today; the route does not yet
  // scope the sources (Step 5 wires per-route query construction in).
  route?: { productType: ProductTypeId; label: string };
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

export async function aggregateSignals(
  place: Place,
  radius: string,
  product?: ProductTypeId
): Promise<AggregateResult> {
  // The place is already confirmed by the geocoder (no silent guess). Region is
  // a direct code lookup. Region-level sources query the single state code;
  // place.regionCodes is the multi-code extension point for cross-state metros.
  const region = regionForCode(place.code);
  const meta: AggregateMeta = {
    region: region
      ? { code: region.code, name: region.name, country: region.country }
      : undefined,
    territory: {
      label: place.label,
      type: place.type,
      code: place.code,
      radius,
    },
    // Echo the selected route. Step 5 will use `product` to scope which sources
    // run and how their queries are built; today it is a round-trip confirmation.
    route: product
      ? { productType: product, label: PRODUCT_TYPE_BY_ID[product].label }
      : undefined,
    sources: [],
    totalCount: 0,
  };

  // Defensive: a confirmed place always carries a valid region code, but guard
  // a direct/misformed call rather than bleeding the wrong region.
  if (!region) {
    meta.unrecognized = {
      input: place.label,
      suggestions: suggestRegions(place.label),
    };
    return { signals: [], meta };
  }

  const zoomInfoConfigured = isZoomInfoConfigured();
  const adzunaConfigured = isAdzunaConfigured();

  const tasks: { name: string; run: () => Promise<Signal[]> }[] = [];
  if (zoomInfoConfigured) {
    tasks.push({
      name: ZOOMINFO_SOURCE_NAME,
      run: () => fetchZoomInfoSignals(region.code, region.country),
    });
  }
  // The route the free baseline (Adzuna + Greenhouse + RSS) is scoped to. Default
  // to CAM when no product is supplied (direct API call). The firmographic
  // supplements (ZoomInfo, USAspending) are product-AGNOSTIC and deliberately
  // NOT scoped by this — they add manufacturers/contractors to the pool, and
  // product relevance for them comes from detection, not the route query.
  const routeProduct: ProductTypeId = product ?? "cam";
  const routeQuery = buildDiscoveryQuery(routeProduct);

  if (adzunaConfigured) {
    // Adzuna is the primary, route-scoped, geo-capable jobs source. It receives
    // the route's search terms plus the full place + radius.
    const terms = [...routeQuery.softwareKeywords, ...routeQuery.roles];
    tasks.push({
      name: ADZUNA_SOURCE_NAME,
      run: () => fetchAdzunaJobs(place, radius, { terms }),
    });
  }
  tasks.push(
    {
      name: "USAspending.gov (federal contracts)",
      run: () => fetchUSAspendingAwards(region.code, region.country),
    },
    {
      name: "Greenhouse boards (manufacturing + engineering jobs)",
      run: () => fetchGreenhouseJobs(region.code, routeProduct),
    },
    {
      name: "Trade press RSS (Modern Machine Shop, IndustryWeek, American Machinist, AM&D)",
      run: () => fetchNewsSignalsForRegion(region.code, routeProduct),
    }
  );

  const results = await Promise.all(
    tasks.map(async (task) => {
      try {
        const sigs = await task.run();
        return { name: task.name, signals: sigs, status: "ok" as const };
      } catch (err: any) {
        const message = err?.message ?? "Unknown error";
        // Log WHICH dependency degraded and WHY. The source is also surfaced as
        // an "error" status (count omitted) so a degraded source is never
        // mistaken for an empty territory — see SourceStatusBar.
        console.warn(`aggregate: source "${task.name}" degraded: ${message}`);
        return {
          name: task.name,
          signals: [] as Signal[],
          status: "error" as const,
          error: message,
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

  // Adzuna is the primary free jobs source. When its keys are absent, surface it
  // as SKIPPED (available, not wired) rather than silently missing — and at the
  // front, since "skipped" here means the primary jobs feed is off. This is
  // distinct from an "error" status, which means it was tried and degraded.
  if (!adzunaConfigured) {
    meta.sources.unshift({
      name: ADZUNA_SOURCE_NAME,
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
      if (sw.name) {
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
        .filter((n) => n),
      camRelevant: !!s.camRelevant,
      manufacturingRelevant: !!s.manufacturingRelevant,
    }));
  meta.audit = jobSample;

  return { signals: merged, meta };
}
