// Per-section assembly of a grounded brief from one company's signals. Every
// field is built through a provenance builder, so nothing is untagged. The
// grounded floor (header, related signals, displacement, contacts) needs no LLM
// and no ZoomInfo. LLM prose, when present, is tagged inferredFromSignals so it
// carries the signals it paraphrased; absent, those slots render as pending.

import type { CompanyGroup } from "@/lib/signal-grouping";
import type { Signal } from "@/types/signal";
import type { ProductTypeId } from "@/types/product";
import { PRODUCT_TYPE_BY_ID, fitForPrompt } from "@/lib/catalog";
import { targetsForIndustry } from "@/lib/linkedin-targets";
import { BRAND } from "@/lib/brand";
import {
  detected,
  computed,
  inferred,
  inferredFromSignals,
  curated,
  curatedGap,
  type DetectedField,
  type ComputedField,
  type InferredField,
  type CuratedField,
  type CuratedGap,
  type SourceRef,
} from "./provenance";
import { computeFitScore } from "./fit-score";
import { companyMotion, motionBasis, type Motion } from "./motion";

// --- Model -----------------------------------------------------------------

export type DisciplineField = DetectedField<string> | InferredField;
export type ContactField = DetectedField<string> | CuratedField;

export interface RelatedSignal {
  headline: DetectedField<string>;
  source: DetectedField<string>;
  date: DetectedField<string>;
  relevance: DetectedField<number>; // signalStrength, detected (Refinement 1)
}

export interface DisplacementEntry {
  competitor: DetectedField<string>;
  replacement: string; // product line, catalog-fixed, not genericized
  positioning: CuratedField; // real catalog reasons or a pending gap
}

export interface KeyContact {
  role: ContactField;
  dept: ContactField;
  valueProp: CuratedField;
  tier: InferredField;
  named: boolean; // true only with ZoomInfo
}

export interface ProseSection {
  text: InferredField;
  discipline?: DisciplineField;
  proof: CuratedField; // proof line / solution, gap until a real battlecard
}

export interface GroundedBrief {
  generatedAt: string; // report metadata, not a prospect claim
  header: {
    company: DetectedField<string>;
    vertical: DetectedField<string>;
    fitScore: ComputedField;
    motion: Motion; // enum, drives the badge
    motionField: InferredField; // motion with basis + refs
  };
  disciplines: DisciplineField[];
  reseller: { name: string; short: string; supportLine: string };
  executiveSummary: InferredField | CuratedGap; // LLM prose or pending
  painPoints: ProseSection[];
  talkingPoints: ProseSection[];
  displacement: DisplacementEntry[];
  keyContacts: KeyContact[];
  relatedSignals: RelatedSignal[];
}

// --- Optional LLM prose input (already validated by generate.ts) ------------

export interface BriefProse {
  executiveSummary?: string;
  painPoints?: { text: string; discipline?: ProductTypeId }[];
  talkingPoints?: { text: string; discipline?: ProductTypeId }[];
}

export interface AssembleInput {
  group: CompanyGroup;
  routeCount: number;
  generatedAt: string;
  prose?: BriefProse;
}

// --- Helpers ---------------------------------------------------------------

function sigRef(s: Signal): SourceRef {
  return { signalId: s.id, label: `${s.signalType}: ${s.title}`, url: s.sourceUrl };
}

function allRefs(group: CompanyGroup): SourceRef[] {
  return group.signals.map(sigRef);
}

// Active vs implied disciplines. A discipline carried by a SINGLE-discipline tool
// (Mastercam -> cam) or by relevance keywords is directly detected; one carried
// ONLY by a suite tool (NX -> cad+cam+simulation) is an inferred hypothesis,
// never asserted as fact. Refs point to the signals classified to the discipline.
function classifyDisciplines(group: CompanyGroup): DisciplineField[] {
  const directVia = new Map<ProductTypeId, string>();
  const suiteVia = new Map<ProductTypeId, string>();
  for (const s of group.signals) {
    for (const d of s.detectedSoftware) {
      const slot = d.productTypes.length > 1 ? suiteVia : directVia;
      for (const t of d.productTypes) if (!slot.has(t)) slot.set(t, d.name);
    }
  }

  const out: DisciplineField[] = [];
  for (const id of group.productTypes) {
    const label = PRODUCT_TYPE_BY_ID[id]?.label ?? id;
    const refs = group.signals.filter((s) => s.productTypes.includes(id)).map(sigRef);
    const direct = directVia.has(id) || (!suiteVia.has(id) && refs.length > 0);
    if (direct) {
      out.push(
        refs.length > 0
          ? detected(label, refs)
          : inferred(label, `hypothesis: ${label} relevance in public text`)
      );
    } else {
      const via = suiteVia.get(id) ?? "a suite tool";
      out.push(
        inferredFromSignals(
          label,
          `hypothesis: implied by ${via} (suite tool), not directly detected`,
          refs.length ? refs : group.signals.map(sigRef)
        )
      );
    }
  }
  return out;
}

