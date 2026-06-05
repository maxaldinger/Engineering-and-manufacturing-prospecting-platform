"use client";

import * as React from "react";
import { ExternalLink, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { isCuratedGap, type AnyField, type ComputedField } from "@/lib/brief/provenance";
import type {
  GroundedBrief,
  DisciplineField,
  ContactField,
} from "@/lib/brief/assemble";
import { severityBand, type SeverityBand } from "@/lib/brief/severity";
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

export function ProvBadge({ f }: { f: AnyField }) {
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

export function fieldValue(f: AnyField): string {
  if (f.provenance === "curated" && isCuratedGap(f)) return f.pending;
  const v = "value" in f ? f.value : "";
  return Array.isArray(v) ? v.join("; ") : String(v);
}

export function FieldText({ f, className }: { f: AnyField; className?: string }) {
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

const SEVERITY_STYLE: Record<SeverityBand, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
};

// Color-coded severity chip. The number is COMPUTED and recomputable; the chip
// shows the band over it with the basis math on hover, so the figure stays
// honest (never an LLM guess).
function SeverityChip({ f }: { f: ComputedField }) {
  const band = severityBand(f.value);
  return (
    <span
      title={`severity ${f.value}/100 · ${f.basis.fn} ${JSON.stringify(f.basis.inputs)} (cites ${f.sourceRef.length} signals)`}
      className={cn(
        "inline-flex flex-shrink-0 items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border",
        SEVERITY_STYLE[band]
      )}
    >
      {band}
      <span className="text-[8px] font-medium opacity-70">computed</span>
    </span>
  );
}

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

// Copy-to-clipboard for the grounded outreach draft. The text is already
// validated prose (no unsourced numbers), so what lands on the clipboard is the
// same grounded copy the rep sees.
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex flex-shrink-0 items-center gap-1 px-2 py-1 rounded border border-border bg-surface-2 text-[11px] font-medium text-text-secondary hover:text-primary hover:border-primary/40"
      aria-label="Copy outreach draft"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function GroundedBriefView({
  brief,
  hideContacts = false,
  hideRelatedSignals = false,
}: {
  brief: GroundedBrief;
  // The dossier owns the richer Contacts (ZoomInfo cards) and Signals sections,
  // so it suppresses the brief's slimmer versions to avoid double-rendering.
  hideContacts?: boolean;
  hideRelatedSignals?: boolean;
}) {
  const h = brief.header;
  // Fit is route-scoped: a single-route pull (the dossier) and the cross-route
  // portfolio union score the same company differently, so the score is labeled
  // with its route basis and never reads as one definitive number.
  const routeCount = h.fitScore.basis.inputs.routeCount ?? 1;
  const fitScope = routeCount <= 1 ? "single-route fit" : `${routeCount}-route fit`;
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
            <span className="mt-0.5 text-[9px] uppercase tracking-wider text-text-muted">
              {fitScope}
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
                <div className="flex items-start gap-2">
                  <SeverityChip f={p.severity} />
                  <FieldText f={p.text} />
                </div>
                <div className="mt-0.5 text-xs"><FieldText f={p.solution} /></div>
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

      <Section title="Outreach Draft">
        {"subject" in brief.outreach ? (
          <div className="px-1">
            <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-text-primary">
                  {fieldValue(brief.outreach.subject)}
                </p>
                <CopyButton
                  text={`Subject: ${fieldValue(brief.outreach.subject)}\n\n${fieldValue(brief.outreach.body)}`}
                />
              </div>
              <p className="text-sm text-text-primary whitespace-pre-wrap">
                {fieldValue(brief.outreach.body)}
              </p>
              <div className="flex items-center gap-2">
                <ProvBadge f={brief.outreach.subject} />
                <span className="text-[10px] text-text-muted">
                  grounded draft, review before sending
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="px-1">
            <FieldText f={brief.outreach} />
          </p>
        )}
      </Section>

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

      {!hideContacts && (
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
      )}

      {!hideRelatedSignals && (
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
      )}
    </div>
  );
}
