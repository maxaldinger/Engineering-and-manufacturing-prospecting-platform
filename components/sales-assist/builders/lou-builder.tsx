"use client";

import * as React from "react";
import {
  Sparkles,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
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
import { cn } from "@/lib/utils";
import type { Tone, Methodology, ActiveCompanyContext } from "@/lib/hrs-context";

interface Props {
  tone: Tone;
  methodology: Methodology;
  company: ActiveCompanyContext | null;
}

type Priority = "High" | "Medium" | "Low";

interface LouIssue {
  id: string;
  businessIssue: string;
  hrsResponse: string;
  category: string;
  priority: Priority;
  timeframe: string;
}

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

const LOU_SYSTEM_PROMPT = `You are converting a sales rep's discovery notes into a Letter of Understanding for Hawk Ridge Systems.

Reply with ONLY a single JSON object, no prose, no markdown fences. Use this exact shape:

{
  "issues": [
    {
      "businessIssue": "1-3 sentence description of the prospect's pain or business problem, in their language. Quantify when the notes do.",
      "hrsResponse": "3-5 sentence response that names the specific HRS or SOLIDWORKS product, the capability that addresses the issue, and the measurable benefit. Concrete, no fluff.",
      "category": "Design" | "Manufacturing" | "Simulation" | "Electrical" | "Data Management" | "Additive / 3D Printing" | "Inspection / Scanning" | "Training & Services",
      "priority": "High" | "Medium" | "Low",
      "timeframe": "When the prospect needs this resolved or the proposed phase / pilot timeline. Use absolute dates or quarters."
    }
  ]
}

Category guidance (pick the closest fit for each issue):
- Design: SOLIDWORKS CAD, DriveWorks design automation, large assemblies, weldments, surfacing, CAD interoperability.
- Manufacturing: CAMWorks, SOLIDWORKS CAM, 5-axis, mill-turn, Swiss, feature recognition, tolerance-based machining, shop floor programming.
- Simulation: SOLIDWORKS Simulation Standard, Professional, Premium, structural, thermal, fatigue, FEA, ASME / pressure vessel code compliance.
- Electrical: SOLIDWORKS Electrical schematic and 3D, control panel design, motor control centers, switchgear.
- Data Management: SOLIDWORKS PDM Professional, 3DEXPERIENCE Works, revision control, AS9100 / 21 CFR Part 11 traceability, change management.
- Additive / 3D Printing: Markforged, HP MJF, fixtures, prototyping, low-volume production parts.
- Inspection / Scanning: Artec 3D scanners, reverse engineering, first article inspection, dimensional QC.
- Training & Services: implementation, configuration, mentoring, custom training, on-site support, migrations.

Rules:
- Generate one row per distinct business issue found in the notes. 3 to 8 rows is typical.
- Only include issues that the rep actually documented. Do not invent.
- Pick the SINGLE best category from the list above. If an issue spans two, pick the dominant one.
- No em dashes anywhere. Use commas or periods.
- If the notes are too thin to support a row, omit that row rather than guessing.`;

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseIssues(raw: string): LouIssue[] | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!parsed?.issues || !Array.isArray(parsed.issues)) return null;
    return parsed.issues
      .filter((p: any) => p?.businessIssue && p?.hrsResponse)
      .map(
        (p: any): LouIssue => ({
          id: uid(),
          businessIssue: String(p.businessIssue ?? "").trim(),
          hrsResponse: String(p.hrsResponse ?? "").trim(),
          category: String(p.category ?? "Manufacturing").trim(),
          priority: ["High", "Medium", "Low"].includes(p.priority)
            ? (p.priority as Priority)
            : "Medium",
          timeframe: String(p.timeframe ?? "").trim(),
        })
      );
  } catch {
    return null;
  }
}

const PRIORITY_STYLES: Record<Priority, string> = {
  High: "bg-red-50 text-red-700 border-red-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border",
        PRIORITY_STYLES[priority]
      )}
    >
      {priority}
    </span>
  );
}

