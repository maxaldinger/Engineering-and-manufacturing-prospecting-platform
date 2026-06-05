"use client";

import * as React from "react";
import { Sparkles, Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BuilderHeader } from "./common";
import {
  UniversalContextInput,
  emptyContext,
  composeContextMessage,
  hasContext,
  type UniversalContext,
} from "./universal-input";
import { validateProse, extractNumbers } from "@/lib/brief/validator";
import { ALL_PRODUCT_TYPES } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { Tone, Methodology, ActiveCompanyContext } from "@/lib/sales-context";

interface Props {
  tone: Tone;
  methodology: Methodology;
  company: ActiveCompanyContext | null;
}

// The portfolio the model scores against, derived from the catalog so it stays in
// sync as products change.
const PORTFOLIO_LIST = ALL_PRODUCT_TYPES.filter((t) => t.ourProducts.length > 0)
  .map((t) => `- ${t.label}: ${t.ourProducts.join(", ")}`)
  .join("\n");

const SYSTEM_PROMPT = `You are a Hawk Ridge Systems sales engineer scoring how well the SOLIDWORKS portfolio fits ONE specific prospect, based ONLY on the rep's notes.

Hawk Ridge Systems portfolio (score the products that are relevant to this prospect):
${PORTFOLIO_LIST}

Reply with ONLY a single JSON object, no prose, no markdown fences:

{
  "account": "the real company name from the notes (never 'the prospect')",
  "overallScore": <0-100, your honest overall portfolio-fit judgment>,
  "products": [
    {
      "product": "<a product or product line from the portfolio above>",
      "score": <0-100, honest fit for THIS prospect>,
      "useCase": "<short phrase: the primary use case for this product>",
      "whyItFits": "<2 to 4 sentences tied to SPECIFIC facts in the notes: the tool they run, the pain it creates, their workflow. Name the actual tool and the gap. This must read differently for a different company.>",
      "demoFocus": "<one specific demo focus tied to their actual parts or workflow>"
    }
  ],
  "demoFlow": ["<ordered step: Product, what to demonstrate on their geometry>"],
  "demoStrategy": "<2 to 4 sentences on the sequence logic, grounded in their stack>",
  "demoDuration": "<short text estimate, e.g. 60 to 90 minutes for full coverage>"
}

Rules:
- Use the REAL account name from the notes. If the notes never name the company, set account to "the account".
- whyItFits MUST cite a specific fact from the notes (a named tool, a stated pain, a workflow step). If a product's fit is not supported by anything in the notes, give it a LOW score and say what is unconfirmed, or omit the product. NEVER repeat the same reasoning across products, and never use boilerplate that would read identically for any company.
- Scores are honest judgments. A strong, well-evidenced fit scores high; a speculative one scores low. Do not inflate.
- No statistics, no percentages, no dollar figures, no invented numbers anywhere in the prose. Qualitative reasoning only. The scores are the only numbers, and they are your judgment, not a claim about their business.
- No named customers, no case studies.
- No em dashes. Use commas or periods.`;

interface ProductRow {
  product: string;
  score: number;
  useCase: string;
  whyItFits: string;
  demoFocus: string;
}

interface FitResult {
  account: string;
  overallScore: number;
  products: ProductRow[];
  demoFlow: string[];
  demoStrategy: string;
  demoDuration: string;
}

function clampScore(n: unknown): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 50;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function parseResult(raw: string): FitResult | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    const p = JSON.parse(raw.slice(start, end + 1));
    if (!p || !Array.isArray(p.products)) return null;
    const products: ProductRow[] = p.products
      .filter((x: unknown) => x && typeof (x as { product?: unknown }).product === "string")
      .map((x: Record<string, unknown>) => ({
        product: String(x.product).trim(),
        score: clampScore(x.score),
        useCase: String(x.useCase ?? "").trim(),
        whyItFits: String(x.whyItFits ?? "").trim(),
        demoFocus: String(x.demoFocus ?? "").trim(),
      }))
      .sort((a: ProductRow, b: ProductRow) => b.score - a.score);
    if (products.length === 0) return null;
    return {
      account: String(p.account ?? "").trim(),
      overallScore: clampScore(p.overallScore),
      products,
      demoFlow: Array.isArray(p.demoFlow)
        ? p.demoFlow.map((s: unknown) => String(s).trim()).filter(Boolean)
        : [],
      demoStrategy: String(p.demoStrategy ?? "").trim(),
      demoDuration: String(p.demoDuration ?? "").trim(),
    };
  } catch {
    return null;
  }
}

