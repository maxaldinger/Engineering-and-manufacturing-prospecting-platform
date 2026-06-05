"use client";

import * as React from "react";
import { ExternalLink, Copy, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isCuratedGap,
  type AnyField,
  type ComputedField,
  type CuratedField,
} from "@/lib/brief/provenance";
import type {
  GroundedBrief,
  DisciplineField,
  ContactField,
  OutreachDraft,
} from "@/lib/brief/assemble";
import { severityBand, type SeverityBand } from "@/lib/brief/severity";
import type { Motion } from "@/lib/brief/motion";

// Provenance is shown inline, never hidden, but quietly: one consistent badge
// style across the brief (DETECTED / COMPUTED / INFERRED / PENDING), color-coded
// and subtle. The badge alone carries provenance, so prose reads clean with no
// "hypothesis:" prefix.

type BadgeTone = "detected" | "computed" | "inferred" | "pending" | "fact" | "implied";

const BADGE_TONE: Record<BadgeTone, string> = {
  detected: "border-emerald-200 bg-emerald-50 text-emerald-700",
  fact: "border-emerald-200 bg-emerald-50 text-emerald-700",
  computed: "border-blue-200 bg-blue-50 text-blue-700",
  inferred: "border-amber-200 bg-amber-50 text-amber-700",
  implied: "border-amber-200 bg-amber-50 text-amber-700",
  pending: "border-amber-300 border-dashed bg-amber-50/60 text-amber-700",
};

function Badge({
  tone,
  title,
  href,
  children,
}: {
  tone: BadgeTone;
  title?: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-[4px] border text-[9px] font-semibold uppercase tracking-[0.08em] align-middle",
        BADGE_TONE[tone]
      )}
    >
      {children}
      {href && (
        <a href={href} target="_blank" rel="noreferrer" aria-label="source">
          <ExternalLink className="h-2 w-2" />
        </a>
      )}
    </span>
  );
}

export function ProvBadge({ f }: { f: AnyField }) {
  const gap = f.provenance === "curated" && isCuratedGap(f);
  const tone: BadgeTone = gap ? "pending" : (f.provenance as BadgeTone);
  const title =
    f.provenance === "computed"
      ? `${f.basis.fn}  ${JSON.stringify(f.basis.inputs)}  (cites ${f.sourceRef.length} signals)`
      : f.provenance === "inferred"
      ? f.basis
      : f.provenance === "curated"
      ? gap
        ? f.pending
        : f.basis
      : `${f.sourceRef.length} signal(s)`;
  const href =
    f.provenance === "detected" || f.provenance === "computed"
      ? f.sourceRef[0]?.url
      : undefined;
  return (
    <Badge tone={tone} title={title} href={href}>
      {gap ? "pending" : f.provenance}
    </Badge>
  );
}

export function fieldValue(f: AnyField): string {
  if (f.provenance === "curated" && isCuratedGap(f)) return f.pending;
  const v = "value" in f ? f.value : "";
  return Array.isArray(v) ? v.join("; ") : String(v);
}

// Inline prose plus its provenance badge. No text prefix: the badge alone marks
// it inferred. A curated gap reads as a muted italic line with the PENDING badge.
export function FieldText({ f, className }: { f: AnyField; className?: string }) {
  const gap = f.provenance === "curated" && isCuratedGap(f);
  return (
    <span className={cn(gap && "italic text-text-muted", className)}>
      <span>{fieldValue(f)} </span>
      <ProvBadge f={f} />
    </span>
  );
}

// A curated battlecard slot that has no real library yet: one subtle dashed chip,
// never a bold repeated line. A real curated value renders as normal prose.
function PendingOrCurated({ f, label }: { f: CuratedField; label?: string }) {
  if (f.provenance === "curated" && isCuratedGap(f)) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] border border-dashed border-amber-300 bg-amber-50/50 text-[10px] italic text-amber-700">
        {label ? `${label}: ` : ""}
        {f.pending}
      </span>
    );
  }
  return <FieldText f={f} className="text-xs" />;
}

const MOTION_BADGE: Record<Motion, string> = {
  upsell: "border-emerald-300 bg-emerald-50 text-emerald-700",
  displacement: "border-red-300 bg-red-50 text-red-700",
  mixed: "border-amber-300 bg-amber-50 text-amber-800",
  none: "border-border bg-surface-2 text-text-muted",
};

const SEVERITY_STYLE: Record<SeverityBand, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-slate-200 bg-slate-50 text-slate-600",
};

