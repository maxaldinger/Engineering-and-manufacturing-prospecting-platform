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
// A single-letter magnitude suffix (m/k/b) must be ATTACHED to the digits ("14.6M",
// "30k"); only the spelled magnitudes and %/x may follow a space. This stops the
// suffix from swallowing the first letter of an adjacent word ("30 minutes" ->
// "30 m", "AS9100 machine" -> "9100 m").
const NUMBER_RE = /\$?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|x|million|billion|thousand)|[mkb])?/gi;
// Spelled-out numbers, which evade the digit regex ("sixty percent", "three-fold",
// "two audits", "two hundred"). Same strip-and-flag path as digits.
const WORD =
  "zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion";
const WORD_NUMBER_RE = new RegExp(
  `\\b(?:${WORD})(?:[\\s-]+(?:${WORD}))*(?:[\\s-]+(?:percent|fold|times))?\\b`,
  "gi"
);
// "one" is usually the English article/determiner ("one more thought", "one
// challenge"), not a stat, so a BARE "one" is left alone. It STAYS masked inside a
// number or stat shape: a fraction ("one third"), a unit ("one-minute"), a
// percent/fold/times suffix or magnitude (already captured as a multi-word span by
// WORD_NUMBER_RE), or adjacent to a number ("one 5", "$5 one"). Every other spelled
// number is unaffected. These two test the text immediately around a bare "one".
const ONE_STAT_AFTER =
  /^[\s-]*(?:thirds?|half|halves|quarters?|fourths?|fifths?|sixths?|sevenths?|eighths?|ninths?|tenths?|dozen|hundred|thousand|million|billion|percent|fold|times|minutes?|hours?|seconds?|days?|weeks?|months?|years?|dollars?|cents?|points?|degrees?|miles?|inches|inch|feet|foot|pounds?|x|%|\$|\d|\[unverified\])/i;
const ONE_STAT_BEFORE = /(?:\d|\$|%|\[unverified\])\s*$/i;
// Claim verbs that turn a number into a proof stat.
const CLAIM_NEAR = /(reduc|increas|faster|slower|sav|cut|boost|improv|gain|fewer|less|more|yield)/i;
// Best-effort named-customer shapes (starve-the-prompt is the primary guard).
const NAMED_CUSTOMER_RE =
  /\b(?:customers?\s+(?:like|such as|including)|companies?\s+like)\s+([A-Z][A-Za-z0-9&.\- ]+)/g;

function normNum(s: string): string {
  return s.toLowerCase().replace(/[\s$,]/g, "");
}

// Numbers that appear in source text (notes, a fetched page), so validateProse can
// keep a figure the prospect actually stated while stripping anything the model
// invents. Mirrors the brief's allowed-number extraction, for the sales builders.
export function extractNumbers(...texts: string[]): string[] {
  const re = /\$?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|x|million|billion|thousand)|[mkb])?/gi;
  const out = new Set<string>();
  for (const t of texts) {
    for (const m of (t ?? "").matchAll(re)) {
      const v = m[0].trim();
      if (/\d/.test(v)) out.add(v);
    }
  }
  return [...out];
}

export function validateProse(
  text: string,
  allowedNumbers: readonly string[] = []
): ValidationResult {
  const allowed = new Set(allowedNumbers.map(normNum));
  const flags: ValidationFlag[] = [];
  let clean = text;

  // Shared strip-and-flag pass for both digit and spelled numbers. A number is
  // kept only if it appears in the sourced set; otherwise it is masked. A sourced
  // number sitting in a proof-stat shape is kept but flagged for review.
  const maskPass = (re: RegExp) => {
    clean = clean.replace(re, (m: string, offset: number) => {
      // Spare a bare "one" determiner; keep masking "one" in a number/stat shape.
      // (Only the spelled-number pass can produce "one"; the digit pass never does.)
      if (m.trim().toLowerCase() === "one") {
        const after = clean.slice(offset + m.length, offset + m.length + 16);
        const before = clean.slice(Math.max(0, offset - 8), offset);
        if (!ONE_STAT_AFTER.test(after) && !ONE_STAT_BEFORE.test(before)) {
          return m; // leave the determiner in place, no flag
        }
      }
      const norm = normNum(m);
      if (allowed.has(norm)) {
        const ctx = clean.slice(Math.max(0, offset - 20), offset + m.length + 20);
        if (CLAIM_NEAR.test(ctx)) flags.push({ span: m.trim(), reason: "stat-claim" });
        return m;
      }
      flags.push({ span: m.trim(), reason: "unsourced-number" });
      return "[unverified]";
    });
  };

  maskPass(NUMBER_RE);
  maskPass(WORD_NUMBER_RE);

  for (const mm of text.matchAll(NAMED_CUSTOMER_RE)) {
    flags.push({ span: mm[1].trim(), reason: "named-customer" });
  }

  return { clean, flags, ok: flags.length === 0 };
}
