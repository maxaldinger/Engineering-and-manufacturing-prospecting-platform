// Sales motion for a prospect: ours vs theirs. SOLIDWORKS (our portfolio) in the
// detected stack is an UPSELL motion; a competitor tool is a DISPLACEMENT motion;
// both is MIXED. The brief states this explicitly so a competitor-suite shop
// (CATIA, NX, Creo, Inventor) is never floated up as a warm SOLIDWORKS account.

import { COMPETITORS, PORTFOLIO } from "@/lib/catalog";

export type Motion = "upsell" | "displacement" | "mixed" | "none";

const OUR_NAMES: ReadonlySet<string> = new Set(PORTFOLIO.map((p) => p.name));
const COMPETITOR_NAMES: ReadonlySet<string> = new Set(
  COMPETITORS.map((c) => c.name)
);

export function companyMotion(detectedSoftware: readonly string[]): Motion {
  const ours = detectedSoftware.some((n) => OUR_NAMES.has(n));
  const theirs = detectedSoftware.some((n) => COMPETITOR_NAMES.has(n));
  if (ours && theirs) return "mixed";
  if (ours) return "upsell";
  if (theirs) return "displacement";
  return "none";
}

// One-line, reseller-agnostic basis for the motion field (the reseller name is
// substituted by the caller from BRAND.reseller).
export function motionBasis(motion: Motion, detectedSoftware: readonly string[]): string {
  const ours = detectedSoftware.filter((n) => OUR_NAMES.has(n));
  const theirs = detectedSoftware.filter((n) => COMPETITOR_NAMES.has(n));
  switch (motion) {
    case "upsell":
      return `our portfolio detected (${ours.join(", ")}), expand the footprint`;
    case "displacement":
      return `competitor tooling detected (${theirs.join(", ")}), displacement play`;
    case "mixed":
      return `both ours (${ours.join(", ")}) and competitor (${theirs.join(", ")}) detected`;
    case "none":
      return "no portfolio or competitor software detected in public text";
  }
}
