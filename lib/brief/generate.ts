// LLM containment for the grounded brief. The model is fed ONLY sourced facts
// (the starved digest, which already withholds draft-competitor specifics) and is
// instructed to paraphrase, never extrapolate. groundProse() then validates every
// returned string: it strips unsourced numbers and flags stat / named-customer
// shapes, so a fabricated claim cannot reach the brief. The validator cannot
// catch qualitative over-claim, which is why the prompt is strictly summary-only.

import type { CompanyGroup } from "@/lib/signal-grouping";
import type { ProductTypeId } from "@/types/product";
import { buildSignalDigest } from "@/components/dossier/brief";
import { BRAND } from "@/lib/brand";
import { validateProse } from "./validator";
import type { BriefProse, OutreachChannel } from "./assemble";

// Normalize the model's free-text channel to one of the three we render.
function normalizeChannel(c: unknown): OutreachChannel {
  const v = String(c ?? "").toLowerCase();
  if (v.includes("linkedin") || v === "in") return "linkedin";
  if (v.includes("call") || v.includes("phone")) return "call";
  return "email";
}

export const GROUNDED_SYSTEM_PROMPT = `You are a sales analyst summarizing public signal data for one prospect. You represent ${BRAND.reseller.name} (${BRAND.reseller.short}), whose real capabilities are: ${BRAND.reseller.supportLine}. Reply with ONLY a single JSON object, no prose, no markdown fences:

{
  "executiveSummary": "<2-3 sentences. Summarize ONLY what the signals show: their situation, why they are on the radar, the engineering or manufacturing pressure visible in the signals.>",
  "whyReseller": "<1-2 sentences on why ${BRAND.reseller.short} is a fit for THIS prospect, tying ${BRAND.reseller.short}'s real capabilities stated above to their specific signals and detected tools. No numbers.>",
  "painPoints": [ { "text": "<one pain point implied by a specific signal>", "discipline": "<cad|cam|simulation|electrical|design-automation|additive|mfg-services, optional>" } ],
  "talkingPoints": [ { "question": "<a sharp discovery question that frames a gap implied by a specific signal>", "answer": "<1-2 sentences connecting that question to one of our capabilities, grounded in the same signal>", "discipline": "<optional>" } ],
  "outreach": [ { "channel": "email | linkedin | call", "subject": "<a short subject for an email, or a one-line opener for a linkedin or call touch>", "body": "<2-4 sentences grounded in ONE specific signal and ONE capability, no greeting fluff>" } ]
}

Strict rules:
- SUMMARY ONLY. Paraphrase the provided signals. Do NOT extrapolate, infer beyond them, or add anything not present in the input.
- For whyReseller, use ONLY ${BRAND.reseller.short}'s real capabilities stated above. Do NOT invent other capabilities, certifications, numbers, or customers.
- No statistics, no percentages, no dollar figures, and no specific numbers unless that exact number appears in a provided signal. Use qualitative quantifiers ("multiple", "several", "junior through senior"), never counts.
- No named customers, no case studies, no competitive claims that are not in the provided "Recommended fit" block.
- outreach is a 4 to 5 step sequence that escalates across channels (start with email, then a linkedin touch, then a call, and so on). Each step references a specific signal and one capability, and varies the angle from the previous step.
- Attribute each observation to the specific signal that carries it. Do NOT assert an attribute holds across signals when only one signal shows it.
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
  whyReseller?: string;
  painPoints?: { text: string; discipline?: ProductTypeId }[];
  talkingPoints?: { question: string; answer: string; discipline?: ProductTypeId }[];
  outreach?: { channel?: string; subject: string; body: string }[];
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
  if (raw.whyReseller) {
    prose.whyReseller = clean(raw.whyReseller, "whyReseller");
  }
  if (raw.painPoints?.length) {
    prose.painPoints = raw.painPoints.map((p, i) => ({
      text: clean(p.text, `painPoints[${i}]`),
      discipline: p.discipline,
    }));
  }
  if (raw.talkingPoints?.length) {
    prose.talkingPoints = raw.talkingPoints.map((p, i) => ({
      question: clean(p.question, `talkingPoints[${i}].question`),
      answer: clean(p.answer ?? "", `talkingPoints[${i}].answer`),
      discipline: p.discipline,
    }));
  }
  if (raw.outreach?.length) {
    // Every touch runs through the same number-stripping pass: outreach copy is
    // exactly where a fabricated "30% faster" would slip in, so each subject and
    // body is validated like every other prose field before it reaches the
    // clipboard.
    prose.outreach = raw.outreach.map((t, i) => ({
      channel: normalizeChannel(t.channel),
      subject: clean(t.subject ?? "", `outreach[${i}].subject`),
      body: clean(t.body ?? "", `outreach[${i}].body`),
    }));
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
      whyReseller: typeof p.whyReseller === "string" ? p.whyReseller : undefined,
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
            .filter((x: unknown) => x && typeof (x as { question?: unknown }).question === "string")
            .map((x: { question: string; answer?: string; discipline?: ProductTypeId }) => ({
              question: x.question,
              answer: typeof x.answer === "string" ? x.answer : "",
              discipline: x.discipline,
            }))
        : undefined,
      outreach: Array.isArray(p.outreach)
        ? p.outreach
            .filter(
              (x: unknown) =>
                x &&
                (typeof (x as { subject?: unknown }).subject === "string" ||
                  typeof (x as { body?: unknown }).body === "string")
            )
            .map((x: { channel?: string; subject?: string; body?: string }) => ({
              channel: typeof x.channel === "string" ? x.channel : "email",
              subject: typeof x.subject === "string" ? x.subject : "",
              body: typeof x.body === "string" ? x.body : "",
            }))
        : undefined,
    };
  } catch {
    return null;
  }
}
