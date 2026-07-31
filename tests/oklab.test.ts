import { describe, expect, it } from "vitest";

import { oklabDistanceSquared, oklabToRgb, rgbToOklab } from "../src/engine/color/oklab";

describe("oklab conversion", () => {
  it("round-trips sRGB through OKLab and back exactly for representative colors", () => {
    const samples: Array<[number, number, number]> = [
      [0, 0, 0],
      [255, 255, 255],
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [128, 64, 200],
      [10, 200, 50],
      [200, 180, 160],
    ];

    for (const [r, g, b] of samples) {
      const lab = rgbToOklab(r, g, b);
      const [r2, g2, b2] = oklabToRgb(lab);
      expect([r2, g2, b2]).toEqual([r, g, b]);
    }
  });

  it("ranks white as perceptually closer to green than to blue, unlike raw RGB distance", () => {
    // Raw RGB Euclidean distance treats these as exactly equidistant (both differ by 255
    // in two channels). OKLab correctly reflects that pure blue looks much darker/more
    // different from white than pure green does.
    const white = rgbToOklab(255, 255, 255);
    const green = rgbToOklab(0, 255, 0);
    const blue = rgbToOklab(0, 0, 255);

    expect(oklabDistanceSquared(white, green)).toBeLessThan(oklabDistanceSquared(white, blue));
  });

  it("handles fractional and out-of-range channel values sanely instead of silently zeroing", () => {
    // SRGB_TO_LINEAR is a fixed lookup table indexed 0-255; indexing it with a non-integer
    // key (e.g. a bilinearly-interpolated sample) silently returns undefined rather than
    // throwing, which previously fell through to {l:0,a:0,b:0} - pure black - for any
    // fractional input, corrupting every caller that samples non-integer pixel positions.
    const wholeNumber = rgbToOklab(181, 181, 181);
    const fractional = rgbToOklab(181.4, 181.4, 181.4);

    expect(fractional.l).toBeGreaterThan(0);
    expect(Math.abs(fractional.l - wholeNumber.l)).toBeLessThan(0.01);

    const outOfRange = rgbToOklab(-5, 260, 181.4);
    expect(Number.isFinite(outOfRange.l)).toBe(true);
    expect(outOfRange.l).toBeGreaterThan(0);
  });
});
