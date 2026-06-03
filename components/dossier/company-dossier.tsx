"use client";

import * as React from "react";
import {
  Sparkles,
  Linkedin,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  Plus,
  Target,
  ExternalLink,
  Briefcase,
  Landmark,
  Newspaper,
  BookMarked,
  Mail,
  Phone,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCompanyContext } from "@/components/providers/company-context";
import { useToast } from "@/components/ui/toast";
import { cn, signalTypeColor } from "@/lib/utils";
import {
  targetsForIndustry,
  linkedinSearchUrl,
  type TargetContact,
} from "@/lib/linkedin-targets";
import type { CompanyGroup, Urgency } from "@/lib/signal-grouping";
import type { Signal } from "@/types/signal";
import type { Contact } from "@/types/contact";

interface CompanyDossierProps {
  group: CompanyGroup;
}

interface AiBrief {
  score: number;
  scoreLabel: string;
  whyCamworks: string;
  overview: string;
  camworksFit: string;
  manufacturingChallenge: string;
  outreachSubject: string;
  outreachBody: string;
  talkingPoints: string[];
}

// Session-scoped cache so re-expanding the same row reuses the brief
// instead of re-hitting the model. Keyed by company + state + signal
// fingerprint so adding new signals invalidates.
const briefCache = new Map<string, AiBrief>();

function cacheKey(group: CompanyGroup): string {
  const ids = group.signals
    .map((s) => s.id)
    .sort()
    .join(",");
  return `${group.company}|${group.state}|${ids}`;
}

const SYSTEM_PROMPT = `You are a sales intelligence analyst at Hawk Ridge Systems (HRS), the largest SOLIDWORKS reseller in North America. HRS sells SOLIDWORKS, CAMWorks, SOLIDWORKS Simulation, SOLIDWORKS Electrical, SOLIDWORKS PDM Professional, 3DEXPERIENCE Works, DriveWorks, Markforged hardware, HP MJF, Artec scanners, plus implementation and training.

You will receive structured signal data scraped from public sources for one prospect company. Reply with ONLY a single JSON object. No prose, no markdown fences. Use this exact shape:

{
  "score": <integer 0-100. Higher = better fit. Base on number of signals, recency, and CAM detection.>,
  "scoreLabel": "PRIME TARGET" | "WARM TARGET" | "COLD TARGET",
  "whyCamworks": "<1-2 sentence pitch on why CAMWorks plus SOLIDWORKS is the right fit specifically for this prospect, anchored on their stack and pressures.>",
  "overview": "<2-3 sentence company summary describing their situation, why they are on the radar, and their manufacturing pressures based on the actual signals.>",
  "camworksFit": "<3-4 sentences on how CAMWorks, SOLIDWORKS, and 3DEXPERIENCE Works specifically solve their problem. Name the products and the capabilities.>",
  "manufacturingChallenge": "<3-4 sentences on the technical and business problem they are facing. Reference real signals (contract programs, hiring patterns, news mentions).>",
  "outreachSubject": "<short cold email subject line, 6-10 words>",
  "outreachBody": "<3-5 sentence cold email referencing one specific signal and one HRS capability. No greeting fluff. No em dashes.>",
  "talkingPoints": ["<bullet 1>", "<bullet 2>", "<bullet 3>", "<bullet 4>", "<bullet 5>"]
}

Hard rules:
- Reference only the signals in the input data. Do not invent contracts, dollar amounts, names, dates, or program names.
- If the signals are thin, write shorter sections rather than padding with invention.
- talkingPoints must be specific to this company, not generic platitudes. Each point should reference a signal.
- No em dashes anywhere. Use commas or restructure.
- scoreLabel: PRIME TARGET if score >= 75, WARM TARGET if 50-74, COLD TARGET below 50.`;

