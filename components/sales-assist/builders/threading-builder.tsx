"use client";

import * as React from "react";
import {
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Users,
  Mail,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BuilderHeader } from "./common";
import { validateProse, extractNumbers } from "@/lib/brief/validator";
import { cn } from "@/lib/utils";
import type { Tone, Methodology, ActiveCompanyContext } from "@/lib/sales-context";

interface Props {
  tone: Tone;
  methodology: Methodology;
  company: ActiveCompanyContext | null;
}

interface Contact {
  id: string;
  name: string;
  title: string;
  notes: string;
}

type RoleStatus = "covered" | "partial" | "missing";

interface RoleCoverage {
  role: string;
  status: RoleStatus;
  coveredBy: string;
  why: string;
}

interface OutreachItem {
  targetRole: string;
  approach: string;
  draft: string;
}

interface ThreadingResult {
  threadingScore: number;
  summary: string;
  roles: RoleCoverage[];
  outreach: OutreachItem[];
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function blankContact(): Contact {
  return { id: uid(), name: "", title: "", notes: "" };
}

const SYSTEM_PROMPT = `You are a sales engineer analyzing multi-threading coverage on a deal for a SOLIDWORKS reseller. You are given the rep's known contacts (name, title, notes). Map them to the buying committee, score coverage, flag the missing roles, and draft outreach for the gaps.

Buying committee roles to assess for a typical engineering-software purchase:
- Economic Buyer: signs the budget, often a VP of Engineering, Director of Engineering or Manufacturing, owner, or CFO.
- Champion: an internal advocate with power, motive, and access.
- Technical Evaluator: the engineer or programmer who runs the evaluation and lives in the tool day to day.
- Influencer: a design lead, IT, or shop-floor lead whose buy-in de-risks the deal.

Reply with ONLY a single JSON object, no prose, no markdown fences:

{
  "threadingScore": <0-100, honest committee coverage>,
  "summary": "<1 to 2 sentences on the coverage and the single biggest gap>",
  "roles": [
    { "role": "Economic Buyer", "status": "covered" | "partial" | "missing", "coveredBy": "<the EXACT name of a provided contact who fills this role, or empty string if none>", "why": "<1 sentence on why this role matters for this deal>" }
  ],
  "outreach": [
    { "targetRole": "<a role whose status is partial or missing>", "approach": "<how to reach this role and who on the rep's team should own it>", "draft": "<a short outreach message tuned to that role, no greeting fluff>" }
  ]
}

Rules:
- Only use contact names the rep actually provided. NEVER invent a contact name. If a role is filled by nobody, set status to missing and coveredBy to an empty string, and address the outreach to the ROLE, not a name.
- Score honestly: an unfilled Economic Buyer is a major gap and pulls the score down.
- Generate outreach only for roles whose status is partial or missing.
- No statistics, no fabricated numbers, no named customers. Qualitative only.
- No em dashes. Use commas or periods.`;

function clampScore(n: unknown): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 50;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function parseResult(raw: string): ThreadingResult | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    const p = JSON.parse(raw.slice(start, end + 1));
    if (!p || !Array.isArray(p.roles)) return null;
    const roles: RoleCoverage[] = p.roles
      .filter((x: unknown) => x && typeof (x as { role?: unknown }).role === "string")
      .map((x: Record<string, unknown>) => ({
        role: String(x.role).trim(),
        status: (["covered", "partial", "missing"] as RoleStatus[]).includes(x.status as RoleStatus)
          ? (x.status as RoleStatus)
          : "missing",
        coveredBy: String(x.coveredBy ?? "").trim(),
        why: String(x.why ?? "").trim(),
      }));
    const outreach: OutreachItem[] = Array.isArray(p.outreach)
      ? p.outreach
          .filter((x: unknown) => x && typeof (x as { targetRole?: unknown }).targetRole === "string")
          .map((x: Record<string, unknown>) => ({
            targetRole: String(x.targetRole).trim(),
            approach: String(x.approach ?? "").trim(),
            draft: String(x.draft ?? "").trim(),
          }))
      : [];
    return {
      threadingScore: clampScore(p.threadingScore),
      summary: String(p.summary ?? "").trim(),
      roles,
      outreach,
    };
  } catch {
    return null;
  }
}

