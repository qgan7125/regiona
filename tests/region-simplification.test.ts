import { describe, expect, it } from "vitest";

import {
  maximumAreaForSimplification,
  type RegionSimplification,
} from "../src/engine/regions/simplification";

describe("maximumAreaForSimplification", () => {
  it("keeps every component when simplification is off", () => {
    expect(maximumAreaForSimplification("off", 1024, 1024)).toBe(0);
  });

  it("scales simplification thresholds with image area", () => {
    const levels: RegionSimplification[] = ["subtle", "balanced", "strong"];

    expect(levels.map((level) => maximumAreaForSimplification(level, 1000, 1000)))
      .toEqual([4, 12, 36]);
    expect(maximumAreaForSimplification("balanced", 2000, 2000)).toBe(48);
  });
});
