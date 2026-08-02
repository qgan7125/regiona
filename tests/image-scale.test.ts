import { describe, expect, it } from "vitest";

import { calculateUpscaleDimensions, describeUpscaleCandidate } from "../src/ai/image-scale";

describe("calculateUpscaleDimensions", () => {
  it("uses the selected scale to produce deterministic target pixels", () => {
    expect(calculateUpscaleDimensions({ width: 640, height: 480, scale: 3 }))
      .toEqual({ width: 1920, height: 1440, requestedScale: 3, appliedScale: 3, wasLimited: false });
  });

  it("caps very large outputs while preserving the source aspect ratio", () => {
    const dimensions = calculateUpscaleDimensions({ width: 4000, height: 3000, scale: 4 });

    expect(dimensions.wasLimited).toBe(true);
    expect(dimensions.width * dimensions.height).toBeLessThanOrEqual(16 * 1024 * 1024);
    expect(dimensions.width / dimensions.height).toBeCloseTo(4 / 3, 2);
  });

  it("rejects unsupported scale choices", () => {
    expect(() => calculateUpscaleDimensions({ width: 640, height: 480, scale: 5 }))
      .toThrow("between 2× and 4×");
  });

  it("describes the currently selected upscale factor", () => {
    expect(describeUpscaleCandidate(4)).toBe("4× high-resolution candidate");
  });
});
