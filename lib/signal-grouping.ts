import type { Signal } from "@/types/signal";
import type { ProductTypeId } from "@/types/product";

export type Urgency = "high" | "medium" | "low";

export interface CompanyGroup {
  key: string;
  company: string;
  industry: string;
  state: string;
  city: string;
  signals: Signal[];
  topSignal: Signal;
  maxStrength: number;
  urgency: Urgency;
  detectedSoftware: string[];
  productTypes: ProductTypeId[];
  oneLiner: string;
  oldestPostedAgo: string;
  manufacturingRelevant: boolean;
}

// Grouping key for a company name: lowercased, punctuation collapsed, and legal
// suffixes (Inc / LLC / Corp / Co / Ltd ...) removed, so suffix variants of one
// company share a key. Exported so the company-alias layer (lib/signal-sources/
// company.ts) keys its alias map the same way. Acronym/short-form variants that
// survive this (e.g. "LMCO") are handled by that alias layer before grouping.
export function companyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|llc|corp|corporation|company|co|ltd|incorporated|the)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function urgencyFor(strength: number): Urgency {
  if (strength >= 80) return "high";
  if (strength >= 55) return "medium";
  return "low";
}

function dedupeSoftware(signals: Signal[]): string[] {
  const set = new Set<string>();
  for (const s of signals) {
    for (const sw of s.detectedSoftware) {
      if (sw.name) {
        set.add(sw.version ? `${sw.name} ${sw.version}` : sw.name);
      }
    }
  }
  return Array.from(set);
}

function pickIndustry(signals: Signal[]): string {
  const counts = new Map<string, number>();
  for (const s of signals) {
    if (!s.industry) continue;
    counts.set(s.industry, (counts.get(s.industry) ?? 0) + 1);
  }
  if (counts.size === 0) return "Manufacturing";
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

function buildOneLiner(top: Signal): string {
  const sw = top.detectedSoftware
    .filter((x) => x.name)
    .map((x) => (x.version ? `${x.name} ${x.version}` : x.name))
    .join(", ");
  const titleClean = top.title.replace(/\s+/g, " ").trim();
  const parts: string[] = [];

  switch (top.signalType) {
    case "Job Posting":
      parts.push(titleClean);
      if (sw) parts.push(sw);
      parts.push(top.postedAgo);
      break;
    case "Gov Contract":
      // Title from USAspending already includes amount and agency, e.g.
      // "Department of the Navy contract award, $14.6M". Append a short
      // slice of the description plus posted age.
      parts.push(titleClean);
      if (sw) parts.push(sw);
      else if (top.description) {
        const desc = top.description.replace(/\s+/g, " ").trim();
        const short = desc.length > 80 ? `${desc.slice(0, 80)}...` : desc;
        if (short) parts.push(short);
      }
      parts.push(top.postedAgo);
      break;
    case "News":
    case "Tech Adoption":
    default:
      parts.push(titleClean);
      if (sw) parts.push(sw);
      parts.push(top.postedAgo);
      break;
  }

  return parts.join(" · ");
}

export function groupSignalsByCompany(signals: Signal[]): CompanyGroup[] {
  const groups = new Map<string, CompanyGroup>();

  for (const s of signals) {
    const key = companyKey(s.company);
    if (!key) continue;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        company: s.company,
        industry: s.industry,
        state: s.state,
        city: s.city,
        signals: [],
        topSignal: s,
        maxStrength: s.signalStrength,
        urgency: urgencyFor(s.signalStrength),
        detectedSoftware: [],
        productTypes: [],
        oneLiner: "",
        oldestPostedAgo: s.postedAgo,
        manufacturingRelevant: false,
      };
      groups.set(key, group);
    }
    group.signals.push(s);
    if (s.signalStrength > group.maxStrength) {
      group.maxStrength = s.signalStrength;
      group.topSignal = s;
    }
  }

  for (const g of groups.values()) {
    g.detectedSoftware = dedupeSoftware(g.signals);
    g.productTypes = Array.from(
      new Set(g.signals.flatMap((s) => s.productTypes))
    );
    g.industry = pickIndustry(g.signals);
    g.urgency = urgencyFor(g.maxStrength);
    g.oneLiner = buildOneLiner(g.topSignal);
    g.manufacturingRelevant = g.signals.some((s) => !!s.manufacturingRelevant);
  }

  return Array.from(groups.values()).sort((a, b) => b.maxStrength - a.maxStrength);
}
