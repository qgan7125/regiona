import { describe, expect, it } from "vitest";

import { quantizeImage } from "../src/engine/color/quantize";

describe("quantizeImage", () => {
  it("reduces an image to no more than the requested number of colors", () => {
    const pixels = new Uint8ClampedArray([
      255, 0, 0, 255,
      250, 5, 5, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
    ]);

    const result = quantizeImage(pixels, 2);

    expect(result.palette.length).toBeLessThanOrEqual(2);
    expect(result.paletteIndexes).toHaveLength(4);
  });

  it("is deterministic for identical input and settings", () => {
    const pixels = new Uint8ClampedArray([
      10, 20, 30, 255,
      30, 40, 50, 255,
      200, 210, 220, 255,
      220, 230, 240, 255,
    ]);

    const first = quantizeImage(pixels, 2);
    const second = quantizeImage(pixels, 2);

    expect(second.palette).toEqual(first.palette);
    expect(second.paletteIndexes).toEqual(first.paletteIndexes);
  });
});