function csvEscape(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadCsv(rows: LouIssue[], accountName: string) {
  const header = ["Critical Business Issue", "HRS Response", "Category", "Priority", "Timeframe"];
  const lines = [header.join(",")].concat(
    rows.map((r) =>
      [r.businessIssue, r.hrsResponse, r.category, r.priority, r.timeframe]
        .map(csvEscape)
        .join(",")
    )
  );
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (accountName || "lou").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  a.href = url;
  a.download = `${safeName}-lou.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function LouBuilder({ tone, methodology, company }: Props) {
  const [mode, setMode] = React.useState<"notes" | "table">("notes");
  const [context, setContext] = React.useState<UniversalContext>(emptyContext);
  const [issues, setIssues] = React.useState<LouIssue[]>([]);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const accountName = company?.company ?? "";

  const onGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasContext(context) || streaming) return;

    setError(null);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const userPrefix = [
        accountName && `Account: ${accountName}`,
        company?.detectedSoftware?.length
          ? `Detected software: ${company.detectedSoftware.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      const userMessage = [
        userPrefix,
        composeContextMessage(context),
      ]
        .filter(Boolean)
        .join("\n\n");

      const res = await fetch("/api/assist", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tab: "LOU",
          tone,
          methodology,
          company,
          systemPromptOverride: LOU_SYSTEM_PROMPT,
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

      const parsed = parseIssues(buffer);
      if (!parsed) {
        throw new Error("Could not parse model response. Try regenerating.");
      }
      setIssues(parsed);
      setMode("table");
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      const msg = e?.message || "Generate failed";
      setError(
        msg.includes("ANTHROPIC_API_KEY")
          ? "Set ANTHROPIC_API_KEY in your .env.local to enable LOU generation."
          : msg
      );
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const addBlank = () => {
    const blank: LouIssue = {
      id: uid(),
      businessIssue: "",
      hrsResponse: "",
      category: "Manufacturing",
      priority: "Medium",
      timeframe: "",
    };
    setIssues((rows) => [...rows, blank]);
    setEditingId(blank.id);
    setMode("table");
  };

  const updateIssue = (id: string, patch: Partial<LouIssue>) => {
    setIssues((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const deleteIssue = (id: string) => {
    setIssues((rows) => rows.filter((r) => r.id !== id));
    if (editingId === id) setEditingId(null);
  };

  if (mode === "notes" || (mode === "table" && issues.length === 0 && !streaming)) {
    return (
      <div className="flex flex-col gap-5">
        <BuilderHeader
          title="Letter of Understanding Builder"
          subtitle="Paste meeting notes or a prospect URL. The AI returns a structured LOU table you can edit and export."
        />
        <form onSubmit={onGenerate} className="flex flex-col gap-4">
          <UniversalContextInput
            context={context}
            onChange={setContext}
            notesLabel="Discovery notes"
            notesPlaceholder="Paste meeting notes, call transcript, or key discussion points..."
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
                Generate LOU
              </Button>
            )}
            {issues.length > 0 && !streaming && (
              <Button type="button" variant="ghost" onClick={() => setMode("table")}>
                Back to table
              </Button>
            )}
          </div>
        </form>
        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BuilderHeader
        title="Letter of Understanding Builder"
        subtitle="Paste meeting notes or a transcript to generate a structured LOU table you can edit and export."
      />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setMode("notes")}>
            <FileEdit className="h-3.5 w-3.5" />
            Edit Notes
          </Button>
          <Button variant="secondary" onClick={addBlank}>
            <Plus className="h-3.5 w-3.5" />
            Add Issue
          </Button>
        </div>
        <Button variant="secondary" onClick={() => downloadCsv(issues, accountName)}>
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2/60 border-b border-border">
                <th className="text-left font-semibold text-text-secondary px-4 py-3 w-[28%]">
                  Critical Business Issue
                </th>
                <th className="text-left font-semibold text-text-secondary px-4 py-3 w-[36%]">
                  Can we help? If so, how?
                </th>
                <th className="text-left font-semibold text-text-secondary px-4 py-3 w-[12%]">
                  Category
                </th>
                <th className="text-left font-semibold text-text-secondary px-4 py-3 w-[8%]">
                  Priority
                </th>
                <th className="text-left font-semibold text-text-secondary px-4 py-3 w-[10%]">
                  Timeframe
                </th>
                <th className="text-left font-semibold text-text-secondary px-4 py-3 w-[6%]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {issues.map((row) => {
                const editing = editingId === row.id;
                return (
                  <tr key={row.id} className="border-b border-border last:border-b-0 align-top">
                    <td className="px-4 py-3">
                      {editing ? (
                        <Textarea
                          value={row.businessIssue}
                          onChange={(e) => updateIssue(row.id, { businessIssue: e.target.value })}
                          className="min-h-[100px] text-sm"
                        />
                      ) : (
                        <p className="leading-relaxed text-text-primary whitespace-pre-wrap">
                          {row.businessIssue || (
                            <span className="text-text-muted italic">Empty</span>
                          )}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editing ? (
                        <Textarea
                          value={row.hrsResponse}
                          onChange={(e) => updateIssue(row.id, { hrsResponse: e.target.value })}
                          className="min-h-[100px] text-sm"
                        />
                      ) : (
                        <p className="leading-relaxed text-text-primary whitespace-pre-wrap">
                          {row.hrsResponse || (
                            <span className="text-text-muted italic">Empty</span>
                          )}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editing ? (
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
                      ) : (
                        <span className="text-xs text-text-secondary">{row.category}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editing ? (
                        <Select
                          value={row.priority}
                          onChange={(e) => updateIssue(row.id, { priority: e.target.value as Priority })}
                          className="text-xs h-9"
                        >
                          <option>High</option>
                          <option>Medium</option>
                          <option>Low</option>
                        </Select>
                      ) : (
                        <PriorityBadge priority={row.priority} />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editing ? (
                        <Input
                          value={row.timeframe}
                          onChange={(e) => updateIssue(row.id, { timeframe: e.target.value })}
                          className="text-xs h-9"
                        />
                      ) : (
                        <span className="text-xs text-text-secondary whitespace-pre-wrap">
                          {row.timeframe || "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {editing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600"
                              aria-label="Save row"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1.5 rounded hover:bg-surface-2 text-text-muted"
                              aria-label="Cancel edit"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingId(row.id)}
                              className="p-1.5 rounded hover:bg-surface-2 text-text-secondary hover:text-primary"
                              aria-label="Edit row"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteIssue(row.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-text-muted hover:text-red-600"
                              aria-label="Delete row"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {issues.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-text-muted py-10 text-sm">
                    No issues yet. Click Add Issue or Edit Notes to start.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
