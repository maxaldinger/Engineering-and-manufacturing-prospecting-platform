// Adzuna job-search API — the PRIMARY free jobs source. No per-board curation
// (unlike Greenhouse): Adzuna aggregates postings across employers, so a route
// query returns real prospects anywhere the rep points. Free tier needs an
// app id + key (https://developer.adzuna.com). Absent -> the source is SKIPPED
// (surfaced as such, never a silent gap).
//
// Degradation is DISTINGUISHABLE from "found nothing": a throttle / quota hit /
// auth failure / network error throws (the aggregate records the source as
// errored with a reason), while a genuine empty result returns []. A quota hit
// must never read as an empty territory.

import type { Signal } from "@/types/signal";
import type { Place } from "@/lib/geocode/types";
import { classifyText } from "@/lib/catalog";
import {
  isCamRelevant,
  isManufacturingRelevant,
  relativeAge,
  scoreSignal,
  stripHtml,
  summarize,
} from "./extract";
import { canonicalCompany } from "./company";
import { BRAND } from "@/lib/brand";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export function isAdzunaConfigured(): boolean {
  return !!(env("ADZUNA_APP_ID") && env("ADZUNA_APP_KEY"));
}

export interface AdzunaJob {
  id?: string | number;
  title?: string;
  description?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  redirect_url?: string;
  created?: string;
  category?: { label?: string; tag?: string };
  latitude?: number;
  longitude?: number;
}

export interface AdzunaResponse {
  count?: number;
  results?: AdzunaJob[];
  // Adzuna returns these on an application-level error even with HTTP 200.
  exception?: string;
  display?: string;
}

// Map a non-OK Adzuna response to a human-readable degradation reason, so a
// throttled / quota-hit / auth-failed source surfaces as an ERROR (distinct
// from "ok, found nothing"). Pure, so the mapping is unit-tested without a live
// request.
export function describeAdzunaFailure(status: number, body?: string): string {
  if (status === 429)
    return "Adzuna rate limit / monthly quota reached (HTTP 429) — results unavailable, not empty";
  if (status === 401 || status === 403)
    return "Adzuna auth failed (HTTP " + status + ") — check ADZUNA_APP_ID / ADZUNA_APP_KEY";
  if (status >= 500) return `Adzuna service error (HTTP ${status})`;
  const extra = body ? ` — ${body.slice(0, 120)}` : "";
  return `Adzuna request failed (HTTP ${status})${extra}`;
}

// Map an Adzuna response body to Signals. Pure (no network): the standalone
// parser is what the Step 4 "Adzuna yields results" test exercises. Company
// names are canonicalized so a prospect's many postings collapse into one
// company at the grouping layer instead of fragmenting.
export function parseAdzunaResults(
  data: AdzunaResponse,
  opts: { stateCode: string }
): Signal[] {
  const results = data.results ?? [];
  const out: Signal[] = [];
  const seen = new Set<string>();

  for (const job of results) {
    const rawCompany = job.company?.display_name?.trim();
    if (!rawCompany) continue; // no employer -> not a prospect
    const title = (job.title ?? "").replace(/\s+/g, " ").trim();
    if (!title) continue;

    const company = canonicalCompany(rawCompany);
    const clean = stripHtml(job.description ?? "");
    const text = `${title} ${clean}`;
    const { detectedSoftware, productTypes } = classifyText(text);
    const camRelevant = isCamRelevant(text);
    const hasCam = productTypes.includes("cam");
    const hasCadOnly = !hasCam && productTypes.includes("cad");

    const created = job.created ? new Date(job.created) : null;
    const daysOld =
      created && !Number.isNaN(created.getTime())
        ? Math.floor((Date.now() - created.getTime()) / 86_400_000)
        : undefined;

    const locName = job.location?.display_name ?? "";
    const city = locName.split(",")[0]?.trim() || opts.stateCode;
    const id = `adz-${job.id ?? `${company}-${title}`}`;
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      company,
      industry: job.category?.label || "Manufacturing",
      city,
      state: opts.stateCode,
      distanceMiles: 0,
      detectedSoftware,
      // [] = Unclassified (surfaced, never dropped).
      productTypes,
      signalType: "Job Posting",
      title,
      description: summarize(
        clean || `${company} is hiring for ${title} in ${locName || opts.stateCode}.`,
        260
      ),
      sourceLabel: `Adzuna · ${company} jobs`,
      sourceUrl: job.redirect_url || "https://www.adzuna.com",
      postedAgo: relativeAge(created),
      signalStrength:
        scoreSignal({ hasCam, hasCadOnly, productTypes, daysOld }) +
        (camRelevant ? 5 : 0),
      contacts: [],
      camRelevant,
      manufacturingRelevant: isManufacturingRelevant({ description: text }),
    });
  }

  return out;
}

const MILES_TO_KM = 1.60934;

