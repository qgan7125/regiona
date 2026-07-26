import { describe, expect, it } from "vitest";

import { fitCamera, zoomCameraAtPoint } from "../src/preview/camera";

describe("preview camera", () => {
  it("fits an image into its viewport while preserving aspect ratio", () => {
    expect(fitCamera({ width: 200, height: 100 }, { width: 300, height: 300 }, 100)).toEqual({
      scale: 1.5,
      x: 0,
      y: 75,
    });
  });

  it("keeps the point under the cursor stable while zooming", () => {
    expect(
      zoomCameraAtPoint(
        { scale: 1, x: 10, y: 20 },
        { x: 110, y: 120 },
        2,
      ),
    ).toEqual({ scale: 2, x: -90, y: -80 });
  });
});
