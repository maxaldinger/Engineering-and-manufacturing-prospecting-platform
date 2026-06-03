import { companyKey } from "@/lib/signal-grouping";

// Canonicalize a company name so postings under name variants collapse into ONE
// prospect at the grouping layer. The grouping key (companyKey) already strips
// legal suffixes, so "Lockheed Martin" / "Lockheed Martin Corp" already share a
// key. This layer adds ALIAS resolution for acronyms and short forms that
// suffix-stripping cannot catch (e.g. "LMCO" -> "Lockheed Martin"). Without it,
// a single company fragments into several prospects.
//
// GTM data — extend COMPANY_ALIASES freely. Keep entries UNAMBIGUOUS: a wrong
// alias merges two distinct companies into one prospect, which is worse than
// leaving a rare short-form unmerged. Keys are written in companyKey() form
// (lowercased, suffix-stripped) so they match regardless of punctuation/case.
const COMPANY_ALIASES: Record<string, string> = {
  lmco: "Lockheed Martin",
  ngc: "Northrop Grumman",
  "general dynamics": "General Dynamics",
  "l3harris": "L3Harris",
  "l 3 harris": "L3Harris",
};

// Resolve a raw company name to its canonical display form. Returns the alias
// target if the (suffix-stripped) name is a known short form, otherwise the raw
// name trimmed. Suffix variants are intentionally left to the grouping key.
export function canonicalCompany(raw: string): string {
  const cleaned = (raw ?? "").trim();
  if (!cleaned) return cleaned;
  const key = companyKey(cleaned);
  return (key && COMPANY_ALIASES[key]) || cleaned;
}
