import { describe, expect, it, vi } from "vitest";

import { createGeminiImageProvider } from "../src/ai/gemini-image-provider";

const sourceImage = new File(["source"], "source.png", { type: "image/png" });
const cleanRedraw = new File(["redraw"], "redraw.png", { type: "image/png" });

function successfulGeminiResponse() {
  return new Response(JSON.stringify({
    candidates: [{
      content: {
        parts: [{
          inlineData: {
            data: "aGVsbG8=",
            mimeType: "image/png",
          },
        }],
      },
    }],
  }), { status: 200 });
}

describe("Gemini image reconstruction provider", () => {
  it("requires a user-provided Gemini API key", () => {
    expect(() => createGeminiImageProvider("   "))
      .toThrow("A Gemini API key is required.");
  });

  it("sends the source image to Gemini's standard image editing endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(successfulGeminiResponse());
    const provider = createGeminiImageProvider("gemini-user-key", fetcher);

    await expect(provider.createCleanRedraw({ source: sourceImage })).resolves.toEqual({
      dataUrl: "data:image/png;base64,aGVsbG8=",
      mimeType: "image/png",
      model: "gemini-3.1-flash-image",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1/models/gemini-3.1-flash-image:generateContent",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-goog-api-key": "gemini-user-key",
        }),
      }),
    );
    const request = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as {
      contents: Array<{ parts: Array<{ inline_data?: { data: string; mime_type: string } }> }>;
      generationConfig: { responseModalities: string[] };
    };
    expect(request.generationConfig).toEqual({ responseModalities: ["IMAGE"] });
    expect(request.contents[0]?.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ inline_data: { data: "c291cmNl", mime_type: "image/png" } }),
    ]));
  });

  it("uses both the clean redraw and the original to reconstruct colors", async () => {
    const fetcher = vi.fn().mockResolvedValue(successfulGeminiResponse());
    const provider = createGeminiImageProvider("gemini-user-key", fetcher);

    await provider.reconstructColors({
      original: sourceImage,
      cleanRedraw,
      palette: ["#F25C35", "#117E69"],
    });

    const request = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as {
      contents: Array<{ parts: Array<{ inline_data?: { data: string } }> }>;
    };
    expect(request.contents[0]?.parts.filter((part) => part.inline_data)).toEqual([
      expect.objectContaining({ inline_data: expect.objectContaining({ data: "cmVkcmF3" }) }),
      expect.objectContaining({ inline_data: expect.objectContaining({ data: "c291cmNl" }) }),
    ]);
  });

  it("does not expose Gemini's response body when the request is rejected", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: "secret provider diagnostic" },
    }), { status: 403 }));
    const provider = createGeminiImageProvider("gemini-user-key", fetcher);

    await expect(provider.createCleanRedraw({ source: sourceImage }))
      .rejects.toThrow("Gemini denied image generation access (HTTP 403).");
  });

  it("explains how to resolve exhausted image-generation quota", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 429 }));
    const provider = createGeminiImageProvider("gemini-user-key", fetcher);

    await expect(provider.createCleanRedraw({ source: sourceImage }))
      .rejects.toThrow("Gemini image-generation quota is exhausted (HTTP 429). Check the AI Studio project linked to this key");
  });

  it("rejects an image response without usable PNG data", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [] }), {
      status: 200,
    }));
    const provider = createGeminiImageProvider("gemini-user-key", fetcher);

    await expect(provider.createCleanRedraw({ source: sourceImage }))
      .rejects.toThrow("Gemini did not return a usable PNG image.");
  });
});
