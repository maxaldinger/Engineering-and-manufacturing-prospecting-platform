import type {
  ProductType,
  CompetitorProduct,
  PortfolioProduct,
} from "@/types/product";

// ===========================================================================
// Product types — the canonical 7. Adding an 8th = append one entry here (plus
// its id in types/product.ts) and tag competitors with it. ourProducts is the
// real reseller portfolio. relevanceKeywords for non-CAM types are a STARTER
// set pending a domain-SME pass.
// ===========================================================================

export const PRODUCT_TYPES = [
  {
    id: "cad",
    label: "CAD",
    description: "3D mechanical design and modeling.",
    ourProducts: ["SOLIDWORKS"],
    relevanceKeywords: [
      "cad designer",
      "3d modeling",
      "mechanical design",
      "part modeling",
      "drafting",
    ],
    enabledByDefault: true,
  },
  {
    id: "cam",
    label: "CAM",
    description: "Computer-aided manufacturing and CNC programming.",
    ourProducts: ["CAMWorks", "SOLIDWORKS CAM"],
    // Real: carried over verbatim from the legacy CAM_ADJACENT_KEYWORDS.
    relevanceKeywords: [
      "cam programmer",
      "cam engineer",
      "cnc programmer",
      "cnc machinist",
      "cnc programming",
      "5-axis programming",
      "5-axis machining",
      "5 axis",
      "multi-axis programming",
      "g-code",
      "g code",
      "post processor",
      "postprocessor",
      "toolpath",
      "tool path",
      "swiss-type",
      "mill-turn",
      "milling and turning",
      "feature recognition",
      "tolerance-based machining",
    ],
    enabledByDefault: true,
  },
  {
    id: "simulation",
    label: "Simulation (FEA/CFD)",
    description: "Structural, thermal, and fluid analysis.",
    ourProducts: ["SOLIDWORKS Simulation"],
    // Starter set — draft.
    relevanceKeywords: [
      "fea",
      "finite element",
      "cfd",
      "computational fluid",
      "simulation engineer",
      "stress analysis",
      "thermal analysis",
      "structural analysis",
    ],
    enabledByDefault: true,
  },
  {
    id: "electrical",
    label: "Electrical",
    description: "Electrical schematic and control panel design.",
    ourProducts: ["SOLIDWORKS Electrical"],
    // Starter set — draft.
    relevanceKeywords: [
      "electrical design",
      "schematic capture",
      "control panel design",
      "wiring harness",
      "ecad",
    ],
    enabledByDefault: true,
  },
  {
    id: "design-automation",
    label: "Design Automation",
    description: "Rules-based design automation and configuration.",
    ourProducts: ["DriveWorks"],
    // Starter set — draft.
    relevanceKeywords: [
      "design automation",
      "product configurator",
      "rules-based design",
      "engineer-to-order",
      "cpq",
    ],
    enabledByDefault: true,
  },
  {
    id: "additive",
    label: "Additive / 3D Printing",
    description: "Additive manufacturing and industrial 3D printing.",
    ourProducts: ["Markforged", "HP MJF"],
    // Starter set — draft.
    relevanceKeywords: [
      "additive manufacturing",
      "3d printing",
      "rapid prototyping",
      "metal printing",
      "fused deposition",
    ],
    enabledByDefault: true,
  },
  {
    id: "mfg-services",
    label: "Manufacturing Services",
    description: "Implementation, training, and support services.",
    ourProducts: ["Training & Implementation", "Technical Support"],
    // Services type: relevance-driven, not competitor-software-driven, so it
    // intentionally has no entries in COMPETITORS. Starter set — draft.
    relevanceKeywords: [
      "implementation services",
      "onboarding",
      "cad migration",
      "training",
      "technical support",
    ],
    enabledByDefault: true,
  },
] as const satisfies readonly ProductType[];

// ===========================================================================
// Competitors. The 10 CAM tools are REAL — name, vendor, tier, keywords, and
// fit are migrated verbatim from the legacy cam-software.ts + product-fit.ts +
// extract.ts. CATIA and Inventor are real carry-over detections (keywords from
// the legacy map) with no authoritative displacement fit yet. Everything marked
// draft is seed data: tier, keywords, and fit are NOT authoritative.
// ===========================================================================

