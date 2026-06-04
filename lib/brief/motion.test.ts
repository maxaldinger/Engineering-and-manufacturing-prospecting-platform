import { describe, it, expect } from "vitest";
import { companyMotion } from "./motion";

describe("sales motion: ours vs theirs", () => {
  it("SOLIDWORKS in the stack is an upsell", () => {
    expect(companyMotion(["SolidWorks"])).toBe("upsell");
    expect(companyMotion(["CAMWorks"])).toBe("upsell");
  });

  it("a competitor in the stack is a displacement", () => {
    expect(companyMotion(["CATIA"])).toBe("displacement");
    expect(companyMotion(["Mastercam"])).toBe("displacement");
    expect(companyMotion(["NX CAM"])).toBe("displacement");
  });

  it("both is mixed", () => {
    expect(companyMotion(["SolidWorks", "CATIA"])).toBe("mixed");
  });

  it("neither is none", () => {
    expect(companyMotion([])).toBe("none");
    expect(companyMotion(["Some Unknown Tool"])).toBe("none");
  });
});
