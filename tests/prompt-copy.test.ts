import { describe, expect, it, vi } from "vitest";

import { copyPromptText } from "../src/components/prompt-copy";

describe("copyPromptText", () => {
  it("copies the exact prompt text through the supplied clipboard writer", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(copyPromptText("A concise prompt.", writeText)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("A concise prompt.");
  });

  it("reports unavailable clipboard access without throwing", async () => {
    await expect(copyPromptText("A concise prompt.")).resolves.toBe(false);
  });
});
