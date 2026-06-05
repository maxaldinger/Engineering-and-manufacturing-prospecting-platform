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

type Category = "Pain" | "Scope" | "Value" | "Next Step";
type Priority = "" | "High" | "Medium" | "Low";

const CATEGORY_OPTIONS: Category[] = ["Pain", "Scope", "Value", "Next Step"];
const PRIORITY_OPTIONS: Priority[] = ["", "High", "Medium", "Low"];

interface PlanItem {
  id: string;
  category: Category;
  item: string;
  priority: Priority; // suggested, the customer confirms or changes
  timeFrame: string; // blank unless the notes stated a real one; the customer sets it
  comments: string; // always blank from us, for the customer
}

const SYSTEM_PROMPT = `You are turning a sales rep's discovery notes into a MUTUAL ACTION PLAN that will be sent to the customer to complete. It captures what we understood; the customer then confirms priority, sets the time frame, and adds comments.

Reply with ONLY a single JSON object, no prose, no markdown fences:

{
  "coverLine": "<1 to 2 sentence cover line, factual: a mutual action plan drafted from the discovery conversation. No fluff.>",
  "items": [
    {
      "category": "Pain" | "Scope" | "Value" | "Next Step",
      "item": "<1 to 2 sentences: an understood pain, a piece of scope, a value or outcome they want, or an agreed next step, in their language, grounded in the notes.>",
      "priority": "High" | "Medium" | "Low" | "",
      "timeFrame": "<a real date or deadline ONLY if the notes state one, otherwise an empty string>"
    }
  ]
}

Rules:
- One item per distinct point in the notes: their pains, the scope discussed, the value or outcomes they care about, and any agreed next steps. 4 to 10 items is typical.
- Only include items the rep actually documented. Do not invent pains, scope, value, or steps.
- priority is your SUGGESTED read, which the customer can change. If you have no basis, use "".
- timeFrame: leave it EMPTY unless the notes contain a real date or deadline the customer stated. NEVER invent a date or timeline. The customer sets this.
- No statistics, no percentages, no dollar figures, no fabricated numbers. Qualitative only.
- No named customers. No em dashes. Use commas or periods.`;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface ParsedPlan {
  coverLine: string;
  items: PlanItem[];
}

function parsePlan(raw: string): ParsedPlan | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    const p = JSON.parse(raw.slice(start, end + 1));
    if (!p || !Array.isArray(p.items)) return null;
    const items: PlanItem[] = p.items
      .filter((x: unknown) => x && typeof (x as { item?: unknown }).item === "string")
      .map((x: Record<string, unknown>): PlanItem => ({
        id: uid(),
        category: (CATEGORY_OPTIONS as string[]).includes(x.category as string)
          ? (x.category as Category)
          : "Pain",
        item: String(x.item ?? "").trim(),
        priority: (PRIORITY_OPTIONS as string[]).includes(x.priority as string)
          ? (x.priority as Priority)
          : "",
        timeFrame: String(x.timeFrame ?? "").trim(),
        comments: "",
      }));
    return { coverLine: String(p.coverLine ?? "").trim(), items };
  } catch {
    return null;
  }
}

const slug = (s: string) => (s || "mutual-action-plan").replace(/[^a-z0-9]+/gi, "-").toLowerCase();