const SEVERITY_BORDER: Record<SeverityBand, string> = {
  high: "border-l-red-400",
  medium: "border-l-amber-400",
  low: "border-l-slate-300",
};

// Color-coded severity chip. The number is COMPUTED and recomputable; the chip
// shows the band over it with the basis math on hover, so the figure stays honest.
function SeverityChip({ f }: { f: ComputedField }) {
  const band = severityBand(f.value);
  return (
    <span
      title={`severity ${f.value}/100 · ${f.basis.fn} ${JSON.stringify(f.basis.inputs)} (cites ${f.sourceRef.length} signals)`}
      className={cn(
        "inline-flex flex-shrink-0 items-center gap-1 px-1.5 py-0.5 rounded-[4px] border text-[9px] font-bold uppercase tracking-[0.08em]",
        SEVERITY_STYLE[band]
      )}
    >
      {band}
      <span className="text-[8px] font-medium opacity-60">computed</span>
    </span>
  );
}

function disciplineLabel(d: DisciplineField | ContactField): string {
  const v = "value" in d ? d.value : "";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

// Discipline chip: fact when directly detected, implied when only a suite tool
// carries it, never blank.
function DisciplineTag({ d }: { d: DisciplineField }) {
  const fact = d.provenance === "detected";
  return (
    <span
      title={d.provenance === "inferred" ? d.basis : "directly detected"}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] border text-[10px] font-semibold uppercase tracking-wide",
        fact ? "border-navy/20 bg-navy/5 text-navy" : "border-amber-200 bg-amber-50 text-amber-800"
      )}
    >
      {disciplineLabel(d)}
      <span className="text-[8px] font-medium opacity-70">{fact ? "fact" : "implied"}</span>
    </span>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
        <h3 className="text-[10px] uppercase tracking-[0.16em] font-semibold text-text-secondary">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// Copy-to-clipboard for the grounded outreach draft. The text is already validated
// prose (no unsourced numbers), so the clipboard gets the same grounded copy.
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
      className="inline-flex flex-shrink-0 items-center gap-1 px-2 py-1 rounded-md border border-border bg-surface-2 text-[11px] font-medium text-text-secondary hover:text-primary hover:border-primary/40 transition-colors"
      aria-label="Copy outreach draft"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// The grounded cold-email draft with its Copy control. Exported so the dossier can
// place it last, after its own Contacts and Related Signals sections.
export function OutreachCard({ outreach }: { outreach: GroundedBrief["outreach"] }) {
  if (!("subject" in outreach)) {
    return (
      <div className="px-1">
        <PendingOrCurated f={outreach} />
      </div>
    );
  }
  const draft = outreach as OutreachDraft;
  const copyText = `Subject: ${fieldValue(draft.subject)}\n\n${fieldValue(draft.body)}`;
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-text-primary">{fieldValue(draft.subject)}</p>
        <CopyButton text={copyText} />
      </div>
      <p className="mt-2 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
        {fieldValue(draft.body)}
      </p>
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-2.5">
        <ProvBadge f={draft.subject} />
        <span className="text-[10px] text-text-muted">grounded draft, review before sending</span>
      </div>
    </div>
  );
}