function buildSignalDigest(group: CompanyGroup): string {
  const lines: string[] = [];
  lines.push(`Prospect: ${group.company}`);
  lines.push(`Region: ${group.city || group.state}, ${group.state}`);
  lines.push(`Industry: ${group.industry}`);
  if (group.detectedSoftware.length) {
    lines.push(`Detected software in public text: ${group.detectedSoftware.join(", ")}`);
  } else {
    lines.push("No CAM/CAD software detected in public text.");
  }

  const groups: { label: string; type: Signal["signalType"] }[] = [
    { label: "Federal Contract Awards", type: "Gov Contract" },
    { label: "Open Job Postings", type: "Job Posting" },
    { label: "News Mentions", type: "News" },
    { label: "Tech Adoption", type: "Tech Adoption" },
  ];

  for (const g of groups) {
    const entries = group.signals.filter((s) => s.signalType === g.type);
    if (entries.length === 0) continue;
    lines.push(`\n${g.label} (${entries.length}):`);
    for (const s of entries.slice(0, 12)) {
      const sw = s.detectedSoftware
        .filter((x) => x.name && x.name !== "Unknown")
        .map((x) => x.name)
        .join(", ");
      lines.push(
        `- ${s.title} | ${s.postedAgo} | ${s.sourceLabel}${sw ? ` | software in text: ${sw}` : ""}\n  ${s.description.slice(0, 220)}`
      );
    }
  }
  return lines.join("\n");
}

function parseBrief(raw: string): AiBrief | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!parsed || typeof parsed !== "object") return null;
    return {
      score: Number(parsed.score) || 0,
      scoreLabel: String(parsed.scoreLabel ?? ""),
      whyCamworks: String(parsed.whyCamworks ?? ""),
      overview: String(parsed.overview ?? ""),
      camworksFit: String(parsed.camworksFit ?? ""),
      manufacturingChallenge: String(parsed.manufacturingChallenge ?? ""),
      outreachSubject: String(parsed.outreachSubject ?? ""),
      outreachBody: String(parsed.outreachBody ?? ""),
      talkingPoints: Array.isArray(parsed.talkingPoints)
        ? parsed.talkingPoints.map((s: unknown) => String(s))
        : [],
    };
  } catch {
    return null;
  }
}

const URGENCY_BADGE: Record<Urgency, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function urgencyForSignal(s: Signal): Urgency {
  if (s.signalStrength >= 80) return "high";
  if (s.signalStrength >= 55) return "medium";
  return "low";
}

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "Job Posting": Briefcase,
  News: Newspaper,
  "Gov Contract": Landmark,
  "Tech Adoption": BookMarked,
};