// Run every prose field through the same validator the brief uses: strip any
// number the notes did not contain, so the reasoning carries the scores honestly.
function groundResult(
  r: FitResult,
  allowed: string[]
): { result: FitResult; removed: number } {
  let removed = 0;
  const clean = (s: string): string => {
    const res = validateProse(s, allowed);
    removed += res.flags.filter((f) => f.reason === "unsourced-number").length;
    return res.clean;
  };
  return {
    result: {
      ...r,
      products: r.products.map((p) => ({
        ...p,
        useCase: clean(p.useCase),
        whyItFits: clean(p.whyItFits),
        demoFocus: clean(p.demoFocus),
      })),
      demoFlow: r.demoFlow.map(clean),
      demoStrategy: clean(r.demoStrategy),
      demoDuration: clean(r.demoDuration),
    },
    removed,
  };
}

const SCORE_BAR: (score: number) => string = (score) =>
  score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-primary" : "bg-amber-500";

export function ProductFitBuilder({ tone, methodology, company }: Props) {
  const [accountName, setAccountName] = React.useState(company?.company ?? "");
  const [context, setContext] = React.useState<UniversalContext>(emptyContext);
  const [result, setResult] = React.useState<FitResult | null>(null);
  const [removed, setRemoved] = React.useState(0);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [assessmentDate] = React.useState(() =>
    new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
  );
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (company?.company) setAccountName(company.company);
  }, [company?.company]);

  const onAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasContext(context) || analyzing) return;
    setError(null);
    setAnalyzing(true);
    setResult(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const prefix = [
        accountName && `Account name: ${accountName}`,
        company?.detectedSoftware?.length
          ? `Detected software: ${company.detectedSoftware.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
      const userMessage = [prefix, composeContextMessage(context)].filter(Boolean).join("\n\n");

      const res = await fetch("/api/assist", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: "Product Fit",
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
      const allowed = extractNumbers(context.notes, context.fetchedText ?? "");
      const grounded = groundResult(parsed, allowed);
      // Prefer the rep's typed account name when the model could not pull a real one.
      if (accountName && (!grounded.result.account || /^the (account|prospect)$/i.test(grounded.result.account))) {
        grounded.result.account = accountName;
      }
      setResult(grounded.result);
      setRemoved(grounded.removed);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      const msg = e?.message || "Analyze failed";
      setError(
        msg.includes("ANTHROPIC_API_KEY")
          ? "Set ANTHROPIC_API_KEY in your .env.local to enable Product Fit analysis."
          : msg
      );
    } finally {
      setAnalyzing(false);
      abortRef.current = null;
    }
  };

  const copyScorecard = async () => {
    if (!result) return;
    const lines: string[] = [
      `PRODUCT FIT SCORECARD: ${result.account}`,
      `Overall Fit Score: ${result.overallScore}/100`,
      `Assessment Date: ${assessmentDate}`,
      "",
      "PRODUCT SCORECARD",
      ...result.products.map((p) => `  ${p.product}: ${p.score}/100 - ${p.useCase}`),
      "",
      "DETAILED ANALYSIS",
      ...result.products.flatMap((p) => [
        `${p.product} (${p.score}/100)`,
        `  Why it fits: ${p.whyItFits}`,
        `  Key use case: ${p.useCase}`,
        `  Demo focus: ${p.demoFocus}`,
        "",
      ]),
    ];
    if (result.demoFlow.length) {
      lines.push("RECOMMENDED DEMO FLOW");
      result.demoFlow.forEach((s, i) => lines.push(`  ${i + 1}. ${s}`));
      if (result.demoStrategy) lines.push("", `Demo Strategy: ${result.demoStrategy}`);
      if (result.demoDuration) lines.push(`Estimated Demo Duration: ${result.demoDuration}`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <BuilderHeader
        title="Product Fit Scorecard"
        subtitle="Paste discovery notes (or a capability page). The AI scores the portfolio against THIS prospect's stated stack and pains, with grounded per-product reasoning, not boilerplate."
      />
      <form onSubmit={onAnalyze} className="flex flex-col gap-4">
        <Input
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="Account name (used in the scorecard; auto-filled from the notes if blank)"
        />
        <UniversalContextInput
          context={context}
          onChange={setContext}
          notesLabel="Discovery notes"
          notesPlaceholder="Paste discovery notes: the tools they run (Inventor, Mastercam, no PDM), their pains (manual design-to-CAM handoff), their workflow, key requirements..."
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
              Analyze Product Fit
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
        <Scorecard
          result={result}
          date={assessmentDate}
          removed={removed}
          copied={copied}
          onCopy={copyScorecard}
        />
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-primary mb-3">{children}</h4>
  );
}

function Scorecard({
  result,
  date,
  removed,
  copied,
  onCopy,
}: {
  result: FitResult;
  date: string;
  removed: number;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-2/40">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Generated Scorecard
        </span>
        <Button variant="ghost" size="sm" onClick={onCopy} type="button">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <div className="p-5 md:p-6 flex flex-col gap-7">
        <div>
          <h3 className="text-lg font-bold text-text-primary">
            Product Fit Scorecard: {result.account || "the account"}
          </h3>
          <p className="text-sm text-text-secondary mt-1.5">
            <span className="font-semibold text-text-primary">Overall Fit Score:</span>{" "}
            {result.overallScore}/100
          </p>
          <p className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">Assessment Date:</span> {date}
          </p>
        </div>

        <div>
          <SectionTitle>Product Scorecard</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
                  <th className="py-2 pr-3 font-semibold">Product</th>
                  <th className="py-2 pr-3 font-semibold w-[28%]">Fit</th>
                  <th className="py-2 pr-3 font-semibold">Score</th>
                  <th className="py-2 font-semibold">Primary Use Case</th>
                </tr>
              </thead>
              <tbody>
                {result.products.map((p, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-3 font-medium text-text-primary">{p.product}</td>
                    <td className="py-2.5 pr-3">
                      <div className="h-2 w-full max-w-[160px] rounded-full bg-surface-2 overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", SCORE_BAR(p.score))}
                          style={{ width: `${p.score}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 font-bold tabular-nums text-text-primary">{p.score}</td>
                    <td className="py-2.5 text-text-secondary">{p.useCase}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <SectionTitle>Detailed Analysis</SectionTitle>
          <div className="flex flex-col gap-4">
            {result.products.map((p, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface-2/30 p-4">
                <p className="text-sm font-bold text-text-primary">
                  {p.product} <span className="text-text-muted font-semibold">({p.score}/100)</span>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  <span className="font-semibold text-text-primary">Why it fits:</span> {p.whyItFits}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                  <span className="font-semibold text-text-primary">Key use case:</span> {p.useCase}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                  <span className="font-semibold text-text-primary">Demo focus:</span> {p.demoFocus}
                </p>
              </div>
            ))}
          </div>
        </div>

        {result.demoFlow.length > 0 && (
          <div>
            <SectionTitle>Recommended Demo Flow</SectionTitle>
            <ol className="flex flex-col gap-1.5">
              {result.demoFlow.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-text-secondary">
                  <span className="font-mono text-xs text-text-muted pt-0.5">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            {result.demoStrategy && (
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                <span className="font-semibold text-text-primary">Demo Strategy:</span>{" "}
                {result.demoStrategy}
              </p>
            )}
            {result.demoDuration && (
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                <span className="font-semibold text-text-primary">Estimated Demo Duration:</span>{" "}
                {result.demoDuration}
              </p>
            )}
          </div>
        )}

        <p className="border-t border-border pt-4 text-xs italic text-text-muted leading-relaxed">
          Scores are grounded judgments based on the rep&apos;s notes and Hawk Ridge Systems product
          capabilities. Actual fit may vary with deeper technical discovery.
          {removed > 0 && (
            <span> {removed} unverified figure{removed === 1 ? "" : "s"} were removed from the reasoning.</span>
          )}
        </p>
      </div>
    </div>
  );
}