// Validate every prose field, and enforce the no-invented-name rule: a coveredBy
// is only honored if it matches a contact the rep actually provided.
function groundResult(
  r: ThreadingResult,
  allowed: string[],
  knownNames: string[]
): { result: ThreadingResult; removed: number } {
  let removed = 0;
  const clean = (s: string): string => {
    const res = validateProse(s, allowed);
    removed += res.flags.filter((f) => f.reason === "unsourced-number").length;
    return res.clean;
  };
  const known = new Set(knownNames.map((n) => n.toLowerCase().trim()).filter(Boolean));
  return {
    result: {
      ...r,
      summary: clean(r.summary),
      roles: r.roles.map((role) => {
        // Drop a coveredBy name the rep never entered, and downgrade to missing.
        const realName = role.coveredBy && known.has(role.coveredBy.toLowerCase().trim());
        return {
          ...role,
          coveredBy: realName ? role.coveredBy : "",
          status: realName ? role.status : "missing",
          why: clean(role.why),
        };
      }),
      outreach: r.outreach.map((o) => ({
        ...o,
        approach: clean(o.approach),
        draft: clean(o.draft),
      })),
    },
    removed,
  };
}

const SCORE_LABEL = (s: number) => (s >= 75 ? "Strong coverage" : s >= 45 ? "Partial coverage" : "Thin coverage");
const SCORE_COLOR = (s: number) =>
  s >= 75 ? "text-emerald-600 dark:text-emerald-400" : s >= 45 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";

const STATUS_STYLE: Record<RoleStatus, string> = {
  covered: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  partial: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  missing: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
};

