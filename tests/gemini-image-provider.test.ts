import { describe, expect, it, vi } from "vitest";

import { createGeminiImageProvider } from "../src/ai/gemini-image-provider";

const sourceImage = new File(["source"], "source.png", { type: "image/png" });
const lineArt = new File(["line-art"], "line-art.png", { type: "image/png" });

function successfulGeminiResponse(
  mimeType = "image/png",
  data = "aGVsbG8=",
) {
  return new Response(JSON.stringify({
    candidates: [{
      content: {
        parts: [{
          inlineData: {
            data,
            mimeType,
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

  it("creates an image directly from a reverse prompt without sending an image input", async () => {
    const fetcher = vi.fn().mockResolvedValue(successfulGeminiResponse());
    const provider = createGeminiImageProvider("gemini-user-key", fetcher);

    await provider.createPromptRedraw({
      prompt: "A centered green-haired character portrait with a soft pink graphic background.",
    });

    const request = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as {
      contents: Array<{ parts: Array<{ text?: string; inline_data?: unknown }> }>;
    };
    expect(request.contents[0]?.parts).toEqual([
      expect.objectContaining({ text: expect.stringContaining("centered green-haired character portrait") }),
    ]);
    expect(request.contents[0]?.parts.some((part) => part.inline_data)).toBe(false);
  });

  it("uses black line art first and the original second to colorize line art", async () => {
    const fetcher = vi.fn().mockResolvedValue(successfulGeminiResponse());
    const provider = createGeminiImageProvider("gemini-user-key", fetcher);

    await provider.colorizeLineArt({
      original: sourceImage,
      lineArt,
      colorCount: 8,
    });

    const request = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as {
      contents: Array<{ parts: Array<{ inline_data?: { data: string } }> }>;
    };
    expect(request.contents[0]?.parts.filter((part) => part.inline_data)).toEqual([
      expect.objectContaining({ inline_data: expect.objectContaining({ data: "bGluZS1hcnQ=" }) }),
      expect.objectContaining({ inline_data: expect.objectContaining({ data: "c291cmNl" }) }),
    ]);
    expect(request.contents[0]?.parts[0]).toEqual(expect.objectContaining({
      text: expect.stringContaining("black linework"),
    }));
    expect(request.contents[0]?.parts[0]).toEqual(expect.objectContaining({
      text: expect.stringContaining("8 flat fill colors"),
    }));
  });

  it("creates black line art from the original image only", async () => {
    const fetcher = vi.fn().mockResolvedValue(successfulGeminiResponse());
    const provider = createGeminiImageProvider("gemini-user-key", fetcher);

    await provider.createLineArt({ source: sourceImage });

    const request = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as {
      contents: Array<{ parts: Array<{ text?: string; inline_data?: { data: string } }> }>;
      generationConfig: { responseModalities: string[] };
    };
    expect(request.generationConfig).toEqual({ responseModalities: ["IMAGE"] });
    expect(request.contents[0]?.parts).toEqual([
      expect.objectContaining({ text: expect.stringContaining("solid black line art") }),
      expect.objectContaining({ inline_data: expect.objectContaining({ data: "c291cmNl" }) }),
    ]);
  });

  it("requests a two-times AI scale improvement from the original image", async () => {
    const fetcher = vi.fn().mockResolvedValue(successfulGeminiResponse());
    const provider = createGeminiImageProvider("gemini-user-key", fetcher);

    await provider.improveImageScale({ source: sourceImage, scale: 2 });

    const request = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as {
      contents: Array<{ parts: Array<{ text?: string; inline_data?: { data: string } }> }>;
    };
    expect(request.contents[0]?.parts).toEqual([
      expect.objectContaining({ text: expect.stringContaining("2×") }),
      expect.objectContaining({ inline_data: expect.objectContaining({ data: "c291cmNl" }) }),
    ]);
  });

  it("keeps a JPEG result returned by Gemini", async () => {
    const fetcher = vi.fn().mockResolvedValue(successfulGeminiResponse(
      "image/jpeg",
      "/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==",
    ));
    const provider = createGeminiImageProvider("gemini-user-key", fetcher);

    await expect(provider.createCleanRedraw({ source: sourceImage })).resolves.toEqual({
      dataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==",
      mimeType: "image/jpeg",
      model: "gemini-3.1-flash-image",
    });
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
      .rejects.toThrow("Gemini did not return a usable image result.");
  });
});
