import type { Contact } from "./contact";
import type { ProductTypeId } from "./product";
import type { DetectedProduct } from "@/lib/catalog";

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
  // Products detected in the prospect's stack/text, typed against the catalog.
  // [] when nothing matched (see productTypes for the Unclassified case).
  detectedSoftware: DetectedProduct[];
  // Product types this signal is relevant to (cam, cad, simulation, ...). The
  // primary segmentation axis. An empty array means Unclassified: no product
  // type was detected, so the signal is surfaced under "Unclassified" rather
  // than dropped. Every source populates this — never left undefined.
  productTypes: ProductTypeId[];
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