export function LouBuilder({ tone, methodology, company }: Props) {
  const [mode, setMode] = React.useState<"notes" | "plan">("notes");
  const [accountName, setAccountName] = React.useState(company?.company ?? "");
  const [context, setContext] = React.useState<UniversalContext>(emptyContext);
  const [coverLine, setCoverLine] = React.useState("");
  const [items, setItems] = React.useState<PlanItem[]>([]);
  const [removed, setRemoved] = React.useState(0);
  const [streaming, setStreaming] = React.useState(false);
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
      const parsed = parsePlan(buffer);
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
      setItems(parsed.items.map((it) => ({ ...it, item: clean(it.item) })));
      setRemoved(removedCount);
      setMode("plan");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      const msg = e?.message || "Generate failed";
      setError(
        msg.includes("ANTHROPIC_API_KEY")
          ? "Set ANTHROPIC_API_KEY in your .env.local to enable the action plan."
          : msg
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const addItem = () =>
    setItems((rows) => [
      ...rows,
      { id: uid(), category: "Next Step", item: "", priority: "", timeFrame: "", comments: "" },
    ]);
  const updateItem = (id: string, patch: Partial<PlanItem>) =>
    setItems((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const deleteItem = (id: string) => setItems((rows) => rows.filter((r) => r.id !== id));

  const exportXlsx = async () => {
    const XLSX = await import("xlsx");
    const account = accountName || "the account";
    const header = ["Category", "Understood Item", "Priority", "Time Frame", "Comments"];
    const aoa: string[][] = [
      [`Mutual Action Plan: ${account}`],
      [coverLine || `Mutual action plan for ${account}, drafted from our discovery conversation.`],
      ["Please confirm or adjust the Priority, set a Time Frame, and add your Comments for each item."],
      [],
      header,
      ...items.map((it) => [it.category, it.item, it.priority, it.timeFrame, it.comments]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 14 }, { wch: 64 }, { wch: 14 }, { wch: 24 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Action Plan");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(account)}-mutual-action-plan.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // --- Notes mode -----------------------------------------------------------
  if (mode === "notes") {
    return (
      <div className="flex flex-col gap-5">
        <BuilderHeader
          title="Mutual Action Plan"
          subtitle="Paste discovery notes. The AI drafts the understood pains, scope, value, and next steps. You and the customer set priority, time frame, and comments, then export an editable spreadsheet."
        />
        <form onSubmit={onGenerate} className="flex flex-col gap-4">
          <Input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Account name (used on the plan)"
          />
          <UniversalContextInput
            context={context}
            onChange={setContext}
            hideUrl
            notesLabel="Discovery notes"
            notesPlaceholder="Paste meeting notes, call transcript, or key discussion points. Pains, scope discussed, the outcomes they care about, and any agreed next steps..."
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
                Draft Action Plan
              </Button>
            )}
            {items.length > 0 && !streaming && (
              <Button type="button" variant="ghost" onClick={() => setMode("plan")}>
                Back to plan
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

  // --- Plan mode ------------------------------------------------------------
  return (
    <div className="flex flex-col gap-5">
      <BuilderHeader
        title="Mutual Action Plan"
        subtitle={`Drafted for ${accountName || "the account"}. Edit any item, then export an editable spreadsheet to send to the customer.`}
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
          <Button variant="secondary" onClick={addItem}>
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </Button>
        </div>
        <Button onClick={exportXlsx} disabled={items.length === 0}>
          <Download className="h-3.5 w-3.5" />
          Export .xlsx
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2/60 border-b border-border text-left">
                <th className="font-semibold text-text-secondary px-3 py-3 w-[12%]">Category</th>
                <th className="font-semibold text-text-secondary px-3 py-3 w-[40%]">Understood Item</th>
                <th className="font-semibold text-text-secondary px-3 py-3 w-[12%]">Priority</th>
                <th className="font-semibold text-text-secondary px-3 py-3 w-[16%]">Time Frame</th>
                <th className="font-semibold text-text-secondary px-3 py-3 w-[16%]">Comments</th>
                <th className="font-semibold text-text-secondary px-2 py-3 w-[4%]" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0 align-top">
                  <td className="px-3 py-2.5">
                    <Select
                      value={row.category}
                      onChange={(e) => updateItem(row.id, { category: e.target.value as Category })}
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
                    <Textarea
                      value={row.item}
                      onChange={(e) => updateItem(row.id, { item: e.target.value })}
                      className="min-h-[64px] text-sm"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Select
                      value={row.priority}
                      onChange={(e) => updateItem(row.id, { priority: e.target.value as Priority })}
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
                      value={row.timeFrame}
                      onChange={(e) => updateItem(row.id, { timeFrame: e.target.value })}
                      placeholder="customer sets"
                      className="text-xs h-9"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      value={row.comments}
                      onChange={(e) => updateItem(row.id, { comments: e.target.value })}
                      placeholder="customer adds"
                      className="text-xs h-9"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <button
                      type="button"
                      onClick={() => deleteItem(row.id)}
                      className="p-1.5 rounded text-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                      aria-label="Delete item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-text-muted py-10 text-sm">
                    No items yet. Click Add Item or Edit Notes to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs italic text-text-muted leading-relaxed">
        Items are drawn from the notes only. Priority is a suggestion the customer confirms; Time Frame
        ships blank unless the notes stated a real one, never an invented date. The exported .xlsx opens
        and edits in Excel or Sheets so the customer can complete it.
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