export function ThreadingBuilder({ tone, methodology, company }: Props) {
  const [contacts, setContacts] = React.useState<Contact[]>([blankContact()]);
  const [result, setResult] = React.useState<ThreadingResult | null>(null);
  const [removed, setRemoved] = React.useState(0);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const accountName = company?.company ?? "";
  const hasAny = contacts.some((c) => c.name.trim() || c.title.trim() || c.notes.trim());

  const updateContact = (id: string, patch: Partial<Contact>) =>
    setContacts((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const addContact = () => setContacts((list) => [...list, blankContact()]);
  const removeContact = (id: string) =>
    setContacts((list) => (list.length === 1 ? list : list.filter((c) => c.id !== id)));

  const onAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasAny || analyzing) return;
    setError(null);
    setAnalyzing(true);
    setResult(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const contactLines = contacts
        .filter((c) => c.name.trim() || c.title.trim() || c.notes.trim())
        .map(
          (c) =>
            `- ${c.name.trim() || "(no name)"}${c.title.trim() ? `, ${c.title.trim()}` : ""}${
              c.notes.trim() ? `. Notes: ${c.notes.trim()}` : ""
            }`
        )
        .join("\n");
      const prefix = [
        accountName && `Account: ${accountName}`,
        company?.detectedSoftware?.length
          ? `Detected software: ${company.detectedSoftware.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
      const userMessage = [prefix, `Known contacts:\n${contactLines}`].filter(Boolean).join("\n\n");

      const res = await fetch("/api/assist", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: "Threading",
          tone,
          methodology,
          company,
          systemPromptOverride: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      });
      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => "");
        throw new Error(errBody || `Request failed: ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }
      const parsed = parseResult(buffer);
      if (!parsed) {
        throw new Error("Could not parse model response. Try regenerating.");
      }
      const allowed = extractNumbers(...contacts.map((c) => c.notes));
      const knownNames = contacts.map((c) => c.name).filter(Boolean);
      const grounded = groundResult(parsed, allowed, knownNames);
      setResult(grounded.result);
      setRemoved(grounded.removed);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      const msg = e?.message || "Analyze failed";
      setError(
        msg.includes("ANTHROPIC_API_KEY")
          ? "Set ANTHROPIC_API_KEY in your .env.local to enable threading analysis."
          : msg
      );
    } finally {
      setAnalyzing(false);
      abortRef.current = null;
    }
  };

  const copyDraft = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <BuilderHeader
        title="Multi-Threading Analysis"
        subtitle={`Add your deal contacts. Get a threading score, missing-role gaps, and outreach drafts tuned to ${
          accountName ? `the ${accountName}` : "the"
        } buying committee.`}
      />

      <p className="rounded-md border border-dashed border-border bg-surface-2/40 px-3 py-2 text-xs text-text-muted leading-relaxed">
        Contacts live in this browser session only. Saving a committee across sessions and syncing it
        per rep is on the HRS backend (pending).
      </p>

      <form onSubmit={onAnalyze} className="flex flex-col gap-3">
        {contacts.map((c, i) => (
          <div key={c.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Contact {i + 1}
              </span>
              {contacts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeContact(c.id)}
                  className="p-1 rounded text-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                  aria-label={`Remove contact ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-2.5">
              <Input
                value={c.name}
                onChange={(e) => updateContact(c.id, { name: e.target.value })}
                placeholder="Name"
              />
              <Input
                value={c.title}
                onChange={(e) => updateContact(c.id, { title: e.target.value })}
                placeholder="Title (e.g. Director of Engineering)"
              />
            </div>
            <Textarea
              value={c.notes}
              onChange={(e) => updateContact(c.id, { notes: e.target.value })}
              placeholder="Notes (e.g. owns the CAD budget, frustrated with Inventor licensing, met at IMTS)"
              className="mt-2.5 min-h-[64px]"
            />
          </div>
        ))}

        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={addContact}>
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </Button>
          {analyzing ? (
            <Button type="button" variant="secondary" onClick={() => abortRef.current?.abort()}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Stop
            </Button>
          ) : (
            <Button type="submit" disabled={!hasAny}>
              <Sparkles className="h-4 w-4" />
              Analyze Threading
            </Button>
          )}
        </div>
      </form>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-5">
          {/* Score */}
          <div className="rounded-xl border border-border bg-surface shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-text-primary">Threading Coverage</span>
              </div>
              <div className="text-right">
                <span className={cn("text-3xl font-bold tabular-nums leading-none", SCORE_COLOR(result.threadingScore))}>
                  {result.threadingScore}
                  <span className="text-base text-text-muted font-normal">/100</span>
                </span>
                <p className={cn("text-[10px] uppercase tracking-wider mt-1", SCORE_COLOR(result.threadingScore))}>
                  {SCORE_LABEL(result.threadingScore)}
                </p>
              </div>
            </div>
            {result.summary && (
              <p className="text-sm text-text-secondary leading-relaxed mt-3 border-t border-border pt-3">
                {result.summary}
              </p>
            )}
          </div>

          {/* Role coverage */}
          {result.roles.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-primary mb-3">
                Role Coverage
              </h4>
              <div className="flex flex-col gap-2">
                {result.roles.map((role, i) => (
                  <div key={i} className="rounded-lg border border-border bg-surface p-3.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text-primary">{role.role}</span>
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                          STATUS_STYLE[role.status]
                        )}
                      >
                        {role.status}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1">
                      {role.coveredBy ? (
                        <>
                          <span className="font-semibold text-text-primary">Covered by:</span>{" "}
                          {role.coveredBy}
                        </>
                      ) : (
                        <span className="italic text-text-muted">No contact entered for this role yet.</span>
                      )}
                    </p>
                    {role.why && (
                      <p className="text-xs text-text-secondary mt-1 leading-relaxed">{role.why}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Outreach drafts for the gaps */}
          {result.outreach.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-primary mb-3">
                Outreach for the Gaps
              </h4>
              <div className="flex flex-col gap-2.5">
                {result.outreach.map((o, i) => {
                  const id = `outreach-${i}`;
                  return (
                    <div key={i} className="rounded-lg border border-border bg-surface p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                          <Mail className="h-3.5 w-3.5 text-primary" />
                          {o.targetRole}
                        </span>
                        <Button variant="ghost" size="sm" type="button" onClick={() => copyDraft(id, o.draft)}>
                          {copiedId === id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedId === id ? "Copied" : "Copy"}
                        </Button>
                      </div>
                      {o.approach && (
                        <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                          <span className="font-semibold text-text-primary">Approach:</span> {o.approach}
                        </p>
                      )}
                      {o.draft && (
                        <p className="text-sm text-text-secondary mt-2 leading-relaxed whitespace-pre-wrap border-t border-border pt-2">
                          {o.draft}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-xs italic text-text-muted leading-relaxed">
            Roles with no entered contact are flagged as gaps, never filled with an invented name.
            {removed > 0 && (
              <span> {removed} unverified figure{removed === 1 ? "" : "s"} were removed from the analysis.</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
