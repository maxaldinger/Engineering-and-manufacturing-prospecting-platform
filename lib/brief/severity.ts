// Per-pain-point severity: COMPUTED and RECOMPUTABLE, never LLM-asserted. A pain
// point's severity comes from the evidence backing it (the signals classified to
// its discipline, falling back to the whole company signal set when the pain
// point has no discipline or the discipline matches nothing). Like the fit score,
// the basis names a versioned scorer plus the exact inputs and weights, so
// recompute(field) reproduces the rendered value and the severity test proves it.

import type { Signal } from "@/types/signal";
import type { ProductTypeId } from "@/types/product";
import {
  computed,
  registerScorer,
  type ComputedField,
  type SourceRef,
} from "./provenance";

export const SEVERITY_FN = "severity.v1";

// Weights. Bump SEVERITY_FN when these change so a stored basis never silently
// recomputes under new weights.
export const SEVERITY_WEIGHTS = {
  strength: 1, // multiplier on the 0-99 mean signalStrength of the backing evidence
  perSignal: 6, // bonus per backing signal beyond the first
  signalCap: 18, // max evidence-count bonus
} as const;

// The registered scorer. Pure: (inputs, weights) -> number. recompute() re-runs
// exactly this over the stored basis.
function score(inputs: Record<string, number>, w: Record<string, number>): number {
  const base = (inputs.meanStrength ?? 0) * (w.strength ?? 1);
  const evidenceBonus = Math.min(
    w.signalCap ?? 0,
    Math.max(0, (inputs.signalCount ?? 0) - 1) * (w.perSignal ?? 0)
  );
  return Math.max(0, Math.min(100, Math.round(base + evidenceBonus)));
}

registerScorer(SEVERITY_FN, score);

// Only the fields severity reads, so fixtures stay small and a real Signal
// satisfies it.
export type SeveritySignal = Pick<
  Signal,
  "id" | "signalStrength" | "signalType" | "title" | "sourceUrl" | "productTypes"
>;

// The evidence backing a pain point: signals classified to its discipline, or the
// whole company set when the discipline is absent or matches no signal.
export function evidenceFor(
  signals: SeveritySignal[],
  discipline?: ProductTypeId
): SeveritySignal[] {
  if (discipline) {
    const scoped = signals.filter((s) => s.productTypes.includes(discipline));
    if (scoped.length > 0) return scoped;
  }
  return signals;
}

export function computeSeverity(evidence: SeveritySignal[]): ComputedField {
  const meanStrength =
    evidence.length > 0
      ? evidence.reduce((s, x) => s + x.signalStrength, 0) / evidence.length
      : 0;
  const inputs = { meanStrength, signalCount: evidence.length };
  const value = score(inputs, SEVERITY_WEIGHTS);

  // Cite every signal the severity was computed over.
  const sourceRef: SourceRef[] = evidence.map((s) => ({
    signalId: s.id,
    label: `${s.signalType}: ${s.title}`,
    url: s.sourceUrl,
  }));

  return computed(
    value,
    { fn: SEVERITY_FN, inputs, weights: { ...SEVERITY_WEIGHTS } },
    sourceRef
  );
}

export type SeverityBand = "high" | "medium" | "low";

// Render band for the color-coded chip. The number stays the source of truth;
// the band is a display bucket over it.
export function severityBand(value: number): SeverityBand {
  if (value >= 80) return "high";
  if (value >= 55) return "medium";
  return "low";
}
