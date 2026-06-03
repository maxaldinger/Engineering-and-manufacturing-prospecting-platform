export interface ProductFitMapping {
  replacement: string;
  secondary?: string;
  reasons: string[];
}

export const PRODUCT_FIT: Record<string, ProductFitMapping> = {
  Mastercam: {
    replacement: "CAMWorks",
    secondary: "SOLIDWORKS CAM",
    reasons: [
      "Native SOLIDWORKS integration means no file translation, no lost geometry, no rebuild headaches when the design changes",
      "Feature recognition and tolerance-based machining drive automation that Mastercam still requires manual setup for",
      "Single-vendor support stack from CAD through CAM through PLM through hardware reduces vendor management burden",
    ],
  },
  "Fusion 360": {
    replacement: "SOLIDWORKS + CAMWorks",
    reasons: [
      "Perpetual licensing option vs Autodesk's mandatory subscription, plus US-based reseller support that Fusion's online-only model does not match",
      "CAMWorks feature recognition handles complex parts faster than Fusion CAM in production environments",
      "SOLIDWORKS file format is the de facto standard in aerospace and defense supply chains, easier to collaborate with primes and partners",
    ],
  },
  HSMWorks: {
    replacement: "CAMWorks",
    reasons: [
      "CAMWorks has deeper SOLIDWORKS integration since Autodesk has deprioritized HSMWorks development in favor of Fusion",
      "Broader machining strategies including 5-axis simultaneous, mill-turn, and Swiss machining built in",
      "Tolerance-based machining and feature recognition are more mature",
    ],
  },
  GibbsCAM: {
    replacement: "CAMWorks",
    reasons: [
      "Comparable feature set across milling and turning with native SOLIDWORKS integration GibbsCAM lacks",
      "Single-source support vs GibbsCAM's separate ownership chain after the 3D Systems sale to Sandvik Coromant",
      "Better roadmap alignment with the SOLIDWORKS ecosystem most shops already run",
    ],
  },
  Esprit: {
    replacement: "CAMWorks",
    reasons: [
      "Native SOLIDWORKS integration replaces Esprit's separate environment, cutting context switching for designer-programmers",
      "CAMWorks tolerance-based machining matches Esprit's knowledge-based approach without the Hexagon licensing overhead",
      "Simpler total cost when bundled with SOLIDWORKS seats most shops already need",
    ],
  },
  "BobCAD-CAM": {
    replacement: "SOLIDWORKS CAM",
    secondary: "CAMWorks",
    reasons: [
      "SOLIDWORKS CAM Standard ships free with SOLIDWORKS, removing the BobCAD line item entirely for shops upgrading their CAD",
      "Tighter integration eliminates the export and reimport cycle BobCAD users run between CAD and CAM",
      "Path to upgrade into CAMWorks Professional unlocks 5-axis, mill-turn, and Swiss without changing platforms",
    ],
  },
  "NX CAM": {
    replacement: "CAMWorks",
    reasons: [
      "Right-sized for small to mid manufacturers where NX is overweight on cost and training",
      "Native SOLIDWORKS workflow fits shops already running SOLIDWORKS for design",
      "Lower total cost of ownership for production work that does not need the full NX feature surface",
    ],
  },
  Edgecam: {
    replacement: "CAMWorks",
    reasons: [
      "Hexagon has consolidated multiple CAM products, leaving Edgecam customers uncertain about long-term roadmap",
      "CAMWorks runs natively inside SOLIDWORKS, eliminating the file exchange Edgecam requires",
      "Single-vendor support across CAD, CAM, simulation, and PLM",
    ],
  },
  Surfcam: {
    replacement: "CAMWorks",
    reasons: [
      "Surfcam development has slowed under Hexagon, while CAMWorks ships major releases on the SOLIDWORKS cadence",
      "Mold and die surface machining strategies are well covered in CAMWorks 5-axis",
      "Direct SOLIDWORKS link removes Surfcam's translation step",
    ],
  },
  FeatureCAM: {
    replacement: "CAMWorks",
    reasons: [
      "Autodesk has effectively wound down FeatureCAM, pushing customers to Fusion which loses production-grade feature recognition",
      "CAMWorks preserves the feature-based automation FeatureCAM users rely on, inside SOLIDWORKS",
      "Direct migration path with familiar machining strategies",
    ],
  },
};

export function getReplacementFor(software: string): ProductFitMapping | undefined {
  if (PRODUCT_FIT[software]) return PRODUCT_FIT[software];
  const key = Object.keys(PRODUCT_FIT).find((k) =>
    software.toLowerCase().includes(k.toLowerCase())
  );
  return key ? PRODUCT_FIT[key] : undefined;
}