function buildRelatedSignals(group: CompanyGroup): RelatedSignal[] {
  return group.signals.map((s) => {
    const ref = [sigRef(s)];
    return {
      headline: detected(s.title, ref),
      source: detected(s.sourceLabel, ref),
      date: detected(s.postedAgo, ref),
      relevance: detected(s.signalStrength, ref),
    };
  });
}

function buildDisplacement(group: CompanyGroup): DisplacementEntry[] {
  const out: DisplacementEntry[] = [];
  for (const name of group.detectedSoftware) {
    const fit = fitForPrompt(name);
    if (!fit) continue; // not a competitor with a mapping (our own portfolio, etc.)
    const refs = group.signals
      .filter((s) => s.detectedSoftware.some((d) => d.name === name))
      .map(sigRef);
    out.push({
      competitor: detected(fit.competitor, refs.length ? refs : allRefs(group)),
      replacement: fit.replacement, // product line stays literal
      positioning:
        !fit.draft && fit.reasons.length > 0
          ? curated(fit.reasons.join(" "), "catalog fit (validated)")
          : curatedGap("pending HRS battlecard"),
    });
  }
  return out;
}

function buildKeyContacts(group: CompanyGroup): KeyContact[] {
  // Real named contacts arrive only with ZoomInfo (Signal.contacts).
  const realRefByName = new Map<string, SourceRef>();
  for (const s of group.signals) {
    for (const c of s.contacts ?? []) {
      const key = c.name?.trim().toLowerCase();
      if (key && !realRefByName.has(key)) realRefByName.set(key, sigRef(s));
    }
  }
  const realContacts: KeyContact[] = [];
  for (const s of group.signals) {
    for (const c of s.contacts ?? []) {
      const key = c.name?.trim().toLowerCase();
      if (!key) continue;
      const ref = realRefByName.get(key);
      if (!ref) continue;
      realRefByName.delete(key); // dedupe
      realContacts.push({
        role: detected(`${c.name}, ${c.title}`, [ref]),
        dept: curated(c.title, "ZoomInfo title"),
        valueProp: curatedGap("pending HRS battlecard"),
        tier: inferred("primary", "named decision-maker"),
        named: true,
      });
    }
  }
  if (realContacts.length > 0) return realContacts;

  // ZoomInfo-absent floor: industry role TEMPLATES, no names, no fabrication.
  return targetsForIndustry(group.industry).map((t, i) => ({
    role: curated(t.role, "industry role template"),
    dept: curated(t.department, "industry role template"),
    valueProp: curated(t.why, "industry role template"),
    tier: inferred(i === 0 ? "primary" : "secondary", "template ordering"),
    named: false,
  }));
}

function proseSections(
  items: { text: string; discipline?: ProductTypeId }[] | undefined,
  group: CompanyGroup
): ProseSection[] {
  if (!items || items.length === 0) return [];
  const refs = allRefs(group);
  return items.map((p) => ({
    text: inferredFromSignals(p.text, "paraphrase of the prospect's signals", refs),
    discipline: p.discipline
      ? inferred(PRODUCT_TYPE_BY_ID[p.discipline]?.label ?? p.discipline, "tagged discipline")
      : undefined,
    proof: curatedGap("pending HRS battlecard"),
  }));
}

// --- Assemble --------------------------------------------------------------

export function assembleBrief(input: AssembleInput): GroundedBrief {
  const { group, routeCount, generatedAt, prose } = input;
  const refs = allRefs(group);
  const motion = companyMotion(group.detectedSoftware);

  const detectionRefs = group.signals
    .filter((s) => s.detectedSoftware.length > 0)
    .map(sigRef);

  return {
    generatedAt,
    header: {
      company: detected(group.company, refs),
      vertical: detected(group.industry, refs),
      fitScore: computeFitScore({ signals: group.signals, routeCount }),
      motion,
      motionField: inferredFromSignals(
        motion,
        motionBasis(motion, group.detectedSoftware),
        detectionRefs.length ? detectionRefs : refs
      ),
    },
    disciplines: classifyDisciplines(group),
    reseller: {
      name: BRAND.reseller.name,
      short: BRAND.reseller.short,
      supportLine: BRAND.reseller.supportLine,
    },
    executiveSummary: prose?.executiveSummary
      ? inferredFromSignals(prose.executiveSummary, "summary of the prospect's signals", refs)
      : curatedGap("pending AI summary (set ANTHROPIC_API_KEY)"),
    painPoints: proseSections(prose?.painPoints, group),
    talkingPoints: proseSections(prose?.talkingPoints, group),
    displacement: buildDisplacement(group),
    keyContacts: buildKeyContacts(group),
    relatedSignals: buildRelatedSignals(group),
  };
}
