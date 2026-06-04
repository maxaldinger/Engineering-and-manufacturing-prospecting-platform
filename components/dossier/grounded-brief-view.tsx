"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { isCuratedGap, type AnyField } from "@/lib/brief/provenance";
import type {
  GroundedBrief,
  DisciplineField,
  ContactField,
} from "@/lib/brief/assemble";
import type { Motion } from "@/lib/brief/motion";

// Provenance is shown inline, never hidden: detected links to its signal, computed
// reveals its math, inferred reads as a labeled hypothesis, a curated gap renders
// "pending ..." rather than prose.

const PROV_STYLE: Record<AnyField["provenance"], string> = {
  detected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  computed: "bg-blue-50 text-blue-700 border-blue-200",
  inferred: "bg-amber-50 text-amber-800 border-amber-200",
  curated: "bg-violet-50 text-violet-700 border-violet-200",
};

function ProvBadge({ f }: { f: AnyField }) {
  const gap = f.provenance === "curated" && isCuratedGap(f);
  const label = gap ? "pending" : f.provenance;
  const title =
    f.provenance === "computed"
      ? `${f.basis.fn}  ${JSON.stringify(f.basis.inputs)}  (cites ${f.sourceRef.length} signals)`
      : f.provenance === "inferred"
      ? f.basis
      : f.provenance === "curated"
      ? gap ? f.pending : f.basis
      : `${f.sourceRef.length} signal(s)`;
  const href =
    f.provenance === "detected"
      ? f.sourceRef[0]?.url
      : f.provenance === "computed"
      ? f.sourceRef[0]?.url
      : undefined;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] uppercase tracking-wider border align-middle",
        gap ? "bg-amber-50 text-amber-700 border-dashed border-amber-300" : PROV_STYLE[f.provenance]
      )}
    >
      {label}
      {href && (
        <a href={href} target="_blank" rel="noreferrer" aria-label="source">
          <ExternalLink className="h-2 w-2" />
        </a>
      )}
    </span>
  );
}

function fieldValue(f: AnyField): string {
  if (f.provenance === "curated" && isCuratedGap(f)) return f.pending;
  const v = "value" in f ? f.value : "";
  return Array.isArray(v) ? v.join("; ") : String(v);
}

function FieldText({ f, className }: { f: AnyField; className?: string }) {
  const gap = f.provenance === "curated" && isCuratedGap(f);
  const prefix = f.provenance === "inferred" ? "hypothesis: " : "";
  return (
    <span className={cn("text-sm", gap && "italic text-text-muted", className)}>
      {gap ? null : <span>{prefix}{fieldValue(f)} </span>}
      {gap && <span>{fieldValue(f)} </span>}
      <ProvBadge f={f} />
    </span>
  );
}

const MOTION_BADGE: Record<Motion, string> = {
  upsell: "bg-emerald-50 text-emerald-700 border-emerald-300",
  displacement: "bg-red-50 text-red-700 border-red-300",
  mixed: "bg-amber-50 text-amber-800 border-amber-300",
  none: "bg-surface-2 text-text-muted border-border",
};

function disciplineLabel(d: DisciplineField | ContactField): string {
  const v = "value" in d ? d.value : "";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[10px] uppercase tracking-widest font-semibold text-text-secondary mb-2 px-1">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function GroundedBriefView({ brief }: { brief: GroundedBrief }) {
  const h = brief.header;
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-border bg-surface shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-navy tracking-tight">
              {fieldValue(h.company)}
            </h2>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <FieldText f={h.vertical} />
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                  MOTION_BADGE[h.motion]
                )}
                title={h.motionField.provenance === "inferred" ? h.motionField.basis : ""}
              >
                {h.motion}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {brief.disciplines.map((d, i) => (
                <span
                  key={i}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border",
                    d.provenance === "detected"
                      ? "border-navy/20 bg-navy/5 text-navy"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  )}
                  title={d.provenance === "inferred" ? d.basis : "directly detected"}
                >
                  {disciplineLabel(d)}
                  <span className="text-[8px] opacity-70">
                    {d.provenance === "detected" ? "fact" : "implied"}
                  </span>
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="text-[9px] uppercase tracking-widest text-text-muted">Fit score</span>
            <span
              className="text-4xl font-bold tabular-nums text-primary leading-none"
              title={`${h.fitScore.basis.fn}  ${JSON.stringify(h.fitScore.basis.inputs)}  (cites ${h.fitScore.sourceRef.length} signals)`}
            >
              {h.fitScore.value}
              <span className="text-base text-text-muted font-normal">/100</span>
            </span>
            <span className="mt-1"><ProvBadge f={h.fitScore} /></span>
          </div>
        </div>
      </div>

      <Section title={`Why ${brief.reseller.name}`}>
        <p className="text-sm text-text-primary px-1">
          {brief.reseller.short} provides {brief.reseller.supportLine}.
        </p>
      </Section>

      <Section title="Executive Summary">
        <p className="px-1"><FieldText f={brief.executiveSummary} /></p>
      </Section>

      {brief.painPoints.length > 0 && (
        <Section title="Likely Pain Points">
          <ul className="space-y-2 px-1">
            {brief.painPoints.map((p, i) => (
              <li key={i} className="text-sm">
                <FieldText f={p.text} />
                <div className="mt-0.5 text-xs"><FieldText f={p.proof} /></div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {brief.talkingPoints.length > 0 && (
        <Section title="Suggested Talking Points">
          <ul className="space-y-2 px-1">
            {brief.talkingPoints.map((p, i) => (
              <li key={i} className="text-sm">
                <FieldText f={p.text} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {brief.displacement.length > 0 && (
        <Section title="Competitive Displacement">
          <div className="space-y-2 px-1">
            {brief.displacement.map((d, i) => (
              <div key={i} className="rounded-md border border-border bg-surface px-3 py-2">
                <p className="text-sm font-medium text-text-primary">
                  {fieldValue(d.competitor)} <span className="text-text-muted">to</span> {d.replacement}{" "}
                  <ProvBadge f={d.competitor} />
                </p>
                <p className="mt-0.5 text-xs"><FieldText f={d.positioning} /></p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title={brief.keyContacts[0]?.named ? "Key Contacts (ZoomInfo)" : "Target Contacts (role templates)"}>
        <div className="grid md:grid-cols-2 gap-3 px-1">
          {brief.keyContacts.map((c, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-3">
              <p className="text-sm font-semibold text-text-primary">{fieldValue(c.role)}</p>
              <p className="mt-1 text-xs"><FieldText f={c.valueProp} /></p>
              <p className="mt-1 text-[10px]"><FieldText f={c.tier} /></p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Related Signals">
        <ul className="space-y-2 px-1">
          {brief.relatedSignals.map((r, i) => (
            <li key={i} className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
              <a
                href={r.headline.sourceRef[0]?.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-text-primary hover:text-primary flex-1"
              >
                {fieldValue(r.headline)}
              </a>
              <span className="text-[10px] tabular-nums text-text-muted flex-shrink-0">
                {fieldValue(r.relevance)} <ProvBadge f={r.relevance} />
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
