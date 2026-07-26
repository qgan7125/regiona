import { describe, expect, it } from "vitest";

import { isPrimaryPointerButton } from "../src/preview/pointer-button";

describe("isPrimaryPointerButton", () => {
  it("allows selection gestures only for the left mouse button", () => {
    expect(isPrimaryPointerButton(0)).toBe(true);
    expect(isPrimaryPointerButton(1)).toBe(false);
    expect(isPrimaryPointerButton(2)).toBe(false);
  });
});
