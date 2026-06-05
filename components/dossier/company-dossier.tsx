"use client";

import * as React from "react";
import {
  Sparkles,
  Linkedin,
  Loader2,
  ExternalLink,
  Briefcase,
  Landmark,
  Newspaper,
  BookMarked,
  Mail,
  Phone,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCompanyContext } from "@/components/providers/company-context";
import { cn, signalTypeColor } from "@/lib/utils";
import { linkedinSearchUrl } from "@/lib/linkedin-targets";
import {
  buildStarvedPrompt,
  parseRawProse,
  groundProse,
} from "@/lib/brief/generate";
import {
  assembleBrief,
  templateKeyContacts,
  type BriefProse,
  type KeyContact,
} from "@/lib/brief/assemble";
import {
  GroundedBriefView,
  OutreachCard,
  Section,
  sectionNumber,
  FieldText,
  fieldValue,
} from "./grounded-brief-view";
import type { CompanyGroup } from "@/lib/signal-grouping";
import type { Signal } from "@/types/signal";
import type { Contact } from "@/types/contact";

interface CompanyDossierProps {
  group: CompanyGroup;
}

// Session-scoped cache so re-expanding the same row reuses the grounded prose
// instead of re-hitting the model. Keyed by company + state + signal
// fingerprint so adding new signals invalidates.
const proseCache = new Map<string, BriefProse>();

function cacheKey(group: CompanyGroup): string {
  const ids = group.signals
    .map((s) => s.id)
    .sort()
    .join(",");
  return `${group.company}|${group.state}|${ids}`;
}

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "Job Posting": Briefcase,
  News: Newspaper,
  "Gov Contract": Landmark,
  "Tech Adoption": BookMarked,
};

// Adzuna and some ATS feeds prefix descriptions with label-soup
// ("Job Title: X  Job Category: Y  Time Type: ...") before the real prose. Strip
// a leading run of known Label: value segments and return the actual sentence;
// fall back to the original if stripping would leave nothing.
const SIGNAL_LABELS =
  "Job Title|Job Category|Job Type|Time Type|Posted Date|Posted|Location|Department|Requisition ID|Requisition|Req ID|Employment Type|Schedule|Category|Brand|Division|Worker Type|Pay Range|Salary";
// A leading "Label: value" segment, but only when ANOTHER label follows, so the
// trailing real prose (which has no label after it) is never consumed.
const SIGNAL_LABEL_FOLLOWED = new RegExp(
  `^\\s*(?:${SIGNAL_LABELS})\\s*:\\s*.*?(?=(?:${SIGNAL_LABELS})\\s*:)`,
  "i"
);
// A final lone "Label:" key (its value runs into the real prose with no delimiter,
// so only the key is dropped).
const SIGNAL_LABEL_KEY = new RegExp(`^\\s*(?:${SIGNAL_LABELS})\\s*:\\s*`, "i");

function cleanSignalText(desc: string): string {
  const original = (desc ?? "").trim();
  // Strip a leading "Job Description" section header (ATS feeds often double it,
  // with or without a colon) before the Label: value pass.
  let t = original.replace(/^(?:job\s+description\s*:?\s*)+/i, "");
  // Drop leading "Label: value" segments that are followed by another label.
  for (let i = 0; i < 12; i++) {
    const m = t.match(SIGNAL_LABEL_FOLLOWED);
    if (!m || !m[0]) break;
    t = t.slice(m[0].length).trimStart();
  }
  // Drop a final lone leading label key, if any.
  t = t.replace(SIGNAL_LABEL_KEY, "").trimStart();
  return t.trim() || original;
}

