import { describe, expect, it, vi } from "vitest";

import {
  createOpenAiImageProvider,
  createOpenAiImageProviderWithClient,
  createPngFileFromGeneratedImage,
  type OpenAiImageClient,
} from "../src/ai/openai-image-provider";

const sourceImage = new File(["source"], "source.png", { type: "image/png" });
const lineArt = new File(["line-art"], "line-art.png", { type: "image/png" });

function createClient(base64 = "aGVsbG8=") {
  const edit = vi.fn().mockResolvedValue({ data: [{ b64_json: base64 }] });
  return {
    client: { images: { edit } } as OpenAiImageClient,
    edit,
  };
}

describe("OpenAI image reconstruction provider", () => {
  it("requires a user-provided API key before loading the browser client", async () => {
    await expect(createOpenAiImageProvider("   "))
      .rejects.toThrow("An OpenAI API key is required.");
  });

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
      output_format: "png",
      quality: "low",
    }));
    expect(edit).toHaveBeenCalledWith(expect.not.objectContaining({
      input_fidelity: expect.anything(),
    }));
    expect(edit.mock.calls[0]?.[0].prompt).toContain("Preserve the original canvas aspect ratio");
  });

  it("creates black line art from the original image only", async () => {
    const { client, edit } = createClient();
    const provider = createOpenAiImageProviderWithClient(client);

    await provider.createLineArt({ source: sourceImage });

    expect(edit).toHaveBeenCalledWith(expect.objectContaining({
      image: sourceImage,
      prompt: expect.stringContaining("solid black line art"),
    }));
  });

  it("uses black line art for geometry and the original image for line-art colorization", async () => {
    const { client, edit } = createClient();
    const provider = createOpenAiImageProviderWithClient(client);

    await provider.colorizeLineArt({
      original: sourceImage,
      lineArt,
      colorCount: 8,
    });

    expect(edit).toHaveBeenCalledWith(expect.objectContaining({
      image: [lineArt, sourceImage],
    }));
    expect(edit.mock.calls[0]?.[0].prompt).toContain("8 flat fill colors");
    expect(edit.mock.calls[0]?.[0].prompt).toContain("black linework");
  });

  it("rejects a line-art color count outside the supported range", async () => {
    const { client } = createClient();
    const provider = createOpenAiImageProviderWithClient(client);

    await expect(provider.colorizeLineArt({
      original: sourceImage,
      lineArt,
      colorCount: 1,
    })).rejects.toThrow("between 2 and 32");
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

  it("explains when the key lacks GPT Image access without exposing the provider response", async () => {
    const { client } = createClient();
    client.images.edit = vi.fn().mockRejectedValue({
      status: 403,
      message: "This must never reach the user interface.",
    });
    const provider = createOpenAiImageProviderWithClient(client);

    await expect(provider.createCleanRedraw({ source: sourceImage }))
      .rejects.toThrow("OpenAI denied GPT Image access (HTTP 403). Complete organization verification");
  });

  it("reports an image request rejection by status without leaking provider details", async () => {
    const { client } = createClient();
    client.images.edit = vi.fn().mockRejectedValue({
      status: 400,
      message: "This must never reach the user interface.",
    });
    const provider = createOpenAiImageProviderWithClient(client);

    await expect(provider.createCleanRedraw({ source: sourceImage }))
      .rejects.toThrow("OpenAI rejected this image request (HTTP 400).");
  });

  it("converts a generated PNG into a safe file for the next edit stage", async () => {
    const file = createPngFileFromGeneratedImage({
      dataUrl: "data:image/png;base64,aGVsbG8=",
      mimeType: "image/png",
      model: "gpt-image-2",
    }, "clean-redraw.png");

    expect(file.name).toBe("clean-redraw.png");
    expect(file.type).toBe("image/png");
    await expect(file.text()).resolves.toBe("hello");
  });

  it("rejects a generated image with an invalid PNG data URL", () => {
    expect(() => createPngFileFromGeneratedImage({
      dataUrl: "data:text/html;base64,PHNjcmlwdD4=",
      mimeType: "image/png",
      model: "gpt-image-2",
    }, "clean-redraw.png")).toThrow("usable PNG");
  });
});
