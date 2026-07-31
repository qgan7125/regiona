import { describe, expect, it, vi } from "vitest";

import {
  createOpenAiImageProviderWithClient,
  type OpenAiImageClient,
} from "../src/ai/openai-image-provider";

const sourceImage = new File(["source"], "source.png", { type: "image/png" });
const cleanRedraw = new File(["redraw"], "redraw.png", { type: "image/png" });

function createClient(base64 = "aGVsbG8=") {
  const edit = vi.fn().mockResolvedValue({ data: [{ b64_json: base64 }] });
  return {
    client: { images: { edit } } as OpenAiImageClient,
    edit,
  };
}

describe("OpenAI image reconstruction provider", () => {
  it("creates a clean redraw with conservative GPT Image settings", async () => {
    const { client, edit } = createClient();
    const provider = createOpenAiImageProviderWithClient(client);

    await expect(provider.createCleanRedraw({ source: sourceImage })).resolves.toEqual({
      dataUrl: "data:image/png;base64,aGVsbG8=",
      mimeType: "image/png",
      model: "gpt-image-2",
    });
    expect(edit).toHaveBeenCalledWith(expect.objectContaining({
      image: sourceImage,
      model: "gpt-image-2",
      background: "opaque",
      input_fidelity: "high",
      output_format: "png",
      quality: "low",
    }));
    expect(edit.mock.calls[0]?.[0].prompt).toContain("Preserve the original canvas aspect ratio");
  });

  it("uses the clean redraw for geometry and the original image for color reconstruction", async () => {
    const { client, edit } = createClient();
    const provider = createOpenAiImageProviderWithClient(client);

    await provider.reconstructColors({
      original: sourceImage,
      cleanRedraw,
      palette: ["#F25C35", "#117E69"],
    });

    expect(edit).toHaveBeenCalledWith(expect.objectContaining({
      image: [cleanRedraw, sourceImage],
    }));
    expect(edit.mock.calls[0]?.[0].prompt).toContain("#f25c35, #117e69");
  });

  it("rejects an unsupported source image before it reaches OpenAI", async () => {
    const { client, edit } = createClient();
    const provider = createOpenAiImageProviderWithClient(client);
    const unsupported = new File(["svg"], "source.svg", { type: "image/svg+xml" });

    await expect(provider.createCleanRedraw({ source: unsupported }))
      .rejects.toThrow("PNG, JPEG, or WebP");
    expect(edit).not.toHaveBeenCalled();
  });

  it("does not accept a malformed image result from OpenAI", async () => {
    const { client } = createClient("not safe base64!");
    const provider = createOpenAiImageProviderWithClient(client);

    await expect(provider.createCleanRedraw({ source: sourceImage }))
      .rejects.toThrow("OpenAI did not return a usable PNG image.");
  });
});
