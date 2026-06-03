// Dev tool — NOT wired into the app or the build (scripts/ is excluded from
// tsconfig). Runs a LIVE dossier generation on a synthetic Mastercam + Ansys
// prospect and prints the digest plus whyFit / portfolioFit, so the structural
// draft guard can be eyeballed end to end on a controlled input.
//
//   npx tsx scripts/test-brief.ts
//
// Reads ANTHROPIC_API_KEY from .env.local (gitignored). Makes no API call if the
// key is absent.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildSignalDigest, parseBrief } from "@/components/dossier/brief";
import type { CompanyGroup } from "@/lib/signal-grouping";
import type { Signal } from "@/types/signal";

function loadEnvLocal(): void {
  try {
    const path = fileURLToPath(new URL("../.env.local", import.meta.url));
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env.local; fall back to the ambient environment
  }
}

function syntheticGroup(): CompanyGroup {
  const tech: Signal = {
    id: "syn-1",
    company: "Apex Aero Components",
    industry: "Aerospace and Defense",
    city: "Wichita",
    state: "KS",
    distanceMiles: 0,
    detectedSoftware: [
      { name: "Mastercam", productTypes: ["cam"], isCompetitor: true },
      { name: "Ansys", productTypes: ["simulation"], isCompetitor: true },
    ],
    productTypes: ["cam", "simulation"],
    signalType: "Tech Adoption",
    title: "Runs Mastercam and Ansys",
    description:
      "Aerospace machining shop, ~180 employees, AS9100. Detected stack includes Mastercam (CNC programming) and Ansys (structural simulation).",
    sourceLabel: "ZoomInfo",
    sourceUrl: "",
    postedAgo: "current intel",
    signalStrength: 82,
    contacts: [],
  };
  const job: Signal = {
    ...tech,
    id: "syn-2",
    signalType: "Job Posting",
    title: "Senior CNC Programmer (Mastercam, 5-axis)",
    description:
      "Seeking a senior CNC programmer with 5-axis Mastercam experience for titanium aerospace structural parts.",
    sourceLabel: "Greenhouse",
    postedAgo: "4 days ago",
  };
  return {
    key: "apex-aero",
    company: "Apex Aero Components",
    industry: "Aerospace and Defense",
    state: "KS",
    city: "Wichita",
    signals: [tech, job],
    topSignal: tech,
    maxStrength: 82,
    urgency: "high",
    detectedSoftware: ["Mastercam", "Ansys"],
    productTypes: ["cam", "simulation"],
    oneLiner: "Runs Mastercam and Ansys",
    oldestPostedAgo: "4 days ago",
    camRelevant: true,
    manufacturingRelevant: true,
  };
}

async function main(): Promise<void> {
  loadEnvLocal();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error(
      "ANTHROPIC_API_KEY not found in .env.local or environment. Aborting (no API call made)."
    );
    process.exit(1);
  }

  const group = syntheticGroup();
  const digest = buildSignalDigest(group);
  console.log("================ DIGEST (prompt input) ================");
  console.log(digest);
  console.log();

  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: digest }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");

  console.log("================ RAW MODEL OUTPUT ================");
  console.log(text);
  console.log();

  const brief = parseBrief(text);
  console.log("================ whyFit (eyeball: generic for Ansys) ================");
  console.log(brief?.whyFit ?? "(parse failed)");
  console.log();
  console.log("================ portfolioFit (eyeball: no Ansys-replacement overclaim) ================");
  console.log(brief?.portfolioFit ?? "(parse failed)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
