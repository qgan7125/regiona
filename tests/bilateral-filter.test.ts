import { describe, expect, it } from "vitest";

import { bilateralFilterPixels } from "../src/engine/color/bilateral-filter";

describe("bilateralFilterPixels", () => {
  it("leaves a flat-color image unchanged", () => {
    const pixels = new Uint8ClampedArray(
      Array.from({ length: 9 }, () => [40, 80, 120, 255]).flat(),
    );

    expect(bilateralFilterPixels(pixels, 3, 3)).toEqual(pixels);
  });

  it("keeps a strong color edge crisp instead of blending it", () => {
    const black = [0, 0, 0, 255];
    const white = [255, 255, 255, 255];
    const pixels = new Uint8ClampedArray(
      [
        black, black, white, white, white,
        black, black, white, white, white,
        black, black, white, white, white,
        black, black, white, white, white,
        black, black, white, white, white,
      ].flat(),
    );

    const filtered = bilateralFilterPixels(pixels, 5, 5);
    const leftEdgeOffset = (2 * 5 + 1) * 4;
    const rightEdgeOffset = (2 * 5 + 2) * 4;

    expect(filtered[leftEdgeOffset]).toBeLessThan(20);
    expect(filtered[rightEdgeOffset]).toBeGreaterThan(235);
  });

  it("smooths a low-contrast speck toward its surrounding color", () => {
    const dark = [10, 10, 10, 255];
    const nearDark = [16, 16, 16, 255];
    const pixels = new Uint8ClampedArray(
      [
        dark, dark, dark,
        dark, nearDark, dark,
        dark, dark, dark,
      ].flat(),
    );

    const filtered = bilateralFilterPixels(pixels, 3, 3);
    const centerOffset = 4 * 4;

    expect(filtered[centerOffset]).toBeLessThan(16);
    expect(filtered[centerOffset]).toBeGreaterThanOrEqual(10);
  });

  it("passes the alpha channel through unfiltered", () => {
    const pixels = new Uint8ClampedArray([
      10, 10, 10, 0,
      10, 10, 10, 255,
      10, 10, 10, 128,
    ]);

    const filtered = bilateralFilterPixels(pixels, 3, 1);

    expect(filtered[3]).toBe(0);
    expect(filtered[7]).toBe(255);
    expect(filtered[11]).toBe(128);
  });

  it("returns a copy unchanged when dimensions do not match the buffer", () => {
    const pixels = new Uint8ClampedArray([1, 2, 3, 4]);

    expect(bilateralFilterPixels(pixels, 2, 2)).toEqual(pixels);
  });
});
