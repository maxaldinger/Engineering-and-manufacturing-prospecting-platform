export type CamSoftwareName =
  | "Mastercam"
  | "Fusion 360"
  | "HSMWorks"
  | "GibbsCAM"
  | "Esprit"
  | "BobCAD-CAM"
  | "NX CAM"
  | "Edgecam"
  | "Surfcam"
  | "FeatureCAM";

export interface CamSoftware {
  name: CamSoftwareName;
  vendor: string;
  marketShareTier: "primary" | "secondary" | "niche";
  description: string;
}