export function CompanyDossier({ group }: CompanyDossierProps) {
  const router = useRouter();
  const { setActive } = useCompanyContext();

  const [tab, setTab] = React.useState<"intel" | "timeline">("intel");
  const [prose, setProse] = React.useState<BriefProse | null>(null);
  const [briefStreaming, setBriefStreaming] = React.useState(false);
  const [briefError, setBriefError] = React.useState<string | null>(null);
  // Stable per mount: report metadata only, not a prospect claim.
  const [generatedAt] = React.useState(() => new Date().toISOString());

  // Tagged industry role templates for the no-ZoomInfo contact fallback (and the
  // "find more on LinkedIn" supplement). Same provenance tags as the brief, so
  // the fallback is never a bare untagged assertion.
  const contactTemplates = React.useMemo<KeyContact[]>(
    () => templateKeyContacts(group.industry),
    [group.industry]
  );

  // Real decision-maker contacts attached by ZoomInfo (deduped by name across
  // all of the company's signals). When present, these replace the generic
  // LinkedIn role searches with named people, emails, and direct phones.
  const realContacts = React.useMemo<Contact[]>(() => {
    const seen = new Set<string>();
    const out: Contact[] = [];
    for (const s of group.signals) {
      for (const c of s.contacts ?? []) {
        const key = c.name?.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(c);
      }
    }
    return out;
  }, [group.signals]);

  const generateBrief = React.useCallback(async () => {
    const key = cacheKey(group);
    const cached = proseCache.get(key);
    if (cached) {
      setProse(cached);
      setBriefError(null);
      setBriefStreaming(false);
      return;
    }
    setBriefError(null);
    setBriefStreaming(true);
    setProse(null);
    try {
      // Starved prompt: only sourced facts reach the model (the digest withholds
      // draft-competitor specifics); the system prompt is summary-only.
      const { system, user } = buildStarvedPrompt(group);
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: "Ask Anything",
          tone: "Direct",
          methodology: "MEDDPICC",
          systemPromptOverride: system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Request failed ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
      }
      const raw = parseRawProse(buf);
      if (!raw) {
        throw new Error("Could not parse model response. Try regenerating.");
      }
      // Post-parse validation: strips any unsourced number and flags fabricated
      // stat / named-customer shapes before the prose reaches the brief.
      const { prose: grounded } = groundProse(raw, group);
      proseCache.set(key, grounded);
      setProse(grounded);
    } catch (e: any) {
      const msg = e?.message ?? "Brief generation failed";
      setBriefError(
        msg.includes("ANTHROPIC_API_KEY")
          ? "Set ANTHROPIC_API_KEY in your .env.local to enable AI sections."
          : msg
      );
    } finally {
      setBriefStreaming(false);
    }
  }, [group]);

  React.useEffect(() => {
    void generateBrief();
  }, [generateBrief]);

  // The grounded brief. The deterministic floor (header, single computed fit,
  // displacement, signals) renders immediately; LLM prose fills the narrative
  // slots when it arrives and shows as visible pending gaps until then.
  // routeCount is 1: the dossier is a single-route pull, so its fit is labeled
  // single-route and never reads as the company's definitive cross-route score.
  const brief = React.useMemo(
    () =>
      assembleBrief({
        group,
        routeCount: 1,
        generatedAt,
        prose: prose ?? undefined,
      }),
    [group, prose, generatedAt]
  );

  const sendToAssist = () => {
    setActive({
      company: group.company,
      city: group.city,
      state: group.state,
      detectedSoftware: group.detectedSoftware,
    });
    router.push("/sales-assist");
  };

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border">
        <TabButton active={tab === "intel"} onClick={() => setTab("intel")}>
          Intel
        </TabButton>
        <TabButton active={tab === "timeline"} onClick={() => setTab("timeline")}>
          Timeline
        </TabButton>
      </div>

      {tab === "timeline" ? (
        <TimelineTab signals={group.signals} />
      ) : briefStreaming && !prose && !briefError ? (
        /* While the model parses, keep it minimal: a clean progress card rather
           than a half-rendered brief full of pending chips. */
        <GeneratingCard signalCount={group.signals.length} />
      ) : (
        <>
          {briefError && <p className="text-xs text-amber-700 px-1">{briefError}</p>}

          {/* The brief and the dossier-owned tail sections share one rhythm. */}
          <div className="space-y-7">
          {/* Grounded brief. Related Signals renders at section 3 (right after
              the executive summary) via a slot so it can use the dossier's richer
              signal data with descriptions. Key Contacts and the Outreach Sequence
              are rendered by the dossier below, in order. */}
          <GroundedBriefView
            brief={brief}
            hideContacts
            hideOutreach
            relatedSignalsSlot={<RelatedSignalsList signals={group.signals} />}
          />

          {/* 7. KEY CONTACTS: real ZoomInfo people render as detected cards; the
              no-ZoomInfo fallback renders tagged role templates, never a bare
              assertion. */}
          <Section
            num={sectionNumber(brief, "contacts")}
            icon={Users}
            title={realContacts.length > 0 ? "Key Contacts" : "Target Contacts"}
            action={
              realContacts.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-semibold text-primary">
                  <Sparkles className="h-3 w-3" />
                  {realContacts.length} via ZoomInfo
                </span>
              ) : undefined
            }
          >
            {realContacts.length > 0 ? (
              <div className="space-y-5">
                <div className="grid md:grid-cols-2 gap-3">
                  {realContacts.map((c, i) => (
                    <ContactCard key={`${c.name}-${i}`} contact={c} />
                  ))}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-text-muted mb-2 px-1">
                    Find more on LinkedIn
                  </p>
                  <TemplateContactGrid contacts={contactTemplates} company={group.company} />
                </div>
              </div>
            ) : (
              <TemplateContactGrid contacts={contactTemplates} company={group.company} />
            )}
          </Section>

          {/* OUTREACH SEQUENCE + per-touch Copy (grounded, validated) */}
          <Section num={sectionNumber(brief, "outreach")} icon={Mail} title="Outreach Sequence">
            <OutreachCard outreach={brief.outreach} />
          </Section>
          </div>

          {/* Action: Sales Assist only. Add to Territory and Mark Pursuing
              removed (toast-only stubs, HRS's to build). The Sales Assist entry
              point is preserved verbatim. */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button onClick={sendToAssist} className="sm:flex-1">
              <Sparkles className="h-4 w-4" />
              Open in Sales Assist
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// Minimal progress card shown while the model parses. The steps are a readable
// trace of what the layer does (deterministic floor first, then the LLM pass),
// staggered in so it reads as activity, not a frozen spinner.
function GeneratingCard({ signalCount }: { signalCount: number }) {
  const steps = [
    `Reading ${signalCount} live signal${signalCount === 1 ? "" : "s"}`,
    "Classifying disciplines and motion",
    "Computing fit and severity",
    "Synthesizing grounded brief",
  ];
  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-2 text-primary">
        <Loader2 className="h-4 w-4 animate-spin" />
        <h3 className="text-xs font-bold uppercase tracking-[0.14em]">Generating brief</h3>
      </div>
      <ul className="mt-4 space-y-2.5">
        {steps.map((s, i) => (
          <li
            key={i}
            className="flex items-center gap-2.5 text-text-secondary animate-fade-in"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary/60 flex-shrink-0" />
            <span className="font-mono text-xs">{s}...</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
        active
          ? "border-primary text-primary"
          : "border-transparent text-text-secondary hover:text-text-primary"
      )}
    >
      {children}
    </button>
  );
}

// A real, named decision-maker returned by ZoomInfo, with whatever contact
// channels came back (email, direct phone, LinkedIn).
function ContactCard({ contact }: { contact: Contact }) {
  const hasChannel = contact.email || contact.phone || contact.linkedinUrl;
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {contact.name}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">{contact.title}</p>
        </div>
        {contact.linkedinUrl && (
          <a
            href={contact.linkedinUrl}
            target="_blank"
            rel="noreferrer"
            className="text-text-muted hover:text-primary flex-shrink-0"
            aria-label={`${contact.name} on LinkedIn`}
          >
            <Linkedin className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <div className="mt-2.5 space-y-1.5">
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary"
          >
            <Mail className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{contact.email}</span>
          </a>
        )}
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary"
          >
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span>{contact.phone}</span>
          </a>
        )}
        {!hasChannel && (
          <p className="text-[11px] text-text-muted italic">
            No direct contact channel returned
          </p>
        )}
      </div>
    </div>
  );
}

