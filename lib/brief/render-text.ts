// Text renderer for a GroundedBrief, with provenance shown inline. The React view
// renders the same model with the same provenance affordances; this serializer is
// for review and for the dev sample so a brief can be read end to end as plain
// text with every tag visible.

import type { GroundedBrief } from "./assemble";
import { isCuratedGap, type AnyField } from "./provenance";

function val(value: unknown): string {
  return Array.isArray(value) ? value.join("; ") : String(value);
}

function tag(f: AnyField): string {
  switch (f.provenance) {
    case "detected":
      return `[DETECTED <- ${f.sourceRef.length} signal(s); ${f.sourceRef[0]?.url ?? f.sourceRef[0]?.label ?? ""}]`;
    case "computed":
      return `[COMPUTED ${f.basis.fn} ${JSON.stringify(f.basis.inputs)} <- ${f.sourceRef.length} signals]`;
    case "inferred":
      return f.sourceRef?.length
        ? `[INFERRED <- ${f.sourceRef.length} signal(s); ${f.basis}]`
        : `[INFERRED; ${f.basis}]`;
    case "curated":
      return isCuratedGap(f) ? `(PENDING: ${f.pending})` : `[CURATED; ${f.basis}]`;
  }
}

function field(label: string, f: AnyField): string {
  if (f.provenance === "curated" && isCuratedGap(f)) return `${label}: ${tag(f)}`;
  // CuratedGap has no value; every other field does.
  const value = "value" in f ? val(f.value) : "";
  return `${label}: ${value}  ${tag(f)}`;
}

export function renderBriefText(b: GroundedBrief): string {
  const L: string[] = [];
  const h = b.header;

  L.push("=".repeat(78));
  L.push(`COMPANY BRIEF  ·  generated ${b.generatedAt}`);
  L.push("=".repeat(78));
  L.push(field("Company", h.company));
  L.push(field("Vertical", h.vertical));
  L.push(field("Fit score", h.fitScore));
  L.push(field(`Motion (${h.motion.toUpperCase()})`, h.motionField));
  L.push("");

  L.push(`Disciplines (${b.disciplines.length}):`);
  for (const d of b.disciplines) L.push("  " + field("·", d));
  L.push("");

  L.push(`Why ${b.reseller.name} (${b.reseller.short}): ${b.reseller.supportLine}.`);
  L.push("");

  L.push("Executive Summary:");
  L.push("  " + field("", b.executiveSummary));
  L.push("");

  L.push(`Likely Pain Points (${b.painPoints.length}):`);
  for (const p of b.painPoints) {
    L.push("  " + field("·", p.text));
    if (p.discipline) L.push("    " + field("discipline", p.discipline));
    L.push("    " + field("reseller solution", p.proof));
  }
  L.push("");

  L.push(`Suggested Talking Points (${b.talkingPoints.length}):`);
  for (const p of b.talkingPoints) {
    L.push("  " + field("·", p.text));
    L.push("    " + field("proof line", p.proof));
  }
  L.push("");

  L.push(`Competitive Displacement (${b.displacement.length}):`);
  for (const d of b.displacement) {
    L.push("  " + field("Competitor", d.competitor));
    L.push(`    Replacement: ${d.replacement}`);
    L.push("    " + field("positioning", d.positioning));
  }
  L.push("");

  L.push(
    `Key Contacts (${b.keyContacts.length}, ${b.keyContacts[0]?.named ? "named via ZoomInfo" : "role templates, no ZoomInfo"}):`
  );
  for (const c of b.keyContacts) {
    L.push("  " + field("Role", c.role));
    L.push("    " + field("value-prop", c.valueProp));
    L.push("    " + field("tier", c.tier));
  }
  L.push("");

  L.push(`Related Signals (${b.relatedSignals.length}):`);
  for (const r of b.relatedSignals) {
    L.push("  " + field("Headline", r.headline));
    L.push("    " + field("relevance", r.relevance));
  }

  return L.join("\n");
}
