"use client";

import * as React from "react";
import {
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  Sparkles,
  FileText,
  AlertTriangle,
  HelpCircle,
  Swords,
  Users,
  Activity,
  Mail,
} from "lucide-react";
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

// One consistent, dark-aware provenance badge across the brief (DETECTED /
// COMPUTED / INFERRED / PENDING). The badge alone carries provenance, so prose
// reads clean with no "hypothesis:" prefix.

type BadgeTone = "detected" | "computed" | "inferred" | "pending" | "fact" | "implied";

const BADGE_TONE: Record<BadgeTone, string> = {
  detected:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  fact:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  computed:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300",
  inferred:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  implied:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  pending:
    "border-dashed border-amber-300 bg-amber-50/60 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300/90",
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

// Inline prose plus its provenance badge. No text prefix: the badge marks it.
export function FieldText({ f, className }: { f: AnyField; className?: string }) {
  const gap = f.provenance === "curated" && isCuratedGap(f);
  return (
    <span className={cn(gap && "italic text-text-muted", className)}>
      <span>{fieldValue(f)} </span>
      <ProvBadge f={f} />
    </span>
  );
}

// A curated battlecard slot with no real library yet: one subtle dashed chip.
function PendingOrCurated({ f, label }: { f: CuratedField; label?: string }) {
  if (f.provenance === "curated" && isCuratedGap(f)) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] border border-dashed border-amber-300 bg-amber-50/50 text-[10px] italic text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300/90">
        {label ? `${label}: ` : ""}
        {f.pending}
      </span>
    );
  }
  return <FieldText f={f} className="text-xs" />;
}

const MOTION_BADGE: Record<Motion, string> = {
  upsell:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
  displacement:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300",
  mixed:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
  none: "border-border bg-surface-2 text-text-muted",
};

const SEVERITY_STYLE: Record<SeverityBand, string> = {
  high: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  medium:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  low: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-300",
};

const SEVERITY_BORDER: Record<SeverityBand, string> = {
  high: "border-l-red-400 dark:border-l-red-500",
  medium: "border-l-amber-400 dark:border-l-amber-500",
  low: "border-l-slate-300 dark:border-l-slate-600",
};

// Color-coded severity chip. The number is COMPUTED and recomputable; the chip
// shows the band over it with the basis math on hover.
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
        fact
          ? "border-primary/25 bg-primary/10 text-primary"
          : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
      )}
    >
      {disciplineLabel(d)}
      <span className="text-[8px] font-medium opacity-70">{fact ? "fact" : "implied"}</span>
    </span>
  );
}

// --- Section numbering (shared so the dossier's trailing sections continue the
// count without gaps). Both this view and the dossier derive numbers from the
// same present-section list. ---

const SECTION_ORDER = [
  "why",
  "exec",
  "pain",
  "talking",
  "displacement",
  "contacts",
  "related",
  "outreach",
] as const;
export type SectionKey = (typeof SECTION_ORDER)[number];

function presentSections(brief: GroundedBrief): SectionKey[] {
  return SECTION_ORDER.filter((k) => {
    if (k === "pain") return brief.painPoints.length > 0;
    if (k === "talking") return brief.talkingPoints.length > 0;
    if (k === "displacement") return brief.displacement.length > 0;
    return true;
  });
}

export function sectionNumber(brief: GroundedBrief, key: SectionKey): number {
  return presentSections(brief).indexOf(key) + 1;
}

type Accent = "primary" | "amber";
const ACCENT_TEXT: Record<Accent, string> = {
  primary: "text-primary",
  amber: "text-amber-500 dark:text-amber-400",
};

export function Section({
  num,
  icon: Icon,
  title,
  accent = "primary",
  action,
  children,
}: {
  num?: number;
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  accent?: Accent;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2.5">
        {num != null && (
          <span className="font-mono text-[11px] tabular-nums text-text-muted">
            {String(num).padStart(2, "0")}.
          </span>
        )}
        {Icon && <Icon className={cn("h-4 w-4 flex-shrink-0", ACCENT_TEXT[accent])} />}
        <h3 className={cn("text-xs font-bold uppercase tracking-[0.14em]", ACCENT_TEXT[accent])}>
          {title}
        </h3>
        {action && <span className="ml-auto">{action}</span>}
      </div>
      <div className="mt-2.5 mb-3.5 h-px bg-border" />
      {children}
    </section>
  );
}

