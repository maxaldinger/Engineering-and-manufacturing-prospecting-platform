// LLM containment for the grounded brief. The model is fed ONLY sourced facts
// (the starved digest, which already withholds draft-competitor specifics) and is
// instructed to paraphrase, never extrapolate. groundProse() then validates every
// returned string: it strips unsourced numbers and flags stat / named-customer
// shapes, so a fabricated claim cannot reach the brief. The validator cannot
// catch qualitative over-claim, which is why the prompt is strictly summary-only.

import type { CompanyGroup } from "@/lib/signal-grouping";
import type { ProductTypeId } from "@/types/product";
import { buildSignalDigest } from "@/components/dossier/brief";
import { validateProse } from "./validator";
import type { BriefProse } from "./assemble";

export const GROUNDED_SYSTEM_PROMPT = `You are a sales analyst summarizing public signal data for one prospect. Reply with ONLY a single JSON object, no prose, no markdown fences:

{
  "executiveSummary": "<2-3 sentences. Summarize ONLY what the signals show: their situation, why they are on the radar, the engineering or manufacturing pressure visible in the signals.>",
  "painPoints": [ { "text": "<one pain point implied by a specific signal>", "discipline": "<cad|cam|simulation|electrical|design-automation|additive|mfg-services, optional>" } ],
  "talkingPoints": [ { "text": "<a specific opener that references a signal>", "discipline": "<optional>" } ],
  "outreach": { "subject": "<a 6-10 word cold-email subject line>", "body": "<a 3-5 sentence cold email referencing one specific signal and one product capability, no greeting fluff>" }
}

Strict rules:
- SUMMARY ONLY. Paraphrase the provided signals. Do NOT extrapolate, infer beyond them, or add anything not present in the input.
- No statistics, no percentages, no dollar figures, and no specific numbers unless that exact number appears in a provided signal.
- No named customers, no case studies, no competitive claims that are not in the provided "Recommended fit" block.
- If the signals are thin, return fewer items. Never pad with invention.
- No em dashes. Use commas or restructure.`;

// The starved prompt: the existing digest (structural draft guard included) plus
// the summary-only system prompt. Returned as a pair the caller sends to the model.
export function buildStarvedPrompt(group: CompanyGroup): {
  system: string;
  user: string;
} {
  return { system: GROUNDED_SYSTEM_PROMPT, user: buildSignalDigest(group) };
}

// Numbers that appear in the provided signals, so the validator allows them
// through while stripping anything the model invented.
const NUM_RE = /\$?\d[\d,]*(?:\.\d+)?\s?(?:%|x|million|billion|thousand|[mkb])?/gi;
export function allowedNumbersFromGroup(group: CompanyGroup): string[] {
  const out = new Set<string>();
  for (const s of group.signals) {
    for (const m of `${s.title} ${s.description}`.matchAll(NUM_RE)) {
      const t = m[0].trim();
      if (/\d/.test(t)) out.add(t);
    }
  }
  return [...out];
}

export interface RawProse {
  executiveSummary?: string;
  painPoints?: { text: string; discipline?: ProductTypeId }[];
  talkingPoints?: { text: string; discipline?: ProductTypeId }[];
  outreach?: { subject: string; body: string };
}

export interface ProseFlag {
  field: string;
  span: string;
  reason: string;
}

export interface GroundedProseResult {
  prose: BriefProse;
  flags: ProseFlag[];
}

// Validate and clean the model's prose. Flags are surfaced; the brief's grounding
// test fails on any flag, so a fabricated stat never ships silently.
export function groundProse(raw: RawProse, group: CompanyGroup): GroundedProseResult {
  const allowed = allowedNumbersFromGroup(group);
  const flags: ProseFlag[] = [];
  const clean = (text: string, field: string): string => {
    const r = validateProse(text, allowed);
    for (const f of r.flags) flags.push({ field, span: f.span, reason: f.reason });
    return r.clean;
  };

  const prose: BriefProse = {};
  if (raw.executiveSummary) {
    prose.executiveSummary = clean(raw.executiveSummary, "executiveSummary");
  }
  if (raw.painPoints?.length) {
    prose.painPoints = raw.painPoints.map((p, i) => ({
      text: clean(p.text, `painPoints[${i}]`),
      discipline: p.discipline,
    }));
  }
  if (raw.talkingPoints?.length) {
    prose.talkingPoints = raw.talkingPoints.map((p, i) => ({
      text: clean(p.text, `talkingPoints[${i}]`),
      discipline: p.discipline,
    }));
  }
  if (raw.outreach && (raw.outreach.subject || raw.outreach.body)) {
    // Outreach copy runs through the same number-stripping pass: a cold email is
    // exactly where a fabricated "30% faster" would slip in, so subject and body
    // are validated like every other prose field before they reach the clipboard.
    prose.outreach = {
      subject: clean(raw.outreach.subject ?? "", "outreach.subject"),
      body: clean(raw.outreach.body ?? "", "outreach.body"),
    };
  }
  return { prose, flags };
}

// Parse the model's raw JSON response into RawProse. Returns null on unparseable
// output (the caller then renders the brief with prose pending, never invented).
export function parseRawProse(raw: string): RawProse | null {
  if (!raw) return null;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    const p = JSON.parse(raw.slice(start, end + 1));
    if (!p || typeof p !== "object") return null;
    return {
      executiveSummary:
        typeof p.executiveSummary === "string" ? p.executiveSummary : undefined,
      painPoints: Array.isArray(p.painPoints)
        ? p.painPoints
            .filter((x: unknown) => x && typeof (x as { text?: unknown }).text === "string")
            .map((x: { text: string; discipline?: ProductTypeId }) => ({
              text: x.text,
              discipline: x.discipline,
            }))
        : undefined,
      talkingPoints: Array.isArray(p.talkingPoints)
        ? p.talkingPoints
            .filter((x: unknown) => x && typeof (x as { text?: unknown }).text === "string")
            .map((x: { text: string; discipline?: ProductTypeId }) => ({
              text: x.text,
              discipline: x.discipline,
            }))
        : undefined,
      outreach:
        p.outreach &&
        typeof p.outreach === "object" &&
        (typeof p.outreach.subject === "string" || typeof p.outreach.body === "string")
          ? {
              subject: typeof p.outreach.subject === "string" ? p.outreach.subject : "",
              body: typeof p.outreach.body === "string" ? p.outreach.body : "",
            }
          : undefined,
    };
  } catch {
    return null;
  }
}
