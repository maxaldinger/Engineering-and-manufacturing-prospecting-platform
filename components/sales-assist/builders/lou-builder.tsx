"use client";

import * as React from "react";
import {
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  FileEdit,
  Download,
  AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
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
import type { Tone, Methodology, ActiveCompanyContext } from "@/lib/sales-context";

interface Props {
  tone: Tone;
  methodology: Methodology;
  company: ActiveCompanyContext | null;
}

type Priority = "" | "High" | "Medium" | "Low";

const CATEGORY_OPTIONS = [
  "Design",
  "Manufacturing",
  "Simulation",
  "Electrical",
  "Data Management",
  "Additive / 3D Printing",
  "Inspection / Scanning",
  "Training & Services",
];
const PRIORITY_OPTIONS: Priority[] = ["", "High", "Medium", "Low"];

interface LouIssue {
  id: string;
  businessIssue: string; // Critical Business Issue, grounded in the notes
  recommendedResponse: string; // "Can we help? If so, how?", names the product
  category: string;
  priority: Priority; // suggested, the customer confirms or changes
  timeframe: string; // blank unless the notes stated one; the customer sets it
  notes: string; // always blank from us, for the customer
}

const SYSTEM_PROMPT = `You are converting a sales rep's discovery notes into a Letter of Understanding from a multi-product engineering-software reseller. It is sent to the customer to confirm: they correct anything wrong, set priority and timeframe, and add notes.

Reply with ONLY a single JSON object, no prose, no markdown fences. Use this exact shape:

{
  "coverLine": "<1 sentence, factual: this captures what we understood from the discovery conversation. No fluff, no stats.>",
  "issues": [
    {
      "businessIssue": "<1 to 3 sentences describing a pain or business problem the rep documented, in the customer's language.>",
      "recommendedResponse": "<2 to 4 sentences: name the specific portfolio product and the capability that addresses the issue, and the qualitative benefit. No invented numbers.>",
      "category": "Design" | "Manufacturing" | "Simulation" | "Electrical" | "Data Management" | "Additive / 3D Printing" | "Inspection / Scanning" | "Training & Services",
      "priority": "High" | "Medium" | "Low" | "",
      "timeframe": "<a real date or quarter ONLY if the notes state one, otherwise an empty string>"
    }
  ]
}

Category guidance (pick the closest single fit per issue):
- Design: SOLIDWORKS CAD, DriveWorks design automation, large assemblies, surfacing, CAD interoperability.
- Manufacturing: CAMWorks, SOLIDWORKS CAM, 5-axis, mill-turn, feature recognition, shop-floor programming.
- Simulation: SOLIDWORKS Simulation, structural, thermal, fatigue, FEA, code compliance.
- Electrical: SOLIDWORKS Electrical schematic and 3D, control panel design.
- Data Management: SOLIDWORKS PDM, 3DEXPERIENCE Works, revision control, traceability, change management.
- Additive / 3D Printing: Markforged, HP MJF, fixtures, prototyping, low-volume parts.
- Inspection / Scanning: Artec 3D scanners, reverse engineering, first article inspection.
- Training & Services: implementation, configuration, mentoring, custom training, migrations.

Rules:
- One issue per distinct business problem in the notes. 3 to 8 rows is typical.
- Only include issues the rep documented. Do not invent pains, products, or outcomes.
- Pick the SINGLE best category. If an issue spans two, pick the dominant one.
- priority is your SUGGESTED read, which the customer can change. If you have no basis, use "".
- timeframe: leave it EMPTY unless the notes contain a real date or deadline the customer stated. NEVER invent a date or timeline. The customer sets this.
- No statistics, no percentages, no dollar figures, no fabricated numbers anywhere. Qualitative only.
- No named customers. No em dashes. Use commas or periods.`;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface ParsedLou {
  coverLine: string;
  issues: LouIssue[];
}

function parseLou(raw: string): ParsedLou | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    const p = JSON.parse(raw.slice(start, end + 1));
    if (!p || !Array.isArray(p.issues)) return null;
    const issues: LouIssue[] = p.issues
      .filter(
        (x: unknown) =>
          x &&
          typeof (x as { businessIssue?: unknown }).businessIssue === "string" &&
          typeof (x as { recommendedResponse?: unknown }).recommendedResponse === "string"
      )
      .map((x: Record<string, unknown>): LouIssue => ({
        id: uid(),
        businessIssue: String(x.businessIssue ?? "").trim(),
        recommendedResponse: String(x.recommendedResponse ?? "").trim(),
        category: CATEGORY_OPTIONS.includes(x.category as string)
          ? (x.category as string)
          : "Manufacturing",
        priority: (PRIORITY_OPTIONS as string[]).includes(x.priority as string)
          ? (x.priority as Priority)
          : "",
        timeframe: String(x.timeframe ?? "").trim(),
        notes: "",
      }));
    return { coverLine: String(p.coverLine ?? "").trim(), issues };
  } catch {
    return null;
  }
}

