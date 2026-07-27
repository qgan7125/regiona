import { describe, expect, it } from "vitest";

import { regionNumbersInBrush } from "../src/preview/brush-selection";

describe("regionNumbersInBrush", () => {
  it("collects all distinct regions touched by the circular brush", () => {
    const labelMap = new Uint32Array([
      1, 1, 2,
      1, 3, 2,
      4, 4, 2,
    ]);

    expect(regionNumbersInBrush(labelMap, 3, 3, 1, 1, 1.1)).toEqual([1, 2, 3, 4]);
  });

  it("clamps the brush to the image boundary", () => {
    const labelMap = new Uint32Array([1, 2, 3, 4]);

    expect(regionNumbersInBrush(labelMap, 2, 2, 0, 0, 2)).toEqual([1, 2, 3, 4]);
  });
});
