"use client";

import * as React from "react";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Target,
  Copy,
  Check,
  AlertTriangle,
  Send,
  ArrowUpRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { BuilderHeader, Field } from "./common";
import {
  UniversalContextInput,
  emptyContext,
  composeContextMessage,
  hasContext,
  type UniversalContext,
} from "./universal-input";
import { cn } from "@/lib/utils";
import type { Tone, Methodology, ActiveCompanyContext } from "@/lib/sales-context";

interface Props {
  tone: Tone;
  methodology: Methodology;
  company: ActiveCompanyContext | null;
}

type CriterionStatus = "strong" | "weak" | "missing" | "not_set";

interface CriterionState {
  letter: string;
  name: string;
  description: string;
  status: CriterionStatus;
  evidence: string;
  gap: string;
}

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

const CRITERIA: Pick<CriterionState, "letter" | "name" | "description">[] = [
  {
    letter: "M",
    name: "Metrics",
    description:
      "What measurable business impact will the prospect achieve? Quantify the return: hours saved, dollars saved, scrap reduced, time to market.",
  },
  {
    letter: "E",
    name: "Economic Buyer",
    description:
      "Who has the budget authority to sign this contract? Often a VP, CFO, or owner. Confirm they have been engaged and bought in.",
  },
  {
    letter: "D",
    name: "Decision Criteria",
    description:
      "What objective and subjective criteria will the prospect use to make the final decision? Capability fit, integration, support model, total cost.",
  },
  {
    letter: "D",
    name: "Decision Process",
    description:
      "What is the formal process and timeline to move from evaluation to contract signature? Steps, gates, and dates.",
  },
  {
    letter: "P",
    name: "Paper Process",
    description:
      "What legal, procurement, security, or finance steps must complete before the contract is signed? Surface them early.",
  },
  {
    letter: "I",
    name: "Implicate the Pain",
    description:
      "What is the cost of the status quo? Make the pain real, quantified, and personal to the buyer so they have to act.",
  },
  {
    letter: "C",
    name: "Champion",
    description:
      "Who inside the account is selling for us when we are not in the room? Confirm they have power, motive, and access.",
  },
  {
    letter: "C",
    name: "Competition",
    description:
      "Who or what are you competing against? Other vendors, internal builds, open-source alternatives, or simply doing nothing.",
  },
];

function emptyState(): CriterionState[] {
  return CRITERIA.map((c) => ({
    ...c,
    status: "not_set",
    evidence: "",
    gap: "",
  }));
}

const STATUS_LABEL: Record<CriterionStatus, string> = {
  strong: "STRONG",
  weak: "WEAK",
  missing: "MISSING",
  not_set: "NOT SET",
};

const STATUS_STYLES: Record<CriterionStatus, string> = {
  strong: "bg-emerald-50 text-emerald-700 border-emerald-200",
  weak: "bg-amber-50 text-amber-700 border-amber-200",
  missing: "bg-red-50 text-red-700 border-red-200",
  not_set: "bg-surface-2 text-text-muted border-border",
};