const slug = (s: string) =>
  (s || "letter-of-understanding").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();

export function LouBuilder({ tone, methodology, company }: Props) {
  const [mode, setMode] = React.useState<"notes" | "table">("notes");
  const [accountName, setAccountName] = React.useState(company?.company ?? "");
  const [context, setContext] = React.useState<UniversalContext>(emptyContext);
  const [coverLine, setCoverLine] = React.useState("");
  const [issues, setIssues] = React.useState<LouIssue[]>([]);
  const [removed, setRemoved] = React.useState(0);
  const [streaming, setStreaming] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (company?.company) setAccountName(company.company);
  }, [company?.company]);

  const onGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasContext(context) || streaming) return;
    setError(null);
    setStreaming(true);

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
      const userMessage = [prefix, composeContextMessage(context)].filter(Boolean).join("\n\n");

      const res = await fetch("/api/assist", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: "LOU",
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
      const parsed = parseLou(buffer);
      if (!parsed) {
        throw new Error("Could not parse model response. Try regenerating.");
      }
      // Validate every prose field against the notes; strip invented numbers.
      const allowed = extractNumbers(context.notes, context.fetchedText ?? "");
      let removedCount = 0;
      const clean = (s: string) => {
        const r = validateProse(s, allowed);
        removedCount += r.flags.filter((f) => f.reason === "unsourced-number").length;
        return r.clean;
      };
      setCoverLine(clean(parsed.coverLine));
      setIssues(
        parsed.issues.map((it) => ({
          ...it,
          businessIssue: clean(it.businessIssue),
          recommendedResponse: clean(it.recommendedResponse),
        }))
      );
      setRemoved(removedCount);
      setMode("table");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      const msg = e?.message || "Generate failed";
      setError(
        msg.includes("ANTHROPIC_API_KEY")
          ? "Set ANTHROPIC_API_KEY in your .env.local to enable the Letter of Understanding."
          : msg
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const addIssue = () =>
    setIssues((rows) => [
      ...rows,
      {
        id: uid(),
        businessIssue: "",
        recommendedResponse: "",
        category: "Manufacturing",
        priority: "",
        timeframe: "",
        notes: "",
      },
    ]);
  const updateIssue = (id: string, patch: Partial<LouIssue>) =>
    setIssues((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const deleteIssue = (id: string) => setIssues((rows) => rows.filter((r) => r.id !== id));

  const exportXlsx = async () => {
    if (exporting || issues.length === 0) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/lou-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: accountName || "the account",
          coverLine,
          categories: CATEGORY_OPTIONS,
          issues: issues.map((it) => ({
            businessIssue: it.businessIssue,
            recommendedResponse: it.recommendedResponse,
            category: it.category,
            priority: it.priority,
            timeframe: it.timeframe,
            notes: it.notes,
          })),
        }),
      });
      if (!res.ok) {
        throw new Error((await res.text().catch(() => "")) || `Export failed: ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug(accountName)}-letter-of-understanding.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // --- Notes mode -----------------------------------------------------------
  if (mode === "notes") {
    return (
      <div className="flex flex-col gap-5">
        <BuilderHeader
          title="Letter of Understanding"
          subtitle="Paste discovery notes. The AI drafts the critical business issues and how we can help. You set priority and timeframe, then export the styled spreadsheet for the customer to confirm and complete."
        />
        <form onSubmit={onGenerate} className="flex flex-col gap-4">
          <Input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Account name (used on the letter)"
          />
          <UniversalContextInput
            context={context}
            onChange={setContext}
            hideUrl
            notesLabel="Discovery notes"
            notesPlaceholder="Paste meeting notes, call transcript, or key discussion points. Their pains, the current tools, the scope discussed, and any agreed next steps..."
          />
          <div className="flex items-center gap-2">
            {streaming ? (
              <Button type="button" variant="secondary" onClick={() => abortRef.current?.abort()}>
                <Loader2 className="h-4 w-4 animate-spin" />
                Stop
              </Button>
            ) : (
              <Button type="submit" disabled={!hasContext(context)}>
                <Sparkles className="h-4 w-4" />
                Draft Letter of Understanding
              </Button>
            )}
            {issues.length > 0 && !streaming && (
              <Button type="button" variant="ghost" onClick={() => setMode("table")}>
                Back to letter
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
      </div>
    );
  }

  // --- Table mode -----------------------------------------------------------
  return (
    <div className="flex flex-col gap-5">
      <BuilderHeader
        title="Letter of Understanding"
        subtitle={`Drafted for ${accountName || "the account"}. Edit any row, then export the styled spreadsheet to send to the customer.`}
      />

      {coverLine && (
        <Textarea
          value={coverLine}
          onChange={(e) => setCoverLine(e.target.value)}
          className="min-h-[56px] text-sm"
          aria-label="Cover line"
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setMode("notes")}>
            <FileEdit className="h-3.5 w-3.5" />
            Edit Notes
          </Button>
          <Button variant="secondary" onClick={addIssue}>
            <Plus className="h-3.5 w-3.5" />
            Add Issue
          </Button>
        </div>
        <Button onClick={exportXlsx} disabled={issues.length === 0 || exporting}>
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Export .xlsx
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2/60 border-b border-border text-left">
                <th className="font-semibold text-text-secondary px-3 py-3 w-[26%]">
                  Critical Business Issue
                </th>
                <th className="font-semibold text-text-secondary px-3 py-3 w-[28%]">
                  Can we help? If so, how?
                </th>
                <th className="font-semibold text-text-secondary px-3 py-3 w-[13%]">Category</th>
                <th className="font-semibold text-text-secondary px-3 py-3 w-[10%]">Priority</th>
                <th className="font-semibold text-text-secondary px-3 py-3 w-[10%]">Timeframe</th>
                <th className="font-semibold text-text-secondary px-3 py-3 w-[13%]">Notes</th>
                <th className="font-semibold text-text-secondary px-2 py-3 w-[4%]" />
              </tr>
            </thead>
            <tbody>
              {issues.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-3 py-2.5">
                    <Textarea
                      value={row.businessIssue}
                      onChange={(e) => updateIssue(row.id, { businessIssue: e.target.value })}
                      className="min-h-[72px] text-sm"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Textarea
                      value={row.recommendedResponse}
                      onChange={(e) => updateIssue(row.id, { recommendedResponse: e.target.value })}
                      className="min-h-[72px] text-sm"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Select
                      value={row.category}
                      onChange={(e) => updateIssue(row.id, { category: e.target.value })}
                      className="text-xs h-9"
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2.5">
                    <Select
                      value={row.priority}
                      onChange={(e) => updateIssue(row.id, { priority: e.target.value as Priority })}
                      className="text-xs h-9"
                    >
                      {PRIORITY_OPTIONS.map((p) => (
                        <option key={p || "unset"} value={p}>
                          {p || "(suggest)"}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      value={row.timeframe}
                      onChange={(e) => updateIssue(row.id, { timeframe: e.target.value })}
                      placeholder="customer sets"
                      className="text-xs h-9"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      value={row.notes}
                      onChange={(e) => updateIssue(row.id, { notes: e.target.value })}
                      placeholder="customer adds"
                      className="text-xs h-9"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <button
                      type="button"
                      onClick={() => deleteIssue(row.id)}
                      className="p-1.5 rounded text-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                      aria-label="Delete issue"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {issues.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-text-muted py-10 text-sm">
                    No issues yet. Click Add Issue or Edit Notes to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs italic text-text-muted leading-relaxed">
        Issues are drawn from the notes only. Priority is a suggestion the customer confirms; Timeframe
        ships blank unless the notes stated a real one, never an invented date. The exported .xlsx is
        styled like a standard Letter of Understanding, with Priority and Timeframe as dropdowns the
        customer fills, and opens in Excel or Sheets.
        {removed > 0 && (
          <span> {removed} unverified figure{removed === 1 ? "" : "s"} were removed from the draft.</span>
        )}
      </p>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