export const COMPETITORS = [
  // ---- CAM (real) -------------------------------------------------------
  {
    name: "Mastercam",
    vendor: "CNC Software, Inc.",
    productTypes: ["cam"],
    marketShareTier: "primary",
    detectionKeywords: ["mastercam", "master cam", "master-cam"],
    fit: {
      replacement: "CAMWorks",
      secondary: "SOLIDWORKS CAM",
      reasons: [
        "Native SOLIDWORKS integration means no file translation, no lost geometry, no rebuild headaches when the design changes",
        "Feature recognition and tolerance-based machining drive automation that Mastercam still requires manual setup for",
        "Single-vendor support stack from CAD through CAM through PLM through hardware reduces vendor management burden",
      ],
    },
  },
  {
    name: "Fusion 360",
    vendor: "Autodesk",
    // Suite tool: Autodesk Fusion spans CAD and CAM.
    productTypes: ["cad", "cam"],
    marketShareTier: "primary",
    detectionKeywords: ["fusion 360", "fusion360", "autodesk fusion", "fusion cam"],
    fit: {
      replacement: "SOLIDWORKS + CAMWorks",
      reasons: [
        "Perpetual licensing option vs Autodesk's mandatory subscription, plus US-based reseller support that Fusion's online-only model does not match",
        "CAMWorks feature recognition handles complex parts faster than Fusion CAM in production environments",
        "SOLIDWORKS file format is the de facto standard in aerospace and defense supply chains, easier to collaborate with primes and partners",
      ],
    },
  },
  {
    name: "HSMWorks",
    vendor: "Autodesk",
    productTypes: ["cam"],
    marketShareTier: "secondary",
    detectionKeywords: ["hsmworks", "hsm works", "hsm-works", "inventor cam", "inventor hsm"],
    fit: {
      replacement: "CAMWorks",
      reasons: [
        "CAMWorks has deeper SOLIDWORKS integration since Autodesk has deprioritized HSMWorks development in favor of Fusion",
        "Broader machining strategies including 5-axis simultaneous, mill-turn, and Swiss machining built in",
        "Tolerance-based machining and feature recognition are more mature",
      ],
    },
  },
  {
    name: "GibbsCAM",
    vendor: "Sandvik Coromant",
    productTypes: ["cam"],
    marketShareTier: "secondary",
    detectionKeywords: ["gibbscam", "gibbs cam", "gibbs-cam"],
    fit: {
      replacement: "CAMWorks",
      reasons: [
        "Comparable feature set across milling and turning with native SOLIDWORKS integration GibbsCAM lacks",
        "Single-source support vs GibbsCAM's separate ownership chain after the 3D Systems sale to Sandvik Coromant",
        "Better roadmap alignment with the SOLIDWORKS ecosystem most shops already run",
      ],
    },
  },
  {
    name: "Esprit",
    vendor: "Hexagon",
    productTypes: ["cam"],
    marketShareTier: "secondary",
    detectionKeywords: ["esprit cam", "dp esprit", "hexagon esprit", "esprit edge"],
    fit: {
      replacement: "CAMWorks",
      reasons: [
        "Native SOLIDWORKS integration replaces Esprit's separate environment, cutting context switching for designer-programmers",
        "CAMWorks tolerance-based machining matches Esprit's knowledge-based approach without the Hexagon licensing overhead",
        "Simpler total cost when bundled with SOLIDWORKS seats most shops already need",
      ],
    },
  },
  {
    name: "BobCAD-CAM",
    vendor: "BobCAD-CAM, Inc.",
    productTypes: ["cam"],
    marketShareTier: "niche",
    detectionKeywords: ["bobcad", "bob cad", "bobcam", "bobcad-cam"],
    fit: {
      replacement: "SOLIDWORKS CAM",
      secondary: "CAMWorks",
      reasons: [
        "SOLIDWORKS CAM Standard ships free with SOLIDWORKS, removing the BobCAD line item entirely for shops upgrading their CAD",
        "Tighter integration eliminates the export and reimport cycle BobCAD users run between CAD and CAM",
        "Path to upgrade into CAMWorks Professional unlocks 5-axis, mill-turn, and Swiss without changing platforms",
      ],
    },
  },
  {
    name: "NX CAM",
    vendor: "Siemens",
    // Suite tool: Siemens NX spans CAD, CAM, and CAE/simulation.
    productTypes: ["cad", "cam", "simulation"],
    marketShareTier: "secondary",
    detectionKeywords: ["nx cam", "siemens nx", "unigraphics nx"],
    fit: {
      replacement: "CAMWorks",
      reasons: [
        "Right-sized for small to mid manufacturers where NX is overweight on cost and training",
        "Native SOLIDWORKS workflow fits shops already running SOLIDWORKS for design",
        "Lower total cost of ownership for production work that does not need the full NX feature surface",
      ],
    },
  },
  {
    name: "Edgecam",
    vendor: "Hexagon",
    productTypes: ["cam"],
    marketShareTier: "niche",
    detectionKeywords: ["edgecam", "edge cam", "edge-cam"],
    fit: {
      replacement: "CAMWorks",
      reasons: [
        "Hexagon has consolidated multiple CAM products, leaving Edgecam customers uncertain about long-term roadmap",
        "CAMWorks runs natively inside SOLIDWORKS, eliminating the file exchange Edgecam requires",
        "Single-vendor support across CAD, CAM, simulation, and PLM",
      ],
    },
  },
  {
    name: "Surfcam",
    vendor: "Hexagon",
    productTypes: ["cam"],
    marketShareTier: "niche",
    detectionKeywords: ["surfcam", "surf cam", "surf-cam"],
    fit: {
      replacement: "CAMWorks",
      reasons: [
        "Surfcam development has slowed under Hexagon, while CAMWorks ships major releases on the SOLIDWORKS cadence",
        "Mold and die surface machining strategies are well covered in CAMWorks 5-axis",
        "Direct SOLIDWORKS link removes Surfcam's translation step",
      ],
    },
  },
  {
    name: "FeatureCAM",
    vendor: "Autodesk",
    productTypes: ["cam"],
    marketShareTier: "niche",
    detectionKeywords: ["featurecam", "feature cam", "feature-cam"],
    fit: {
      replacement: "CAMWorks",
      reasons: [
        "Autodesk has effectively wound down FeatureCAM, pushing customers to Fusion which loses production-grade feature recognition",
        "CAMWorks preserves the feature-based automation FeatureCAM users rely on, inside SOLIDWORKS",
        "Direct migration path with familiar machining strategies",
      ],
    },
  },

  // ---- CAD carry-over (real detection, no authoritative fit yet) ---------
  {
    name: "CATIA",
    vendor: "Dassault Systèmes",
    productTypes: ["cad"],
    detectionKeywords: ["catia"],
  },
  {
    name: "Inventor",
    vendor: "Autodesk",
    // Inventor spans CAD plus Inventor CAM.
    productTypes: ["cad", "cam"],
    detectionKeywords: ["autodesk inventor"],
  },

  // ---- CAD seed (draft) -------------------------------------------------
  {
    name: "Creo",
    vendor: "PTC",
    productTypes: ["cad"],
    marketShareTier: "secondary",
    detectionKeywords: ["creo", "ptc creo", "pro/engineer"],
    fit: {
      replacement: "SOLIDWORKS",
      reasons: ["DRAFT — competitive positioning pending domain-SME review."],
    },
    draft: true,
  },
  {
    name: "Solid Edge",
    vendor: "Siemens",
    productTypes: ["cad"],
    marketShareTier: "secondary",
    detectionKeywords: ["solid edge"],
    fit: {
      replacement: "SOLIDWORKS",
      reasons: ["DRAFT — competitive positioning pending domain-SME review."],
    },
    draft: true,
  },

  // ---- Simulation seed (draft) ------------------------------------------
  {
    name: "Ansys",
    vendor: "Ansys, Inc.",
    productTypes: ["simulation"],
    marketShareTier: "primary",
    detectionKeywords: ["ansys"],
    fit: {
      replacement: "SOLIDWORKS Simulation",
      reasons: ["DRAFT — competitive positioning pending domain-SME review."],
    },
    draft: true,
  },
  {
    name: "Abaqus",
    vendor: "Dassault Systèmes",
    productTypes: ["simulation"],
    marketShareTier: "secondary",
    detectionKeywords: ["abaqus"],
    fit: {
      replacement: "SOLIDWORKS Simulation",
      reasons: ["DRAFT — competitive positioning pending domain-SME review."],
    },
    draft: true,
  },
  {
    name: "COMSOL",
    vendor: "COMSOL, Inc.",
    productTypes: ["simulation"],
    marketShareTier: "niche",
    detectionKeywords: ["comsol"],
    fit: {
      replacement: "SOLIDWORKS Simulation",
      reasons: ["DRAFT — competitive positioning pending domain-SME review."],
    },
    draft: true,
  },

  // ---- Electrical seed (draft) ------------------------------------------
  {
    name: "AutoCAD Electrical",
    vendor: "Autodesk",
    productTypes: ["electrical"],
    marketShareTier: "primary",
    detectionKeywords: ["autocad electrical"],
    fit: {
      replacement: "SOLIDWORKS Electrical",
      reasons: ["DRAFT — competitive positioning pending domain-SME review."],
    },
    draft: true,
  },
  {
    name: "EPLAN",
    vendor: "EPLAN GmbH",
    productTypes: ["electrical"],
    marketShareTier: "secondary",
    detectionKeywords: ["eplan"],
    fit: {
      replacement: "SOLIDWORKS Electrical",
      reasons: ["DRAFT — competitive positioning pending domain-SME review."],
    },
    draft: true,
  },
  {
    name: "Zuken E3.series",
    vendor: "Zuken",
    productTypes: ["electrical"],
    marketShareTier: "niche",
    detectionKeywords: ["zuken", "e3.series"],
    fit: {
      replacement: "SOLIDWORKS Electrical",
      reasons: ["DRAFT — competitive positioning pending domain-SME review."],
    },
    draft: true,
  },

  // ---- Design automation seed (draft) -----------------------------------
  {
    name: "Tacton",
    vendor: "Tacton Systems",
    productTypes: ["design-automation"],
    marketShareTier: "secondary",
    detectionKeywords: ["tacton"],
    fit: {
      replacement: "DriveWorks",
      reasons: ["DRAFT — competitive positioning pending domain-SME review."],
    },
    draft: true,
  },
  {
    name: "Configit",
    vendor: "Configit",
    productTypes: ["design-automation"],
    marketShareTier: "niche",
    detectionKeywords: ["configit"],
    fit: {
      replacement: "DriveWorks",
      reasons: ["DRAFT — competitive positioning pending domain-SME review."],
    },
    draft: true,
  },

  // ---- Additive seed (draft) --------------------------------------------
  {
    name: "Stratasys",
    vendor: "Stratasys",
    productTypes: ["additive"],
    marketShareTier: "primary",
    detectionKeywords: ["stratasys"],
    fit: {
      replacement: "Markforged",
      reasons: ["DRAFT — competitive positioning pending domain-SME review."],
    },
    draft: true,
  },
  {
    name: "3D Systems",
    vendor: "3D Systems",
    productTypes: ["additive"],
    marketShareTier: "secondary",
    detectionKeywords: ["3d systems"],
    fit: {
      replacement: "Markforged",
      reasons: ["DRAFT — competitive positioning pending domain-SME review."],
    },
    draft: true,
  },
  {
    name: "Formlabs",
    vendor: "Formlabs",
    productTypes: ["additive"],
    marketShareTier: "niche",
    detectionKeywords: ["formlabs"],
    fit: {
      replacement: "HP MJF",
      reasons: ["DRAFT — competitive positioning pending domain-SME review."],
    },
    draft: true,
  },
] as const satisfies readonly CompetitorProduct[];

// ===========================================================================
// Our portfolio products that we also DETECT as warm signals (the prospect
// already runs part of the catalog). Real — keywords migrated from the legacy
// CAM_SOFTWARE_KEYWORDS CAD-pairing entries. Never carry a displacement fit.
// ===========================================================================

export const PORTFOLIO = [
  {
    name: "SolidWorks",
    vendor: "Dassault Systèmes",
    productTypes: ["cad"],
    detectionKeywords: ["solidworks", "solid works", "solid-works"],
  },
  {
    name: "CAMWorks",
    vendor: "HCL Software",
    productTypes: ["cam"],
    detectionKeywords: ["camworks", "cam works"],
  },
  {
    name: "SOLIDWORKS CAM",
    vendor: "Dassault Systèmes",
    productTypes: ["cam"],
    detectionKeywords: ["solidworks cam"],
  },
] as const satisfies readonly PortfolioProduct[];
