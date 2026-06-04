// The fit score: the brief's one self-derived number. COMPUTED and RECOMPUTABLE
// (Refinement 1), not LLM-asserted (the old AiBrief.score is the model's guess;
// this replaces it). Weights are visible and tunable here; bump FIT_SCORE_FN
// when they change so a stored basis never silently recomputes under new weights.
//
// Shape (Decision 1): normalized mean of signalStrength, plus a bounded bonus for
// routeCount and for distinct signalType coverage. Activity (routes, type spread)
// lifts the score; raw discipline-count does NOT, so taxonomy-rich suite-tool
// expansion cannot inflate it.

import type { Signal } from "@/types/signal";
import {
  computed,
  registerScorer,
  type ComputedField,
  type SourceRef,
} from "./provenance";

export const FIT_SCORE_FN = "fitScore.v1";

// Initial weights. Surfaced for tuning against real output once generation is
// wired; see fit-score.test.ts for the scores these produce on fixtures.
export const FIT_SCORE_WEIGHTS = {
  strength: 1, // multiplier on the 0-99 mean signalStrength base
  perRoute: 5, // bonus per route beyond the first
  routeCap: 15, // max route bonus
  perType: 3, // bonus per distinct signalType beyond the first
  typeCap: 9, // max signal-type bonus
} as const;

// The registered scorer. Pure: (inputs, weights) -> number. recompute() re-runs
// exactly this over the stored basis.
function score(
  inputs: Record<string, number>,
  w: Record<string, number>
): number {
  const base = (inputs.meanStrength ?? 0) * (w.strength ?? 1);
  const routeBonus = Math.min(
    w.routeCap ?? 0,
    Math.max(0, (inputs.routeCount ?? 0) - 1) * (w.perRoute ?? 0)
  );
  const typeBonus = Math.min(
    w.typeCap ?? 0,
    Math.max(0, (inputs.signalTypeCount ?? 0) - 1) * (w.perType ?? 0)
  );
  return Math.max(0, Math.min(100, Math.round(base + routeBonus + typeBonus)));
}

registerScorer(FIT_SCORE_FN, score);

// Only the fields the score reads, so fixtures stay small and the real Signal
// satisfies it.
export type FitScoreSignal = Pick<
  Signal,
  "id" | "signalStrength" | "signalType" | "title" | "sourceUrl"
>;

export interface FitScoreInput {
  signals: FitScoreSignal[];
  // How many discovery routes surfaced this company. A single-route pull passes
  // 1; the cross-route portfolio union passes its real count (wired in the
  // generation step).
  routeCount: number;
}

export function computeFitScore(input: FitScoreInput): ComputedField {
  const { signals, routeCount } = input;
  const meanStrength =
    signals.length > 0
      ? signals.reduce((s, x) => s + x.signalStrength, 0) / signals.length
      : 0;
  const signalTypeCount = new Set(signals.map((s) => s.signalType)).size;

  const inputs = { meanStrength, routeCount, signalTypeCount };
  const value = score(inputs, FIT_SCORE_WEIGHTS);

  // Cite EVERY signal the score was computed over (Refinement 1 / test 3).
  const sourceRef: SourceRef[] = signals.map((s) => ({
    signalId: s.id,
    label: `${s.signalType}: ${s.title}`,
    url: s.sourceUrl,
  }));

  return computed(
    value,
    { fn: FIT_SCORE_FN, inputs, weights: { ...FIT_SCORE_WEIGHTS } },
    sourceRef
  );
}
