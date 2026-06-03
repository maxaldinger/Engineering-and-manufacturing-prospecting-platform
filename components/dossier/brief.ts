// Pure prompt-building for the company dossier brief. Extracted from the
// component so it is importable without React — by the deterministic test that
// locks the structural draft guard, and by the dev script that runs a live
// generation. No "use client", no React imports.
import type { CompanyGroup } from "@/lib/signal-grouping";
import type { Signal } from "@/types/signal";
import { fitForPrompt } from "@/lib/catalog";

export interface AiBrief {
  score: number;
  scoreLabel: string;
  whyFit: string;
  overview: string;
  portfolioFit: string;
  manufacturingChallenge: string;
  outreachSubject: string;
  outreachBody: string;
  talkingPoints: string[];
}

export const SYSTEM_PROMPT = `You are a sales intelligence analyst for a multi-product engineering-software reseller whose portfolio spans CAD, CAM, Simulation, Electrical, Design Automation, and Additive, and which displaces competitor tools in each category.

You will receive structured signal data scraped from public sources for one prospect company. It may include a "Recommended fit" block mapping the prospect's detected competitor tools to the reseller's replacement products. Reply with ONLY a single JSON object. No prose, no markdown fences. Use this exact shape:

{
  "score": <integer 0-100. Higher = better fit. Base on number of signals, recency, and competitor/product detection.>,
  "scoreLabel": "PRIME TARGET" | "WARM TARGET" | "COLD TARGET",
  "whyFit": "<1-2 sentence pitch on why the recommended replacement products fit this prospect, anchored on their detected stack and pressures.>",
  "overview": "<2-3 sentence company summary describing their situation, why they are on the radar, and their engineering or manufacturing pressures based on the actual signals.>",
  "portfolioFit": "<3-4 sentences on how the recommended products solve their problem. Name the products. Follow the fit rules below.>",
  "manufacturingChallenge": "<3-4 sentences on the technical and business problem they are facing. Reference real signals (contract programs, hiring patterns, news mentions).>",
  "outreachSubject": "<short cold email subject line, 6-10 words>",
  "outreachBody": "<3-5 sentence cold email referencing one specific signal and one product capability. No greeting fluff. No em dashes.>",
  "talkingPoints": ["<bullet 1>", "<bullet 2>", "<bullet 3>", "<bullet 4>", "<bullet 5>"]
}

Fit rules (critical):
- The "Recommended fit" block is the source of truth for product recommendations. Do not introduce products or competitive claims that are not in it or in the signals.
- When a mapping lists specific reasons, you MAY assert those reasons.
- A "category offering" entry (one flagged as NOT a validated replacement) names our product in that category. Present it as our offering in that category, worth a conversation. Do NOT claim it replaces their current tool, and do NOT assert specific advantages, feature comparisons, or differentiators, or invent any. Keep it general.

Hard rules:
- Reference only the signals in the input data. Do not invent contracts, dollar amounts, names, dates, or program names.
- If the signals are thin, write shorter sections rather than padding with invention.
- talkingPoints must be specific to this company, not generic platitudes. Each point should reference a signal.
- No em dashes anywhere. Use commas or restructure.
- scoreLabel: PRIME TARGET if score >= 75, WARM TARGET if 50-74, COLD TARGET below 50.`;

export function buildSignalDigest(group: CompanyGroup): string {
  const lines: string[] = [];
  lines.push(`Prospect: ${group.company}`);
  lines.push(`Region: ${group.city || group.state}, ${group.state}`);
  lines.push(`Industry: ${group.industry}`);
  if (group.detectedSoftware.length) {
    lines.push(`Detected software in public text: ${group.detectedSoftware.join(", ")}`);
  } else {
    lines.push("No competitor or portfolio software detected in public text.");
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
        .filter((x) => x.name)
        .map((x) => x.name)
        .join(", ");
      lines.push(
        `- ${s.title} | ${s.postedAgo} | ${s.sourceLabel}${sw ? ` | software in text: ${sw}` : ""}\n  ${s.description.slice(0, 220)}`
      );
    }
  }

  // Structural draft guard: draft competitors contribute ONLY the neutral
  // category-offering framing (fitForPrompt withholds their unvalidated
  // reasons), so no fabricated competitive specific is ever in the prompt.
  const fits = group.detectedSoftware
    .map((name) => fitForPrompt(name))
    .filter((f): f is NonNullable<typeof f> => f !== null);
  if (fits.length) {
    lines.push("\nRecommended fit (per detected competitor):");
    for (const f of fits) {
      if (f.draft) {
        // Category-offering framing: NOT "replacement for X" (unvalidated for
        // non-CAM types). Name our product in the category, frame as a
        // conversation, never claim it replaces their tool.
        lines.push(
          `- Detected ${f.competitor} (${f.categoryLabel}). Our ${f.categoryLabel} offering is ${f.replacement}. Present it as our offering in this category that is worth a conversation, NOT a validated replacement for ${f.competitor}. Do not claim it replaces their tool, and do not assert specific advantages or comparisons.`
        );
      } else {
        const map = `${f.competitor} -> ${f.replacement}${f.secondary ? ` (or ${f.secondary})` : ""}`;
        const reasons = f.reasons.map((r) => `    - ${r}`).join("\n");
        lines.push(`- ${map}:\n${reasons}`);
      }
    }
  }

  return lines.join("\n");
}

export function parseBrief(raw: string): AiBrief | null {
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
      whyFit: String(parsed.whyFit ?? ""),
      overview: String(parsed.overview ?? ""),
      portfolioFit: String(parsed.portfolioFit ?? ""),
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
