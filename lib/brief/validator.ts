// Post-parse validator: the backstop behind starve-the-prompt. The generation
// prompt is fed only sourced facts, but this still scans the model's prose and
// strips any number that is not in the sourced set, then flags stat-claim and
// named-customer shapes for review. A flagged brief fails the grounding test
// rather than shipping a fabricated "60% reduction" or "customers like X".

export interface ValidationFlag {
  span: string;
  reason: "unsourced-number" | "stat-claim" | "named-customer";
}

export interface ValidationResult {
  clean: string;
  flags: ValidationFlag[];
  ok: boolean;
}

// Numbers, including $amounts, percentages, x-multipliers, and magnitude suffixes.
const NUMBER_RE = /\$?\d[\d,]*(?:\.\d+)?\s?(?:%|x|million|billion|thousand|[mkb])?/gi;
// Claim verbs that turn a number into a proof stat.
const CLAIM_NEAR = /(reduc|increas|faster|slower|sav|cut|boost|improv|gain|fewer|less|more)/i;
// Best-effort named-customer shapes (starve-the-prompt is the primary guard).
const NAMED_CUSTOMER_RE =
  /\b(?:customers?\s+(?:like|such as|including)|companies?\s+like)\s+([A-Z][A-Za-z0-9&.\- ]+)/g;

function normNum(s: string): string {
  return s.toLowerCase().replace(/[\s$,]/g, "");
}

export function validateProse(
  text: string,
  allowedNumbers: readonly string[] = []
): ValidationResult {
  const allowed = new Set(allowedNumbers.map(normNum));
  const flags: ValidationFlag[] = [];

  const clean = text.replace(NUMBER_RE, (m: string, offset: number) => {
    const norm = normNum(m);
    if (allowed.has(norm)) {
      const ctx = text.slice(Math.max(0, offset - 20), offset + m.length + 20);
      if (CLAIM_NEAR.test(ctx)) flags.push({ span: m.trim(), reason: "stat-claim" });
      return m;
    }
    flags.push({ span: m.trim(), reason: "unsourced-number" });
    return "[unverified]";
  });

  for (const mm of text.matchAll(NAMED_CUSTOMER_RE)) {
    flags.push({ span: mm[1].trim(), reason: "named-customer" });
  }

  return { clean, flags, ok: flags.length === 0 };
}