// Copy-to-clipboard for grounded outreach. The text is already validated prose.
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

// The grounded cold-email draft with its Copy control. Exported so the dossier
// can place it in the section order.
export function OutreachCard({ outreach }: { outreach: GroundedBrief["outreach"] }) {
  if (!("subject" in outreach)) {
    return <PendingOrCurated f={outreach} />;
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
  hideContacts?: boolean;
  hideRelatedSignals?: boolean;
  hideOutreach?: boolean;
}) {
  const h = brief.header;
  const routeCount = h.fitScore.basis.inputs.routeCount ?? 1;
  const fitScope = routeCount <= 1 ? "single-route fit" : `${routeCount}-route fit`;
  const num = (k: SectionKey) => sectionNumber(brief, k);

  return (
    <div className="space-y-7">
      {/* Header card */}
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

      <Section num={num("why")} icon={Sparkles} title={`Why ${brief.reseller.name}`}>
        <p className="text-sm leading-relaxed text-text-primary">
          <FieldText f={brief.whyReseller} />
        </p>
      </Section>

      <Section num={num("exec")} icon={FileText} title="Executive Summary">
        <p className="text-sm leading-relaxed text-text-primary">
          <FieldText f={brief.executiveSummary} />
        </p>
      </Section>

      {brief.painPoints.length > 0 && (
        <Section num={num("pain")} icon={AlertTriangle} title="Likely Pain Points" accent="amber">
          <ul className="space-y-2.5">
            {brief.painPoints.map((p, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-lg border border-border bg-surface p-3.5 border-l-[3px]",
                  SEVERITY_BORDER[severityBand(p.severity.value)]
                )}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <SeverityChip f={p.severity} />
                  {p.discipline && <DisciplineTag d={p.discipline} />}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-text-primary">
                  <FieldText f={p.text} />
                </p>
                <div className="mt-2">
                  <PendingOrCurated f={p.solution} label="reseller solution" />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {brief.talkingPoints.length > 0 && (
        <Section num={num("talking")} icon={HelpCircle} title="Suggested Talking Points">
          <ul className="space-y-2.5">
            {brief.talkingPoints.map((p, i) => (
              <li key={i} className="rounded-lg border border-border bg-surface p-3.5">
                <p className="flex items-start gap-2 text-sm font-semibold text-text-primary">
                  <span className="mt-px font-mono text-primary" aria-hidden>
                    Q{i + 1}
                  </span>
                  <span>
                    <FieldText f={p.question} />
                  </span>
                </p>
                {fieldValue(p.answer) && (
                  <p className="mt-2 pl-6 text-sm leading-relaxed text-text-secondary">
                    <FieldText f={p.answer} />
                  </p>
                )}
                <div className="mt-2 pl-6">
                  <PendingOrCurated f={p.proof} label="proof" />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {brief.displacement.length > 0 && (
        <Section num={num("displacement")} icon={Swords} title="Competitive Displacement">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {brief.displacement.map((d, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-3.5">
                <p className="flex items-center gap-1.5 text-sm font-semibold flex-wrap">
                  <span className="text-text-primary">{fieldValue(d.competitor)}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
                  <span className="text-primary">{d.replacement}</span>
                  <ProvBadge f={d.competitor} />
                </p>
                <p className="mt-2">
                  <PendingOrCurated f={d.positioning} />
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {!hideContacts && (
        <Section
          num={num("contacts")}
          icon={Users}
          title={brief.keyContacts[0]?.named ? "Key Contacts" : "Target Contacts"}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {brief.keyContacts.map((c, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-3.5">
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

      {!hideRelatedSignals && (
        <Section num={num("related")} icon={Activity} title="Related Signals">
          <ul className="space-y-2">
            {brief.relatedSignals.map((r, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface px-3.5 py-2.5"
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

      {!hideOutreach && (
        <Section num={num("outreach")} icon={Mail} title="Outreach Draft">
          <OutreachCard outreach={brief.outreach} />
        </Section>
      )}
    </div>
  );
}
