import { describe, expect, it, vi } from "vitest";

import { buildCompletePrompt, copyPromptText } from "../src/components/prompt-copy";

describe("copyPromptText", () => {
  it("builds one copy-ready prompt from every prompt-facing section", () => {
    expect(buildCompletePrompt({
      recreationPrompt: "A long recreation prompt.",
      corePrompt: "A concise core prompt.",
      negativePrompt: "blur, crop",
      styleTags: ["flat", "graphic", "outlined", "centered"],
    })).toBe([
      "Recreation Prompt:\nA long recreation prompt.",
      "Core Prompt:\nA concise core prompt.",
      "Negative Prompt:\nblur, crop",
      "Style Tags:\nflat, graphic, outlined, centered",
    ].join("\n\n"));
  });

  it("copies the exact prompt text through the supplied clipboard writer", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    await expect(copyPromptText("A concise prompt.", writeText)).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("A concise prompt.");
  });

  it("reports unavailable clipboard access without throwing", async () => {
    await expect(copyPromptText("A concise prompt.")).resolves.toBe(false);
  });
});
