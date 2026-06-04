# Grounded brief: section-to-provenance map (spec of record)

Every brief field is built through a `provenance.ts` builder, so nothing is
untagged. `detected` and `computed` are the only fields that may carry a number;
`inferred` and `curated` are qualitative only. A `curated` slot with no real HRS
battlecard renders as a visible `CuratedGap` ("pending HRS battlecard"), never
prose.

| Section / field | Provenance | Basis / source | ZoomInfo absent |
|---|---|---|---|
| Header: company | detected | sourceRef = the company's signals | full |
| Header: vertical | detected | from `industry` on the signals | full |
| Header: fit score | **computed** | `fitScore.v1`, inputs + weights, sourceRef = ALL signals; recomputable | full |
| Header: motion | inferred | `motionField`, basis from detected stack, sourceRef = detection signals | full |
| Header: timestamp | report metadata (not a claim Field) | generation time | full |
| Disciplines (direct) | detected | signals classified to the discipline | full |
| Disciplines (suite-implied) | inferred | "implied by <suite tool>, not directly detected" | full |
| Executive Summary | inferred (LLM) or CuratedGap | inferredFromSignals, refs = signals; pending if no LLM | partial |
| Why \<reseller\> | reseller name + supportLine from `BRAND.reseller`; battlecard claims -> CuratedGap | config | full, claims thin |
| Pain Points: text | inferred (LLM) | inferredFromSignals, refs = signals | partial |
| Pain Points: discipline | detected / inferred | as Disciplines | full |
| Pain Points: reseller solution | CuratedGap | pending HRS battlecard | gap |
| Talking Points: Q/A | inferred (LLM) | inferredFromSignals, refs = signals | partial |
| Talking Points: proof line | CuratedGap | pending HRS battlecard | gap |
| Competitive Displacement: competitor | detected | sourceRef = signals naming it | full |
| Competitive Displacement: positioning | curated (real catalog reasons, CAM) or CuratedGap (draft) | catalog fit / pending | full |
| Key Contacts (ZoomInfo) | detected | named contact, sourceRef = ZoomInfo signal | named |
| Key Contacts (no ZoomInfo) | curated template | role/dept/why, no names, no stats | role templates |
| Related Signals: headline / source / date | detected | sourceRef + url | full (the floor) |
| **Related Signals: relevance** | **detected** | reads `signalStrength` from the signal (engine-computed, inputs not stored, so the brief cannot recompute it). The **fit score is the only brief-computed number.** | full |

## Number rule
A number appears only if DETECTED (read from a signal) or COMPUTED (derived by a
registered, recomputable scorer over detected inputs). LLM-asserted numbers are
stripped by the post-parse validator. Specific stats and named customers require
a real HRS battlecard, else they are omitted or downgraded to qualitative.

## Ranking and motion
Ranking keys on activity (route count, then signal count), never raw discipline
count, so a suite-tool taxonomy expansion does not outrank genuine multi-route
activity. Motion is stated explicitly: upsell when SOLIDWORKS is in the stack,
displacement when a competitor is, mixed when both.
