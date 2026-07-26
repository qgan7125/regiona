import { describe, expect, it } from "vitest";

import { colorSampleAt } from "../src/preview/color-sample";

describe("colorSampleAt", () => {
  it("formats the clicked pixel as hex and RGB", () => {
    const pixels = new Uint8ClampedArray([
      242, 92, 53, 255,
      15, 20, 25, 128,
    ]);

    expect(colorSampleAt(pixels, 2, 1, 1, 0)).toEqual({
      alpha: 128,
      blue: 25,
      green: 20,
      hex: "#0f1419",
      red: 15,
      rgb: "rgb(15, 20, 25)",
      x: 1,
      y: 0,
    });
  });

  it("returns undefined when the point is outside the image", () => {
    expect(colorSampleAt(new Uint8ClampedArray(4), 1, 1, 1, 0)).toBeUndefined();
  });
});
