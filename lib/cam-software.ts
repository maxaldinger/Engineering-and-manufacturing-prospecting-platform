import type { CamSoftware } from "@/types/software";

export const CAM_SOFTWARE: CamSoftware[] = [
  {
    name: "Mastercam",
    vendor: "CNC Software, Inc.",
    marketShareTier: "primary",
    description: "Largest installed base in US job shops and contract manufacturers",
  },
  {
    name: "Fusion 360",
    vendor: "Autodesk",
    marketShareTier: "primary",
    description: "Subscription-only cloud CAD/CAM, popular with smaller shops and startups",
  },
  {
    name: "HSMWorks",
    vendor: "Autodesk",
    marketShareTier: "secondary",
    description: "SOLIDWORKS-integrated CAM Autodesk has deprioritized for Fusion",
  },
  {
    name: "GibbsCAM",
    vendor: "Sandvik Coromant",
    marketShareTier: "secondary",
    description: "Strong in Swiss-type and multi-task machining, ownership shifted post 3D Systems",
  },
  {
    name: "Esprit",
    vendor: "Hexagon",
    marketShareTier: "secondary",
    description: "Knowledge-based machining, strong in aerospace and medical",
  },
  {
    name: "BobCAD-CAM",
    vendor: "BobCAD-CAM, Inc.",
    marketShareTier: "niche",
    description: "Lower-cost option for smaller shops",
  },
  {
    name: "NX CAM",
    vendor: "Siemens",
    marketShareTier: "secondary",
    description: "High-end, common in aerospace primes and large OEMs",
  },
  {
    name: "Edgecam",
    vendor: "Hexagon",
    marketShareTier: "niche",
    description: "Production milling and turning, integrated with Vero Solid Edge",
  },
  {
    name: "Surfcam",
    vendor: "Hexagon",
    marketShareTier: "niche",
    description: "Mold and die focused, surface machining strengths",
  },
  {
    name: "FeatureCAM",
    vendor: "Autodesk",
    marketShareTier: "niche",
    description: "Feature-based automation, also deprioritized by Autodesk",
  },
];

export const CAM_SOFTWARE_NAMES = CAM_SOFTWARE.map((s) => s.name);
