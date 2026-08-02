import { describe, expect, it } from "vitest";

import { validateImageFile } from "../src/utils/image-file";

describe("validateImageFile", () => {
  it("allows a larger internal generated image when given its explicit limit", async () => {
    const bytes = new Uint8Array(21 * 1024 * 1024);
    bytes.set([0x89, 0x50, 0x4e, 0x47]);
    const file = new File([bytes], "large-upscale.png", { type: "image/png" });

    await expect(validateImageFile(file, { maximumFileBytes: 64 * 1024 * 1024 }))
      .resolves.toBeUndefined();
  });
});