function StatusBadge({ status }: { status: CriterionStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border",
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

interface StatusPillsProps {
  value: CriterionStatus;
  onChange: (status: CriterionStatus) => void;
}

function StatusPills({ value, onChange }: StatusPillsProps) {
  const options: { key: CriterionStatus; label: string; activeClass: string }[] = [
    { key: "strong", label: "Strong", activeClass: "bg-emerald-100 text-emerald-800 border-emerald-400" },
    { key: "weak", label: "Weak", activeClass: "bg-amber-100 text-amber-800 border-amber-400" },
    { key: "missing", label: "Missing", activeClass: "bg-red-100 text-red-800 border-red-400" },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-muted">Status:</span>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors",
              on
                ? o.activeClass
                : "border-border bg-surface text-text-secondary hover:bg-surface-2"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const ANALYZE_SYSTEM_PROMPT = `You are scoring a deal across the 8 MEDDPICC criteria from a sales rep's notes.

Reply with ONLY a single JSON object, no prose, no markdown. Use this exact shape:

{
  "criteria": [
    { "name": "Metrics", "status": "strong" | "weak" | "missing" | "not_set", "evidence": "what was discussed in the rep's notes for this criterion, in 1 to 3 sentences. Quote names, numbers, and dates when present.", "gap": "what is still unknown or needs to be confirmed for this criterion. 1 to 3 sentences. Concrete next questions or actions." },
    { "name": "Economic Buyer", ... },
    { "name": "Decision Criteria", ... },
    { "name": "Decision Process", ... },
    { "name": "Paper Process", ... },
    { "name": "Implicate the Pain", ... },
    { "name": "Champion", ... },
    { "name": "Competition", ... }
  ],
  "summary": "1 to 2 sentence overall read on the deal"
}

Rules:
- Status is strong, weak, missing, or not_set. Use not_set ONLY if the notes do not address this criterion at all. In that case set evidence to "Not discussed yet." and put suggested discovery questions in gap.
- Keep evidence factual based on the notes. Do not invent details.
- Gap should list what needs to happen next, with named actions if possible.
- No em dashes anywhere. Use commas or periods.`;

function buildFollowUpSystem(scorecard: CriterionState[], company: ActiveCompanyContext | null) {
  const lines = scorecard
    .map(
      (c) =>
        `${c.name} [${STATUS_LABEL[c.status]}]\n  Evidence: ${c.evidence || "(none)"}\n  Gap: ${c.gap || "(none)"}`
    )
    .join("\n\n");
  const companyLine = company
    ? `Active prospect: ${company.company} in ${company.city}${company.state ? `, ${company.state}` : ""}. Detected software: ${company.detectedSoftware.join(", ") || "unknown"}.`
    : "";
  return `You are a sales coach for a multi-product reseller rep helping advance a deal. Use the MEDDPICC scorecard below as the source of truth on what the rep knows. Answer follow-up questions about how to advance the deal. Be specific and actionable.

${companyLine}

Current MEDDPICC scorecard:

${lines}

Rules:
- Reference the actual evidence and gaps from the scorecard. Do not invent new facts about the prospect.
- Recommend concrete next actions tied to a named contact, role, or step where possible.
- Keep responses tight: under 200 words unless the question demands more.
- No em dashes. Use commas or periods.`;
}

interface ParsedAnalysis {
  criteria: { name: string; status: string; evidence?: string; gap?: string }[];
  summary?: string;
}

function parseAnalysis(raw: string): ParsedAnalysis | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!parsed?.criteria || !Array.isArray(parsed.criteria)) return null;
    return parsed as ParsedAnalysis;
  } catch {
    return null;
  }
}

function applyAnalysis(state: CriterionState[], parsed: ParsedAnalysis): CriterionState[] {
  return state.map((c) => {
    const match = parsed.criteria.find(
      (p) => p.name?.toLowerCase().trim() === c.name.toLowerCase()
    );
    if (!match) return c;
    const status = (["strong", "weak", "missing", "not_set"] as CriterionStatus[]).includes(
      match.status as CriterionStatus
    )
      ? (match.status as CriterionStatus)
      : "not_set";
    return {
      ...c,
      status,
      evidence: match.evidence ?? c.evidence,
      gap: match.gap ?? c.gap,
    };
  });
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function MeddpiccBuilder({ tone, methodology, company }: Props) {
  const [accountName, setAccountName] = React.useState(company?.company ?? "");
  const [context, setContext] = React.useState<UniversalContext>(emptyContext);
  const [scorecard, setScorecard] = React.useState<CriterionState[]>(emptyState);
  const [summary, setSummary] = React.useState("");
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analyzeError, setAnalyzeError] = React.useState<string | null>(null);
  const [openIdx, setOpenIdx] = React.useState<number | null>(null);
  const [copied, setCopied] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  // Follow-up chat state
  const [chat, setChat] = React.useState<ChatMsg[]>([]);
  const [followInput, setFollowInput] = React.useState("");
  const [followStreaming, setFollowStreaming] = React.useState(false);
  const [followError, setFollowError] = React.useState<string | null>(null);
  const [chatExpanded, setChatExpanded] = React.useState(false);
  const followAbortRef = React.useRef<AbortController | null>(null);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (company?.company) setAccountName(company.company);
  }, [company?.company]);

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const counts = React.useMemo(() => {
    return scorecard.reduce(
      (acc, c) => {
        acc[c.status] += 1;
        return acc;
      },
      { strong: 0, weak: 0, missing: 0, not_set: 0 }
    );
  }, [scorecard]);

  const filledCount = counts.strong + counts.weak + counts.missing;
  const progress = Math.round((filledCount / scorecard.length) * 100);
  const qualLabel =
    progress === 0
      ? "Not Started"
      : progress < 50
      ? "Early Discovery"
      : progress < 80
      ? "Active Qualification"
      : "Well Qualified";

  const onAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasContext(context) || analyzing) return;

    setAnalyzeError(null);
    setAnalyzing(true);
    setSummary("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const prefix = [
        accountName && `Account: ${accountName}`,
        company?.detectedSoftware?.length
          ? `Detected software: ${company.detectedSoftware.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      const userMessage = [prefix, composeContextMessage(context)]
        .filter(Boolean)
        .join("\n\n");

      const res = await fetch("/api/assist", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: "MEDDPICC",
          tone,
          methodology,
          company,
          systemPromptOverride: ANALYZE_SYSTEM_PROMPT,
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

      const parsed = parseAnalysis(buffer);
      if (!parsed) {
        throw new Error("Could not parse model response. Try again or rephrase the notes.");
      }
      setScorecard((prev) => applyAnalysis(prev, parsed));
      if (parsed.summary) setSummary(parsed.summary);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      const msg = e?.message || "Analyze failed";
      setAnalyzeError(
        msg.includes("ANTHROPIC_API_KEY")
          ? "Set ANTHROPIC_API_KEY in your .env.local to enable MEDDPICC analysis."
          : msg
      );
    } finally {
      setAnalyzing(false);
      abortRef.current = null;
    }
  };

  const reset = () => {
    setScorecard(emptyState());
    setSummary("");
    setAnalyzeError(null);
    setChat([]);
  };

  const updateCriterion = (i: number, patch: Partial<CriterionState>) => {
    setScorecard((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };

  const copyScorecard = async () => {
    const text =
      `MEDDPICC Scorecard for ${accountName || "Untitled Account"}\n` +
      `${progress}% complete (${qualLabel})\n\n` +
      scorecard
        .map(
          (c) =>
            `${c.letter} - ${c.name} [${STATUS_LABEL[c.status]}]\nEvidence: ${
              c.evidence || "Not discussed yet."
            }\nGap: ${c.gap || "(none defined)"}`
        )
        .join("\n\n") +
      (summary ? `\n\nSummary: ${summary}` : "");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const onFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = followInput.trim();
    if (!text || followStreaming) return;

    const userMsg: ChatMsg = { id: uid(), role: "user", content: text };
    const aiMsg: ChatMsg = { id: uid(), role: "assistant", content: "", pending: true };
    setChat((prev) => [...prev, userMsg, aiMsg]);
    setFollowInput("");
    setFollowStreaming(true);
    setFollowError(null);

    const controller = new AbortController();
    followAbortRef.current = controller;

    try {
      const res = await fetch("/api/assist", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: "MEDDPICC",
          tone,
          methodology,
          company,
          systemPromptOverride: buildFollowUpSystem(scorecard, company),
          messages: [...chat, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
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
        setChat((prev) =>
          prev.map((m) => (m.id === aiMsg.id ? { ...m, content: buffer, pending: false } : m))
        );
      }
      setChat((prev) => prev.map((m) => (m.id === aiMsg.id ? { ...m, pending: false } : m)));
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      const msg = e?.message || "Follow-up failed";
      const friendly = msg.includes("ANTHROPIC_API_KEY")
        ? "Set ANTHROPIC_API_KEY in your .env.local to enable follow-ups."
        : msg;
      setFollowError(friendly);
      setChat((prev) =>
        prev.map((m) =>
          m.id === aiMsg.id ? { ...m, pending: false, content: `Sorry, the request failed. ${friendly}` } : m
        )
      );
    } finally {
      setFollowStreaming(false);
      followAbortRef.current = null;
    }
  };

  const SUGGESTED_FOLLOW_UPS = [
    "How do we expand paper processes",
    "What's the next step to confirm the economic buyer",
    "How do I implicate the pain in the next call",
  ];

  return (
    <div className="flex flex-col gap-5">
      <BuilderHeader
        title="MEDDPICC Scorecard"
        subtitle="Paste meeting notes and hit Analyze. Only the topics you actually discussed get filled in. Edit or override any field after."
      />
      <form onSubmit={onAnalyze} className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Account name (e.g. JPMorgan Chase)"
            className="flex-1"
          />
          <Button type="button" variant="secondary" onClick={copyScorecard}>
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </Button>
        </div>
        <UniversalContextInput
          context={context}
          onChange={setContext}
          notesLabel="Meeting notes, call transcripts, or email threads"
          notesPlaceholder="Paste meeting notes, call transcripts, or email threads here. AI will only fill in the MEDDPICC fields that were actually discussed..."
        />
        <div className="flex items-center gap-2">
          {analyzing ? (
            <Button type="button" variant="secondary" onClick={() => abortRef.current?.abort()}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Stop analyzing
            </Button>
          ) : (
            <Button type="submit" disabled={!hasContext(context)}>
              <Sparkles className="h-4 w-4" />
              Analyze & Fill Scorecard
            </Button>
          )}
          {filledCount > 0 && !analyzing && (
            <Button type="button" variant="ghost" onClick={reset}>
              Reset scorecard
            </Button>
          )}
        </div>
      </form>

      {analyzeError && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {analyzeError}
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-text-primary">Deal Qualification</span>
          </div>
          <span
            className={cn(
              "text-sm font-semibold",
              progress === 0 ? "text-red-600" : progress < 50 ? "text-amber-600" : "text-emerald-700"
            )}
          >
            {progress}% &middot; {qualLabel}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-hover transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-700 font-medium">{counts.strong} strong</span>
          <span className="text-amber-700 font-medium">{counts.weak} weak</span>
          <span className="text-red-700 font-medium">{counts.missing} missing</span>
          <span className="text-text-muted">{counts.not_set} not set</span>
        </div>
        {summary && (
          <p className="text-sm text-text-secondary mt-3 leading-relaxed border-t border-border pt-3">
            {summary}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {scorecard.map((c, i) => {
          const open = openIdx === i;
          return (
            <div
              key={`${c.name}-${i}`}
              className="rounded-lg border border-border bg-surface overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenIdx(open ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-md bg-surface-2 text-text-secondary text-xs font-bold flex items-center justify-center">
                    {c.letter}
                  </span>
                  <span className="text-sm font-semibold text-text-primary">{c.name}</span>
                  {open && (
                    <span className="text-xs text-text-muted hidden md:inline italic">
                      {c.description.length > 110
                        ? `${c.description.slice(0, 110)}...`
                        : c.description}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={c.status} />
                  {open ? (
                    <ChevronUp className="h-4 w-4 text-text-muted" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-text-muted" />
                  )}
                </div>
              </button>
              {open && (
                <div className="border-t border-border px-4 py-4 bg-surface-2/30 animate-fade-in flex flex-col gap-3">
                  <p className="text-xs italic text-text-secondary leading-relaxed">
                    {c.description}
                  </p>
                  <StatusPills
                    value={c.status}
                    onChange={(status) => updateCriterion(i, { status })}
                  />
                  <div className="grid md:grid-cols-1 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">
                        Evidence &mdash; What do we know?
                      </p>
                      <Textarea
                        value={c.evidence}
                        onChange={(e) => updateCriterion(i, { evidence: e.target.value })}
                        placeholder="What was discussed in the meeting that addresses this criterion? Quote names, numbers, dates."
                        className="min-h-[80px]"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-1">
                        Gap &mdash; What do we still need?
                      </p>
                      <Textarea
                        value={c.gap}
                        onChange={(e) => updateCriterion(i, { gap: e.target.value })}
                        placeholder="What is still unknown or unconfirmed? List the next questions or actions to advance this criterion."
                        className="min-h-[80px]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "rounded-xl border border-border bg-surface shadow-sm overflow-hidden flex flex-col",
          chatExpanded ? "h-[640px]" : "h-[420px]"
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2/40">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Follow-up Chat
            </span>
          </div>
          <button
            type="button"
            onClick={() => setChatExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            {chatExpanded ? (
              <>
                <Minimize2 className="h-3 w-3" />
                Collapse
              </>
            ) : (
              <>
                <Maximize2 className="h-3 w-3" />
                Expand
              </>
            )}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 flex flex-col gap-3">
          {chat.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <p className="text-sm text-text-muted max-w-md">
                Ask the AI how to advance this deal. It has full context of the scorecard above.
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {SUGGESTED_FOLLOW_UPS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setFollowInput(q)}
                    className="text-xs text-text-secondary hover:text-primary border border-border bg-surface px-2.5 py-1 rounded-full hover:border-primary/50 hover:bg-primary-subtle transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chat.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  m.role === "user"
                    ? "self-end bg-primary text-white"
                    : "self-start bg-surface-2 text-text-primary border border-border"
                )}
              >
                {m.pending && !m.content ? (
                  <span className="inline-flex gap-1 items-center text-text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-pulse-soft" />
                    <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-pulse-soft [animation-delay:200ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-text-muted animate-pulse-soft [animation-delay:400ms]" />
                  </span>
                ) : (
                  m.content
                )}
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
        {followError && (
          <div className="border-t border-border px-3 py-2 text-xs text-red-700 bg-red-50">
            {followError}
          </div>
        )}
        <form
          onSubmit={onFollowUp}
          className="border-t border-border p-3 flex items-end gap-2 bg-surface"
        >
          <Textarea
            value={followInput}
            onChange={(e) => setFollowInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onFollowUp(e as any);
              }
            }}
            placeholder="Ask a follow-up about this MEDDPICC..."
            className="min-h-[44px] flex-1"
          />
          {followStreaming ? (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => followAbortRef.current?.abort()}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!followInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