export function CompanyDossier({ group }: CompanyDossierProps) {
  const router = useRouter();
  const { setActive } = useCompanyContext();
  const { toast } = useToast();

  const [tab, setTab] = React.useState<"intel" | "timeline">("intel");
  const [brief, setBrief] = React.useState<AiBrief | null>(null);
  const [briefStreaming, setBriefStreaming] = React.useState(false);
  const [briefError, setBriefError] = React.useState<string | null>(null);
  const [outreachCopied, setOutreachCopied] = React.useState(false);

  const targets = targetsForIndustry(group.industry);

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
    const cached = briefCache.get(key);
    if (cached) {
      setBrief(cached);
      setBriefError(null);
      setBriefStreaming(false);
      return;
    }
    setBriefError(null);
    setBriefStreaming(true);
    setBrief(null);
    try {
      const digest = buildSignalDigest(group);
      const res = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: "Ask Anything",
          tone: "Direct",
          methodology: "MEDDPICC",
          systemPromptOverride: SYSTEM_PROMPT,
          messages: [{ role: "user", content: digest }],
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
      const parsed = parseBrief(buf);
      if (!parsed) {
        throw new Error("Could not parse model response. Try regenerating.");
      }
      briefCache.set(key, parsed);
      setBrief(parsed);
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

  const sendToAssist = () => {
    setActive({
      company: group.company,
      city: group.city,
      state: group.state,
      detectedSoftware: group.detectedSoftware,
    });
    router.push("/sales-assist");
  };

  const copyOutreach = async () => {
    if (!brief) return;
    const text = `Subject: ${brief.outreachSubject}\n\n${brief.outreachBody}`;
    try {
      await navigator.clipboard.writeText(text);
      setOutreachCopied(true);
      setTimeout(() => setOutreachCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const computedScore =
    brief?.score ??
    Math.round(
      group.signals.reduce((s, x) => s + x.signalStrength, 0) /
        Math.max(1, group.signals.length)
    );
  const computedLabel =
    brief?.scoreLabel ||
    (computedScore >= 75
      ? "PRIME TARGET"
      : computedScore >= 50
      ? "WARM TARGET"
      : "COLD TARGET");

  const govContracts = group.signals.filter((s) => s.signalType === "Gov Contract");
  const jobs = group.signals.filter((s) => s.signalType === "Job Posting");
  const news = group.signals.filter((s) => s.signalType === "News");
  const techAdoption = group.signals.filter((s) => s.signalType === "Tech Adoption");

  return (
    <div className="space-y-5">
      {/* 1. Why CAMWorks callout */}
      <div className="rounded-lg border-l-4 border-primary border-y border-r border-border bg-primary-subtle/30 px-4 py-3">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-primary mb-1">
          Why CAMWorks
        </p>
        {briefStreaming && !brief ? (
          <p className="text-sm text-text-muted inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Compiling intel from {group.signals.length} live signal{group.signals.length === 1 ? "" : "s"}...
          </p>
        ) : brief?.whyCamworks ? (
          <p className="text-sm text-text-primary leading-relaxed">{brief.whyCamworks}</p>
        ) : briefError ? (
          <p className="text-sm text-red-700">{briefError}</p>
        ) : (
          <p className="text-sm text-text-muted">Generating...</p>
        )}
      </div>

      {/* 2. Tab bar */}
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
      ) : (
        <>
          {/* 3. Company header */}
          <div className="rounded-xl border border-border bg-surface shadow-sm p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-bold text-navy tracking-tight">
                  {group.company}
                </h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-sm text-text-secondary">
                    {group.city ? `${group.city}, ${group.state}` : group.state}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border border-primary/30 bg-primary-subtle text-primary">
                    {group.industry}
                  </span>
                </div>
                {group.detectedSoftware.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {group.detectedSoftware.map((sw) => (
                      <span
                        key={sw}
                        className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border border-primary/30 bg-primary-subtle text-primary"
                      >
                        {sw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end flex-shrink-0">
                <span className="text-[10px] uppercase tracking-widest text-text-muted">
                  {computedLabel}
                </span>
                <span
                  className={cn(
                    "text-4xl font-bold tabular-nums leading-none mt-0.5",
                    computedScore >= 75
                      ? "text-emerald-600"
                      : computedScore >= 50
                      ? "text-primary"
                      : "text-amber-600"
                  )}
                >
                  {computedScore}
                  <span className="text-base text-text-muted font-normal">/100</span>
                </span>
                <div className="mt-2 w-32 h-1 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className={cn(
                      "h-full",
                      computedScore >= 75
                        ? "bg-emerald-500"
                        : computedScore >= 50
                        ? "bg-primary"
                        : "bg-amber-500"
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, computedScore))}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Overview */}
          {brief?.overview && (
            <p className="text-sm text-text-primary leading-relaxed px-1">
              {brief.overview}
            </p>
          )}

          {/* 5. Two-column callouts */}
          {brief && (
            <div className="grid md:grid-cols-2 gap-4">
              <CalloutBox
                title="CAMWorks Fit"
                tone="primary"
                content={brief.camworksFit}
              />
              <CalloutBox
                title="Manufacturing Challenge"
                tone="navy"
                content={brief.manufacturingChallenge}
              />
            </div>
          )}

          {/* 6. SIGNALS */}
          <Section title="Signals">
            <ul className="space-y-2">
              {group.signals.map((s) => {
                const u = urgencyForSignal(s);
                const Icon = TYPE_ICON[s.signalType] ?? Briefcase;
                const detected = s.detectedSoftware
                  .filter((x) => x.name && x.name !== "Unknown")
                  .map((x) => x.name);
                return (
                  <li
                    key={s.id}
                    className="flex items-start gap-3 rounded-md border border-border bg-surface px-3 py-2.5"
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
                      <p className="text-xs text-text-secondary mt-0.5 leading-relaxed line-clamp-2">
                        {s.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] text-text-muted">
                          {s.sourceLabel} · {s.postedAgo}
                        </span>
                        {detected.map((d) => (
                          <span
                            key={d}
                            className="text-[10px] font-medium text-primary"
                          >
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border flex-shrink-0",
                        URGENCY_BADGE[u]
                      )}
                    >
                      {u.toUpperCase()}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>

          {/* 7. CONTACTS */}
          <Section
            title={realContacts.length > 0 ? "Contacts" : "Target Contacts"}
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
                  <LinkedInTargetGrid targets={targets} company={group.company} />
                </div>
              </div>
            ) : (
              <LinkedInTargetGrid targets={targets} company={group.company} />
            )}
          </Section>

          {/* 8. OUTREACH COPY */}
          {brief && (
            <Section
              title="Outreach Copy"
              action={
                <button
                  type="button"
                  onClick={copyOutreach}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-hover"
                >
                  {outreachCopied ? (
                    <>
                      <Check className="h-3 w-3" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy
                    </>
                  )}
                </button>
              }
            >
              <p className="text-sm text-text-primary mb-2">
                <span className="text-text-muted">Subject: </span>
                <span className="font-semibold">{brief.outreachSubject}</span>
              </p>
              <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                {brief.outreachBody}
              </p>
            </Section>
          )}

          {/* 9. TALKING POINTS */}
          {brief && brief.talkingPoints.length > 0 && (
            <Section title="Talking Points">
              <ul className="space-y-2">
                {brief.talkingPoints.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-text-primary leading-relaxed"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* 10. Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button onClick={sendToAssist} className="sm:flex-1">
              <Sparkles className="h-4 w-4" />
              Open in Sales Assist
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast(`${group.company} added to your territory`)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add to Territory
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast(`${group.company} marked as Pursuing`)}
            >
              <Target className="h-3.5 w-3.5" />
              Mark Pursuing
            </Button>
          </div>
        </>
      )}
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

function CalloutBox({
  title,
  tone,
  content,
}: {
  title: string;
  tone: "primary" | "navy";
  content: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        tone === "primary"
          ? "border-primary/40 bg-primary-subtle/40"
          : "border-navy/30 bg-navy/5"
      )}
    >
      <p
        className={cn(
          "text-[10px] uppercase tracking-widest font-semibold mb-1.5",
          tone === "primary" ? "text-primary" : "text-navy"
        )}
      >
        {title}
      </p>
      <p className="text-sm text-text-primary leading-relaxed">{content}</p>
    </div>
  );
}

function Section({
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
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-[10px] uppercase tracking-widest font-semibold text-text-secondary">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
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

function LinkedInTargetGrid({
  targets,
  company,
}: {
  targets: TargetContact[];
  company: string;
}) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {targets.map((t) => (
        <a
          key={t.role}
          href={linkedinSearchUrl(t.role, company)}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-border bg-surface p-4 hover:border-primary/50 hover:bg-primary-subtle transition-colors block group"
        >
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-text-primary group-hover:text-primary">
              {t.role}
            </h3>
            <Linkedin className="h-3.5 w-3.5 text-text-muted group-hover:text-primary flex-shrink-0" />
          </div>
          <p className="text-xs text-text-muted mb-2">{t.department}</p>
          <p className="text-xs text-text-secondary leading-relaxed">{t.why}</p>
          <p className="text-[11px] text-primary mt-2 inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Find on LinkedIn
            <ExternalLink className="h-2.5 w-2.5" />
          </p>
        </a>
      ))}
    </div>
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