// Industry role templates (the no-ZoomInfo fallback and the "find more on
// LinkedIn" supplement) rendered WITH their provenance tags: role/value-prop are
// curated templates, tier is an inferred ordering. This is the contacts
// amendment: the template fallback must never read as a bare factual assertion.
// The per-role LinkedIn search link is preserved verbatim. valueProp and tier
// are curated/inferred (never detected/computed), so their badges carry no inner
// anchor and nesting inside this card's link stays valid.
function TemplateContactGrid({
  contacts,
  company,
}: {
  contacts: KeyContact[];
  company: string;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {contacts.map((c, i) => {
        const role = fieldValue(c.role);
        return (
          <a
            key={`${role}-${i}`}
            href={linkedinSearchUrl(role, company)}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border bg-surface p-4 hover:border-primary/50 hover:bg-primary-subtle transition-colors block group"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-sm font-semibold text-text-primary group-hover:text-primary">
                {role}
              </h3>
              <Linkedin className="h-3.5 w-3.5 text-text-muted group-hover:text-primary flex-shrink-0" />
            </div>
            <p className="text-xs text-text-muted mb-1">{fieldValue(c.dept)}</p>
            <p className="text-xs"><FieldText f={c.valueProp} /></p>
            <p className="mt-1 text-[10px]"><FieldText f={c.tier} /></p>
            <p className="text-[11px] text-primary mt-2 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Find on LinkedIn
              <ExternalLink className="h-2.5 w-2.5" />
            </p>
          </a>
        );
      })}
    </div>
  );
}

