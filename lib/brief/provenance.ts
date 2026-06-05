// Grounded-brief provenance core. Every brief field is one of four kinds, and a
// field can only be produced by the builders below (a module-private brand makes
// a plain object literal non-assignable), so nothing reaches the render untagged.
//
// The number rule is enforced by the TYPES: only `detected` and `computed` may
// carry a number. `inferred` and `curated` accept qualitative values only
// (string | string[]), so a statistic cannot be tagged as a hypothesis.
//
// Computed numbers are RECOMPUTABLE, not just basis-tagged: the basis names a
// registered scoring function plus the exact inputs and weights, and recompute()
// re-runs it and must land on the same value (the recompute test proves it).

import type { Signal } from "@/types/signal";

export type Provenance = "detected" | "inferred" | "computed" | "curated";

// A pointer to the signal that proves (detected) or fed (computed/inferred) a
// field, so a rep can trace any claim back to its source.
export interface SourceRef {
  signalId: Signal["id"];
  label: string;
  url?: string;
}

// Structured, recomputable basis for a computed number. `fn` is a registered
// scorer key; recompute(field) === field.value must hold.
export interface ComputeBasis {
  fn: string;
  inputs: Record<string, number>;
  weights: Record<string, number>;
}

// Builder-only construction: this brand is a module-private symbol, so the
// builders below are the only code that can produce a Field. A plain literal
// elsewhere cannot name the symbol, so it is not assignable to these interfaces.
// A real (non-declare) symbol, so it also exists at runtime where the builders
// set it.
const FIELD_BRAND = Symbol("briefField");
interface Branded {
  readonly [FIELD_BRAND]: true;
}

export interface DetectedField<T = unknown> extends Branded {
  readonly provenance: "detected";
  readonly value: T;
  readonly sourceRef: SourceRef[]; // >= 1
}

export interface ComputedField extends Branded {
  readonly provenance: "computed";
  readonly value: number;
  readonly basis: ComputeBasis;
  readonly sourceRef: SourceRef[]; // every detected input
}

export interface InferredField extends Branded {
  readonly provenance: "inferred";
  readonly value: string | string[]; // qualitative only, never a number
  readonly basis: string;
  readonly sourceRef?: SourceRef[]; // required for LLM prose (see inferredFromSignals)
}

export interface CuratedRealField extends Branded {
  readonly provenance: "curated";
  readonly value: string | string[];
  readonly basis: string; // real battlecard / case-study reference
}

// A curated slot with no real library is a typed GAP, never prose, so a
// fabrication can never occupy it. Rendered visibly ("pending battlecard").
export interface CuratedGap extends Branded {
  readonly provenance: "curated";
  readonly gap: true;
  readonly pending: string;
}

export type CuratedField = CuratedRealField | CuratedGap;
export type AnyField =
  | DetectedField
  | ComputedField
  | InferredField
  | CuratedField;

// --- Builders (the only construction path) ---------------------------------

export function detected<T>(value: T, sourceRef: SourceRef[]): DetectedField<T> {
  if (sourceRef.length === 0) {
    throw new Error("detected field requires at least one sourceRef");
  }
  return { [FIELD_BRAND]: true, provenance: "detected", value, sourceRef };
}

export function computed(
  value: number,
  basis: ComputeBasis,
  sourceRef: SourceRef[]
): ComputedField {
  if (!basis.fn) {
    throw new Error("computed field requires a named scoring function (basis.fn)");
  }
  if (sourceRef.length === 0) {
    throw new Error("computed field requires the sourceRefs of its detected inputs");
  }
  return { [FIELD_BRAND]: true, provenance: "computed", value, basis, sourceRef };
}

// Vertical-level inference: sourceRef is OPTIONAL here, allowed only for an
// inference with an explicit basis (e.g. "industry from NAICS 336411"). LLM
// prose must use inferredFromSignals instead.
export function inferred(
  value: string | string[],
  basis: string,
  sourceRef?: SourceRef[]
): InferredField {
  if (!basis.trim()) {
    throw new Error("inferred field requires a basis");
  }
  return { [FIELD_BRAND]: true, provenance: "inferred", value, basis, sourceRef };
}

// LLM prose inference (Executive Summary, Talking Points, pain-point text,
// talk-tracks): the sourceRef list is REQUIRED, so a rep can trace any sentence
// back to the signals it paraphrases (Refinement 2).
export function inferredFromSignals(
  value: string | string[],
  basis: string,
  sourceRef: SourceRef[]
): InferredField {
  if (sourceRef.length === 0) {
    throw new Error(
      "inferredFromSignals (LLM prose) requires the signals it was derived from"
    );
  }
  return inferred(value, basis, sourceRef);
}

export function curated(value: string | string[], basis: string): CuratedRealField {
  if (!basis.trim()) {
    throw new Error("curated field requires a real library reference as basis");
  }
  return { [FIELD_BRAND]: true, provenance: "curated", value, basis };
}

export function curatedGap(pending: string): CuratedGap {
  return { [FIELD_BRAND]: true, provenance: "curated", gap: true, pending };
}

export function isCuratedGap(f: CuratedField): f is CuratedGap {
  return "gap" in f && f.gap === true;
}

// --- Recompute registry (Refinement 1) -------------------------------------
// A computed number is only trustworthy if it can be reproduced. Scorers
// register by key; recompute(field) re-runs the named scorer over the stored
// inputs and weights and must equal field.value.

export type Scorer = (
  inputs: Record<string, number>,
  weights: Record<string, number>
) => number;

const SCORERS = new Map<string, Scorer>();

export function registerScorer(fn: string, scorer: Scorer): void {
  SCORERS.set(fn, scorer);
}

export function recompute(field: ComputedField): number {
  const scorer = SCORERS.get(field.basis.fn);
  if (!scorer) {
    throw new Error(`no registered scorer for "${field.basis.fn}"`);
  }
  return scorer(field.basis.inputs, field.basis.weights);
}
