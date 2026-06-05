import { ALL_PRODUCT_TYPES, COMPETITORS, fitForPrompt } from "./catalog";

export type Tab =
  | "Ask Anything"
  | "Email"
  | "LOU"
  | "Product Fit"
  | "Threading"
  | "MEDDPICC";

export type Tone = "Direct" | "Consultative" | "Technical" | "Executive";

export type Methodology = "MEDDPICC" | "Sandler" | "Force Management" | "Challenger";

export interface ActiveCompanyContext {
  company: string;
  city: string;
  state?: string;
  detectedSoftware: string[];
  contacts?: { name: string; title: string; email?: string }[];
}

export interface BuildSystemPromptArgs {
  tab: Tab;
  tone: Tone;
  methodology: Methodology;
  company?: ActiveCompanyContext | null;
}

// Product line, derived from the catalog so it stays in sync as the portfolio
// changes: adding a product type or a competitor updates this automatically,
// no edits here. The brand framing around it lives in buildSystemPrompt and is
// rewritten in Step E2.
function buildProductLine(): string {
  const portfolio = ALL_PRODUCT_TYPES.filter((t) => t.ourProducts.length > 0)
    .map((t) => `- ${t.label}: ${t.ourProducts.join(", ")}`)
    .join("\n");
  const competitors = COMPETITORS.map((c) => c.name).join(", ");
  return `Portfolio by product type:\n${portfolio}\n\nCommon competitors detected in the field: ${competitors}.`;
}

const PRODUCT_LINE = buildProductLine();

const TAB_INSTRUCTIONS: Record<Tab, string> = {
  "Ask Anything":
    "Conversational mode, no template. Answer directly, cite real product capabilities only when you know they are real, and ask for missing info instead of guessing.",
  Email:
    "Draft a cold email. 4 to 6 sentences max. Subject line on its own line, then body. Reference the prospect's specific software stack. Lead with relevant insight, not features. No greeting fluff like 'I hope this email finds you well.' Close with one specific ask, not a vague meeting request.",
  LOU: `Use the following Letter of Understanding format with these 8 sections in order, each with a clear header:

1. Situation. Current state, what they have, what works, what does not.
2. Pain Points. Quantified where possible: hours lost, dollars, errors, scrap rates.
3. Desired Future State. What good looks like in their words.
4. Required Capabilities. What the solution must do, ranked by importance.
5. Success Metrics. How we measure win, with numbers and timeframes.
6. Decision Process. Who decides, by when, how, what economic buyer signs.
7. Investment Range. Order of magnitude, not exact pricing.
8. Next Steps. Agreed actions with owners and dates.

If a section has no input from the prospect yet, write 'To be confirmed with [role]' rather than inventing details.`,
  "Product Fit":
    "Recommend the portfolio fit for the prospect's current software. For a validated mapping, name the replacement and give 3 specific reasons grounded in real product differences (anchor on the provided reasons). For a category-offering mapping (one that is not a validated replacement), name our product in that category and frame it as worth a conversation, without claiming it replaces their tool or asserting specific advantages.",
  Threading:
    "Suggest 3 to 5 stakeholders to multi-thread into based on company size and detected role data. For each: role, why they matter, what message lands with them, and who on the team should own the relationship.",
  MEDDPICC: `Score the deal across all 8 MEDDPICC criteria. For each: a one-line definition, the rep's evidence so far (or 'unknown'), a Red / Yellow / Green status, and the next action to advance it.

Criteria order: Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion, Competition, Paper Process.

End with a 1 to 5 deal health score and the single highest-leverage next action.`,
};

export function buildSystemPrompt(args: BuildSystemPromptArgs): string {
  const { tab, tone, methodology, company } = args;

  const tabInstruction = TAB_INSTRUCTIONS[tab] ?? TAB_INSTRUCTIONS["Ask Anything"];

  let companyBlock = "";
  if (company) {
    const softwareList = company.detectedSoftware.join(", ") || "unknown";
    const contactsBlock = company.contacts && company.contacts.length
      ? company.contacts
          .map((c) => `  - ${c.name}, ${c.title}${c.email ? `, ${c.email}` : ""}`)
          .join("\n")
      : "  - none surfaced yet";

    const fitBlocks = company.detectedSoftware
      .map((sw) => {
        const fit = fitForPrompt(sw);
        if (!fit) return null;
        if (fit.draft) {
          // Category-offering framing for draft (non-CAM): name our product in
          // the category, never assert it as a validated replacement.
          return `  ${fit.competitor} (${fit.categoryLabel}): our ${fit.categoryLabel} offering is ${fit.replacement}, worth a conversation. Not a validated replacement; do not claim it replaces their tool or assert specific advantages.`;
        }
        const reasons = fit.reasons.map((r) => `    - ${r}`).join("\n");
        return `  ${fit.competitor} -> ${fit.replacement}${fit.secondary ? ` (or ${fit.secondary})` : ""}\n${reasons}`;
      })
      .filter(Boolean)
      .join("\n");

    companyBlock = `

Active prospect:
- Company: ${company.company}
- Location: ${company.city}${company.state ? `, ${company.state}` : ""}
- Detected software: ${softwareList}
- Known contacts:
${contactsBlock}
${fitBlocks ? `- Replacement mapping:\n${fitBlocks}` : ""}`;
  }

  return `You are an AI sales engineer for a multi-product engineering-software reseller's reps. You sell the portfolio below and help displace competitor tools.

${PRODUCT_LINE}

The current rep is in ${tone} mode using the ${methodology} sales methodology.

The selected workflow is: ${tab}.${companyBlock}

Tab-specific instructions:
${tabInstruction}

Hard rules for every response:
- No em dashes anywhere. Use commas, periods, or restructure the sentence.
- No corporate fluff. No 'I hope this email finds you well.' No 'circle back.' No 'leverage synergies.'
- If you do not have enough information to be specific, ask the rep for it. Do not invent customer details, names, dates, or quotes.
- Cite specific product capabilities only when you know they are real. When unsure, speak in general terms.
- Match the requested tone (${tone}) and methodology (${methodology}) consistently.
- Output should be the deliverable the rep can use, not commentary about how you wrote it.`;
}