export function GroundedBriefView({
  brief,
  hideContacts = false,
  hideRelatedSignals = false,
  hideOutreach = false,
}: {
  brief: GroundedBrief;
  // The dossier owns the richer Contacts (ZoomInfo cards), Related Signals (with
  // descriptions), and the trailing Outreach so it can place them in order, so it
  // suppresses the brief's own versions to avoid double-rendering.
  hideContacts?: boolean;
  hideRelatedSignals?: boolean;
  hideOutreach?: boolean;
}) {
  const h = brief.header;
  // Fit is route-scoped: a single-route pull (the dossier) and the cross-route
  // portfolio union score the same company differently, so the score is labeled
  // with its route basis and never reads as one definitive number.
  const routeCount = h.fitScore.basis.inputs.routeCount ?? 1;
  const fitScope = routeCount <= 1 ? "single-route fit" : `${routeCount}-route fit`;

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="rounded-xl border border-border bg-surface shadow-sm p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-navy tracking-tight">{fieldValue(h.company)}</h2>
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-text-secondary">{fieldValue(h.vertical)}</span>
              <ProvBadge f={h.vertical} />
              <span
                title={h.motionField.provenance === "inferred" ? h.motionField.basis : ""}
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider border",
                  MOTION_BADGE[h.motion]
                )}
              >
                {h.motion}
              </span>
            </div>
            {brief.disciplines.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {brief.disciplines.map((d, i) => (
                  <DisciplineTag key={i} d={d} />
                ))}
              </div>
            )}
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
            <span className="mt-1 text-[9px] uppercase tracking-wider text-text-muted">{fitScope}</span>
            <span className="mt-1.5">
              <ProvBadge f={h.fitScore} />
            </span>
          </div>
        </div>
      </div>

      {/* 2. Why reseller */}
      <Section title={`Why ${brief.reseller.name}`}>
        <p className="px-1 text-sm leading-relaxed text-text-primary">
          <FieldText f={brief.whyReseller} />
        </p>
      </Section>

      {/* 3. Executive summary */}
      <Section title="Executive Summary">
        <p className="px-1 text-sm leading-relaxed text-text-primary">
          <FieldText f={brief.executiveSummary} />
        </p>
      </Section>

      {/* 4. Pain points, rows colored by computed severity */}
      {brief.painPoints.length > 0 && (
        <Section title="Likely Pain Points">
          <ul className="space-y-2 px-1">
            {brief.painPoints.map((p, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-lg border border-border bg-surface p-3 border-l-[3px]",
                  SEVERITY_BORDER[severityBand(p.severity.value)]
                )}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <SeverityChip f={p.severity} />
                  {p.discipline && <DisciplineTag d={p.discipline} />}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-text-primary">
                  <FieldText f={p.text} />
                </p>
                <div className="mt-1.5">
                  <PendingOrCurated f={p.solution} label="reseller solution" />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 5. Talking points, Q&A blocks */}
      {brief.talkingPoints.length > 0 && (
        <Section title="Suggested Talking Points">
          <ul className="space-y-2 px-1">
            {brief.talkingPoints.map((p, i) => (
              <li key={i} className="rounded-lg border border-border bg-surface p-3">
                <p className="flex items-start gap-2 text-sm font-semibold text-text-primary">
                  <span className="mt-px text-primary" aria-hidden>
                    Q
                  </span>
                  <span>
                    <FieldText f={p.question} />
                  </span>
                </p>
                {fieldValue(p.answer) && (
                  <p className="mt-1.5 pl-4 text-sm leading-relaxed text-text-secondary border-l-2 border-primary/20">
                    <FieldText f={p.answer} />
                  </p>
                )}
                <div className="mt-1.5">
                  <PendingOrCurated f={p.proof} label="proof" />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 6. Competitive displacement, per-competitor cards */}
      {brief.displacement.length > 0 && (
        <Section title="Competitive Displacement">
          <div className="grid gap-2 px-1 sm:grid-cols-2">
            {brief.displacement.map((d, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold flex-wrap">
                  <span className="text-text-primary">{fieldValue(d.competitor)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
                  <span className="text-primary">{d.replacement}</span>
                  <ProvBadge f={d.competitor} />
                </p>
                <p className="mt-1.5">
                  <PendingOrCurated f={d.positioning} />
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 7. Key contacts (brief's own; the dossier supplies a richer version) */}
      {!hideContacts && (
        <Section
          title={brief.keyContacts[0]?.named ? "Key Contacts" : "Target Contacts"}
        >
          <div className="grid gap-3 px-1 md:grid-cols-2">
            {brief.keyContacts.map((c, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-3">
                <p className="text-sm font-semibold text-text-primary">{fieldValue(c.role)}</p>
                <p className="mt-1 text-xs">
                  <FieldText f={c.valueProp} />
                </p>
                <p className="mt-1 text-[10px]">
                  <FieldText f={c.tier} />
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 8. Related signals (brief's own; the dossier supplies a richer version) */}
      {!hideRelatedSignals && (
        <Section title="Related Signals">
          <ul className="space-y-2 px-1">
            {brief.relatedSignals.map((r, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2"
              >
                <a
                  href={r.headline.sourceRef[0]?.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-text-primary hover:text-primary flex-1"
                >
                  {fieldValue(r.headline)}
                </a>
                <span className="flex-shrink-0 text-[10px] tabular-nums text-text-muted">
                  {fieldValue(r.relevance)} <ProvBadge f={r.relevance} />
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 9. Outreach draft */}
      {!hideOutreach && (
        <Section title="Outreach Draft">
          <div className="px-1">
            <OutreachCard outreach={brief.outreach} />
          </div>
        </Section>
      )}
    </div>
  );
}
