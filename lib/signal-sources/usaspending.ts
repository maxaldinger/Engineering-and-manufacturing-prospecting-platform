// Real federal contract awards from USAspending.gov.
// API docs: https://api.usaspending.gov/
// No auth required, free, public domain data.

import type { Signal } from "@/types/signal";
import {
  industryFromNaics,
  isManufacturingRelevant,
  MFG_NAICS_PREFIXES,
  relativeAge,
  scoreSignal,
  summarize,
} from "./extract";
import { classifyText } from "@/lib/catalog";

const ENDPOINT = "https://api.usaspending.gov/api/v2/search/spending_by_award/";

interface USAspendingAward {
  internal_id?: number;
  "Award ID"?: string;
  generated_internal_id?: string;
  "Recipient Name"?: string;
  "Award Amount"?: number;
  "Award Type"?: string;
  "Awarding Agency"?: string;
  "Awarding Sub Agency"?: string;
  "Description"?: string;
  "NAICS"?: string;
  "naics_code"?: string;
  "Place of Performance City Name"?: string | null;
  "Place of Performance State Code"?: string | null;
  "Recipient Location City Name"?: string | null;
  "Recipient Location State Code"?: string | null;
  "Last Modified Date"?: string;
  "Period of Performance Start Date"?: string;
  "Start Date"?: string;
}

interface USAspendingResponse {
  results: USAspendingAward[];
  page_metadata?: { page: number; hasNext: boolean };
}

function startDate(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function endDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function awardToSignal(a: USAspendingAward): Signal | null {
  const company = (a["Recipient Name"] ?? "").trim();
  // Prefer recipient location (where the contractor is based) and fall
  // back to place of performance. Both are sometimes redacted (null).
  const city = (
    a["Recipient Location City Name"] ??
    a["Place of Performance City Name"] ??
    ""
  ).trim();
  const state = (
    a["Recipient Location State Code"] ??
    a["Place of Performance State Code"] ??
    ""
  ).trim();
  if (!company || !state) return null;

  const naics = a["naics_code"] ?? a["NAICS"] ?? "";
  const description = a["Description"] ?? "";
  const amount = a["Award Amount"] ?? 0;
  const lastModified = a["Last Modified Date"] ?? a["Start Date"] ?? a["Period of Performance Start Date"] ?? null;
  const lastModifiedDate = lastModified ? new Date(lastModified) : null;
  const daysOld = lastModifiedDate
    ? Math.floor((Date.now() - lastModifiedDate.getTime()) / 86_400_000)
    : undefined;

  const { detectedSoftware, productTypes } = classifyText(description);
  const hasCam = detectedSoftware.length > 0;
  const manufacturingRelevant = isManufacturingRelevant({
    naics,
    description,
  });

  // Build a readable title. USAspending descriptions are sometimes very
  // technical, so we show the dollar amount + agency for orientation.
  const sub = (a["Awarding Sub Agency"] ?? a["Awarding Agency"] ?? "Federal").trim();
  const titleAmount =
    amount && amount > 0
      ? `, $${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 1 : 2)}M`
      : "";
  const title = `${sub} contract award${titleAmount}`;

  const internalId = a.generated_internal_id ?? a["Award ID"] ?? `${company}-${state}-${city}`;

  return {
    id: `usa-${internalId}`,
    company,
    industry: industryFromNaics(naics),
    city: city || "Statewide",
    state,
    distanceMiles: 0,
    employeeEstimate: undefined,
    revenueEstimate: undefined,
    detectedSoftware,
    // [] = Unclassified. Federal contract descriptions rarely name a CAD/CAM
    // tool, so most awards land here — manufacturingRelevant carries the
    // industry signal instead.
    productTypes,
    signalType: "Gov Contract",
    title,
    description: summarize(description || `${sub} award to ${company} in ${city || state}.`),
    sourceLabel: "USAspending.gov",
    sourceUrl: `https://www.usaspending.gov/award/${a.generated_internal_id ?? ""}`,
    postedAgo: relativeAge(lastModifiedDate),
    signalStrength: scoreSignal({ hasCam, amount, daysOld }) + (manufacturingRelevant ? 3 : 0),
    contacts: [],
    manufacturingRelevant,
  };
}

export async function fetchUSAspendingAwards(stateCode: string, country: "US" | "CA"): Promise<Signal[]> {
  if (country !== "US") return []; // USAspending only has federal US data
  if (!stateCode) return [];

  const body = {
    filters: {
      time_period: [
        { start_date: startDate(365), end_date: endDate() },
      ],
      place_of_performance_locations: [{ country: "USA", state: stateCode }],
      // USAspending accepts either a flat array of NAICS codes/prefixes
      // or a require/exclude object. The flat array form is simplest.
      naics_codes: MFG_NAICS_PREFIXES,
      award_type_codes: ["A", "B", "C", "D"],
    },
    fields: [
      "Award ID",
      "Recipient Name",
      "Award Amount",
      "Award Type",
      "Awarding Agency",
      "Awarding Sub Agency",
      "Description",
      "naics_code",
      "Place of Performance City Name",
      "Place of Performance State Code",
      "Recipient Location City Name",
      "Recipient Location State Code",
      "Last Modified Date",
      "Period of Performance Start Date",
      "Start Date",
    ],
    page: 1,
    limit: 50,
    sort: "Last Modified Date",
    order: "desc",
    subawards: false,
  };

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // Cache for 1 hour. Vercel will cache the fetch at the platform layer.
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`USAspending API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as USAspendingResponse;
  const rawSignals = (data.results ?? [])
    .map(awardToSignal)
    .filter((s): s is Signal => s !== null);

  // Collapse to one signal per company. The rep wants one card per
  // contractor, not one per contract line item. Keep the strongest signal
  // (typically the largest or most recent award) and aggregate the
  // contract count into the description.
  const byCompany = new Map<string, { signal: Signal; count: number }>();
  for (const s of rawSignals) {
    const existing = byCompany.get(s.company);
    if (!existing) {
      byCompany.set(s.company, { signal: s, count: 1 });
    } else {
      existing.count += 1;
      if (s.signalStrength > existing.signal.signalStrength) {
        existing.signal = s;
      }
    }
  }

  const out: Signal[] = [];
  for (const { signal, count } of byCompany.values()) {
    if (count > 1) {
      out.push({
        ...signal,
        description: `${count} federal contract awards in the last 12 months. Most recent: ${signal.description}`,
      });
    } else {
      out.push(signal);
    }
  }
  return out;
}
