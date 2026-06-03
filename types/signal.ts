import type { Contact } from "./contact";
import type { CamSoftwareName } from "./software";

export type SignalType = "Job Posting" | "News" | "Gov Contract" | "Tech Adoption";

export interface Signal {
  id: string;
  company: string;
  industry: string;
  city: string;
  state: string;
  distanceMiles: number;
  employeeEstimate?: string;
  revenueEstimate?: string;
  detectedSoftware: { name: CamSoftwareName | string; version?: string }[];
  signalType: SignalType;
  title: string;
  description: string;
  sourceLabel: string;
  sourceUrl: string;
  postedAgo: string;
  signalStrength: number;
  contacts: Contact[];
  // Set true when the signal references CNC programming, 5-axis,
  // post-processor, toolpath, or other CAM-adjacent terms even without
  // a specific brand match. Lets the rep see CAM-relevant signals that
  // do not name a tool by brand.
  camRelevant?: boolean;
  // Set true for federal contracts in manufacturing NAICS codes or with
  // machining/fabrication keywords in the description. Used to keep
  // mfg-relevant contracts in the feed.
  manufacturingRelevant?: boolean;
}