// The dossier's richer Related Signals list (cleaned description sentence, source,
// date, relevance score). Rendered into the brief at section 3 via
// GroundedBriefView's relatedSignalsSlot.
function RelatedSignalsList({ signals }: { signals: Signal[] }) {
  return (
    <ul className="space-y-2">
      {signals.map((s) => {
        const Icon = TYPE_ICON[s.signalType] ?? Briefcase;
        const desc = cleanSignalText(s.description);
        return (
          <li
            key={s.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
          >
            <Icon className="h-3.5 w-3.5 text-text-muted mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <a
                href={s.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-text-primary hover:text-primary inline-flex items-start gap-1"
              >
                <span className="flex-1">{s.title}</span>
                <ExternalLink className="h-2.5 w-2.5 text-text-muted mt-1.5 flex-shrink-0" />
              </a>
              {desc && (
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed line-clamp-2">
                  {desc}
                </p>
              )}
              <p className="text-[10px] text-text-muted mt-1">
                {s.sourceLabel} · {s.postedAgo}
              </p>
            </div>
            <div className="flex flex-col items-end flex-shrink-0">
              <span className="text-sm font-bold tabular-nums text-text-primary leading-none">
                {s.signalStrength}
              </span>
              <span className="text-[8px] uppercase tracking-wider text-text-muted">relevance</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TimelineTab({ signals }: { signals: Signal[] }) {
  const sorted = [...signals].sort((a, b) => {
    return b.postedAgo.localeCompare(a.postedAgo);
  });

  return (
    <div className="space-y-3">
      {sorted.map((s) => {
        const Icon = TYPE_ICON[s.signalType] ?? Briefcase;
        return (
          <a
            key={s.id}
            href={s.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="block rounded-md border border-border bg-surface px-4 py-3 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              <Icon className="h-4 w-4 text-text-muted mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider border",
                      signalTypeColor(s.signalType)
                    )}
                  >
                    {s.signalType.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {s.postedAgo}
                  </span>
                </div>
                <p className="text-sm font-medium text-text-primary mt-1">
                  {s.title}
                </p>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed line-clamp-2">
                  {s.description}
                </p>
                <p className="text-[10px] text-text-muted mt-1">
                  {s.sourceLabel}
                </p>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
