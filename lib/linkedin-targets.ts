// Target contact role mapping per industry. Each role gets a LinkedIn
// keyword search URL scoped to the company name. No fabricated names,
// no fake emails. The rep clicks the link and lands on a live LinkedIn
// search.

export interface TargetContact {
  role: string;
  department: string;
  why: string;
}

export type IndustryBucket =
  | "aerospace"
  | "defense"
  | "automotive"
  | "energy"
  | "medical"
  | "machinery"
  | "tech"
  | "generic";

const PROFILES: Record<IndustryBucket, TargetContact[]> = {
  aerospace: [
    {
      role: "VP Manufacturing",
      department: "Operations",
      why: "Owns the CAM stack decision and feels the cost of disconnected CAD/CAM on every program rev.",
    },
    {
      role: "Director of Manufacturing Engineering",
      department: "Engineering",
      why: "Drives toolpath strategy and 5-axis programming. Direct buyer for CAMWorks.",
    },
    {
      role: "Quality Manager AS9100",
      department: "Quality",
      why: "AS9100 traceability pain. PDM Professional shortens audit prep.",
    },
    {
      role: "Lead CNC Programmer Mastercam",
      department: "Engineering",
      why: "Lives in the CAM tool every day. Champion candidate for displacement.",
    },
  ],
  defense: [
    {
      role: "VP Manufacturing",
      department: "Operations",
      why: "Owns capacity planning across DoD program lines.",
    },
    {
      role: "Program Manager",
      department: "Programs",
      why: "Cares about schedule risk on prime contract deliverables.",
    },
    {
      role: "Manufacturing Engineering Manager",
      department: "Engineering",
      why: "Direct buyer for CAM and simulation. Lives the integration pain.",
    },
    {
      role: "Quality Engineer",
      department: "Quality",
      why: "Capability briefs and FAI documentation. PDM Pro reduces audit churn.",
    },
  ],
  automotive: [
    {
      role: "VP Manufacturing",
      department: "Operations",
      why: "Tier supplier sees CAM stack as throughput lever.",
    },
    {
      role: "Tooling Engineering Manager",
      department: "Engineering",
      why: "Mold and die work, surfacing pain. CAMWorks displaces Surfcam and Mastercam.",
    },
    {
      role: "Manufacturing Engineer",
      department: "Engineering",
      why: "Individual contributor pain. Files break on every CAD rev.",
    },
    {
      role: "Quality Manager IATF 16949",
      department: "Quality",
      why: "Traceability and SPC integration with PDM.",
    },
  ],
  energy: [
    {
      role: "VP Manufacturing",
      department: "Operations",
      why: "Owns plant capacity for downhole and pressure equipment.",
    },
    {
      role: "Engineering Manager",
      department: "Engineering",
      why: "ASME compliance pain. SOLIDWORKS Simulation automates code checks.",
    },
    {
      role: "Manufacturing Engineer",
      department: "Engineering",
      why: "Programs valves, manifolds, threaded connections daily.",
    },
    {
      role: "Senior CNC Programmer",
      department: "Engineering",
      why: "Direct user of competitor CAM. Champion candidate.",
    },
  ],
  medical: [
    {
      role: "VP Operations",
      department: "Operations",
      why: "Owns implant production capacity and Swiss-type lines.",
    },
    {
      role: "Manufacturing Engineering Manager",
      department: "Engineering",
      why: "Mill-turn and Swiss programming. CAMWorks Multi-Task displaces GibbsCAM.",
    },
    {
      role: "Quality Regulatory Manager",
      department: "Quality",
      why: "21 CFR Part 11, Design History File. PDM Pro is the wedge.",
    },
    {
      role: "Process Engineer",
      department: "Engineering",
      why: "Validation lifecycle pain.",
    },
  ],
  machinery: [
    {
      role: "VP Manufacturing",
      department: "Operations",
      why: "Owns large-assembly throughput.",
    },
    {
      role: "Manufacturing Engineering Manager",
      department: "Engineering",
      why: "Heavy weldments and structural assemblies. SOLIDWORKS large-assembly mode is a clear win.",
    },
    {
      role: "Senior CNC Programmer Mastercam",
      department: "Engineering",
      why: "Direct CAM displacement target.",
    },
    {
      role: "Tooling Engineer",
      department: "Engineering",
      why: "Fixture design and shop-floor automation.",
    },
  ],
  tech: [
    {
      role: "VP Hardware Engineering",
      department: "Engineering",
      why: "Owns the prototype-to-production pipeline.",
    },
    {
      role: "Manufacturing Engineering Manager",
      department: "Engineering",
      why: "Tooling and pilot run programming.",
    },
    {
      role: "Mechanical Design Engineer",
      department: "Engineering",
      why: "SOLIDWORKS user, evaluates CAM integration.",
    },
    {
      role: "Senior CNC Programmer",
      department: "Engineering",
      why: "Direct buyer for CAM tool.",
    },
  ],
  generic: [
    {
      role: "VP Manufacturing",
      department: "Operations",
      why: "Owns the CAM stack and feels CAD/CAM friction across programs.",
    },
    {
      role: "Director of Manufacturing",
      department: "Operations",
      why: "Reports up to VP. Buyer of CAM seats and training.",
    },
    {
      role: "Manufacturing Engineering Manager",
      department: "Engineering",
      why: "Owns toolpath strategy and CAM tool selection.",
    },
    {
      role: "Lead CNC Programmer",
      department: "Engineering",
      why: "Lives in the CAM tool every day. Champion candidate.",
    },
  ],
};

export function targetsForIndustry(industry: string | null | undefined): TargetContact[] {
  if (!industry) return PROFILES.generic;
  const lower = industry.toLowerCase();
  if (lower.includes("aerospace")) return PROFILES.aerospace;
  if (lower.includes("defense")) return PROFILES.defense;
  if (lower.includes("automotive") || lower.includes("motor vehicle")) return PROFILES.automotive;
  if (lower.includes("energy") || lower.includes("oil") || lower.includes("gas")) return PROFILES.energy;
  if (lower.includes("medical")) return PROFILES.medical;
  if (lower.includes("machinery") || lower.includes("equipment") || lower.includes("metal") || lower.includes("fabricat") || lower.includes("transport")) return PROFILES.machinery;
  if (lower.includes("tech") || lower.includes("electronics") || lower.includes("semicond")) return PROFILES.tech;
  return PROFILES.generic;
}

export function linkedinSearchUrl(role: string, company: string): string {
  const params = new URLSearchParams({
    keywords: `${role} ${company}`,
    origin: "GLOBAL_SEARCH_HEADER",
  });
  return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
}