// ---------------------------------------------------------------------------
// Adzuna search-term sanitization (SEARCH SEED ONLY — the catalog detection
// keywords and the routeMatches filter set are deliberately left untouched).
//
// Adzuna's what_or ORs the individual WORDS of each term, so multi-word software
// names tokenize into common English ("master cam" -> "master","cam") and flood
// the feed with false matches. We collapse those names to the single-token form
// that already exists as a detection keyword, and drop overloaded stopwords.
// ---------------------------------------------------------------------------

// Multi-word software names -> their single-token sibling (search seed only).
// Each target already exists as a catalog detection keyword, so collapsing loses
// no recall while removing the fragment tokens.
const ADZUNA_COLLAPSE: Record<string, string> = {
  "master cam": "mastercam",
  "master-cam": "mastercam",
  "hsm works": "hsmworks",
  "hsm-works": "hsmworks",
  "bob cad": "bobcad",
  "surf cam": "surfcam",
  "edge cam": "edgecam",
  "feature cam": "featurecam",
  "fusion 360": "fusion360",
};

// Tokens dropped from the Adzuna search seed. "cam" collides with Cost/Control
// Account Manager and "hsm" with Hardware Security Module (the tools survive as
// single tokens mastercam/hsmworks, so no recall is lost); "dp" is a low-value
// 2-letter fragment from "dp esprit" that only matched noise. Exported so the
// drop set is reviewable/tunable in one place.
export const ADZUNA_STOPWORDS = new Set<string>(["cam", "hsm", "dp"]);

// Build a route OR-query. ROLE tokens are emitted BEFORE software tokens so that
// when the 24-token cap bites it truncates software-name fragments, never the
// role terms — the route's primary discovery signal. Multi-word software names
// are collapsed first; stopword tokens are dropped from both. Capped to keep the
// URL within Adzuna's length limits.
function whatOr(search: { roles: string[]; software: string[] }): string {
  const seen = new Set<string>();
  const words: string[] = [];
  const add = (terms: string[]) => {
    for (const t of terms) {
      const collapsed = ADZUNA_COLLAPSE[t.toLowerCase()] ?? t;
      for (const w of collapsed.toLowerCase().split(/\s+/)) {
        if (w && !ADZUNA_STOPWORDS.has(w) && !seen.has(w)) {
          seen.add(w);
          words.push(w);
        }
      }
    }
  };
  add(search.roles); // roles first — protected from cap truncation
  add(search.software);
  return words.slice(0, 24).join(" ");
}

// Pure: build the route + geo query params (no credentials). Adzuna is the only
// radius-honoring source, so the radius rule lives here: `distance` (km) is set
// ONLY for a city pull with a positive mileage radius, never for a state pull.
// Exposed for the radius test.
export function buildAdzunaSearchParams(
  place: Place,
  radius: string,
  search: { roles: string[]; software: string[] }
): URLSearchParams {
  const params = new URLSearchParams({
    results_per_page: "50",
    "content-type": "application/json",
  });
  const what = whatOr(search);
  if (what) params.set("what_or", what);

  if (place.type === "city") {
    params.set("where", place.label || place.name);
    const miles = Number.parseInt(radius, 10);
    if (Number.isFinite(miles) && miles > 0) {
      params.set("distance", String(Math.round(miles * MILES_TO_KM)));
    }
  } else {
    params.set("where", place.name); // state / province name, state-wide
  }
  return params;
}

export async function fetchAdzunaJobs(
  place: Place,
  radius: string,
  search: { roles: string[]; software: string[] }
): Promise<Signal[]> {
  const appId = env("ADZUNA_APP_ID");
  const appKey = env("ADZUNA_APP_KEY");
  // Defensive: the aggregate gates on isAdzunaConfigured() and marks the source
  // SKIPPED when keys are absent, so this should not run unconfigured. Returning
  // [] (rather than throwing) keeps a misconfigured call from reading as an
  // error; the skipped status already communicates "not wired".
  if (!appId || !appKey) return [];

  const country = (place.country || "US").toLowerCase(); // us / ca
  const params = buildAdzunaSearchParams(place, radius, search);
  params.set("app_id", appId);
  params.set("app_key", appKey);

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": BRAND.userAgent },
      next: { revalidate: 1800 }, // 30 minutes
    });
  } catch (err) {
    // Network failure is degradation, not "no results" — throw so the aggregate
    // records this source as errored (distinct from an empty territory).
    throw new Error(
      `Adzuna fetch failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!res.ok) {
    // Best-effort body for context; the status-based message is the real signal
    // and is thrown regardless, so the degradation is never silently swallowed.
    const body = await res.text().catch(() => "");
    throw new Error(describeAdzunaFailure(res.status, body));
  }

  const data = (await res.json()) as AdzunaResponse;
  if (data.exception) {
    throw new Error(`Adzuna error: ${data.exception}`);
  }

  const out = parseAdzunaResults(data, { stateCode: place.code });
  out.sort((a, b) => b.signalStrength - a.signalStrength);
  return out.slice(0, 25);
}
