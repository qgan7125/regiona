import { describe, expect, it } from "vitest";

import { normalizeRevealPercentage } from "../src/components/image-comparison-reveal-state";

describe("image comparison reveal", () => {
  it("keeps the before-and-after divider within the image bounds", () => {
    expect(normalizeRevealPercentage(-12)).toBe(0);
    expect(normalizeRevealPercentage(48.5)).toBe(48.5);
    expect(normalizeRevealPercentage(140)).toBe(100);
  });
});
