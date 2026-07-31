import { describe, expect, it, vi } from "vitest";

import { createGeminiImageProvider } from "../src/ai/gemini-image-provider";

const sourceImage = new File(["source"], "source.png", { type: "image/png" });
const cleanRedraw = new File(["redraw"], "redraw.png", { type: "image/png" });

function successfulGeminiResponse() {
  return new Response(JSON.stringify({
    output_image: {
      data: "aGVsbG8=",
      mime_type: "image/png",
    },
  }), { status: 200 });
}

describe("Gemini image reconstruction provider", () => {
  it("requires a user-provided Gemini API key", () => {
    expect(() => createGeminiImageProvider("   "))
      .toThrow("A Gemini API key is required.");
  });

  it("sends the source image to Gemini's native image editing endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(successfulGeminiResponse());
    const provider = createGeminiImageProvider("gemini-user-key", fetcher);

    await expect(provider.createCleanRedraw({ source: sourceImage })).resolves.toEqual({
      dataUrl: "data:image/png;base64,aGVsbG8=",
      mimeType: "image/png",
      model: "gemini-3.1-flash-image",
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "x-goog-api-key": "gemini-user-key",
        }),
      }),
    );
    const request = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as {
      model: string;
      input: Array<{ type: string; data?: string; mime_type?: string }>;
      response_format: { type: string; mime_type: string };
    };
    expect(request.model).toBe("gemini-3.1-flash-image");
    expect(request.response_format).toEqual({ type: "image", mime_type: "image/png" });
    expect(request.input).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "image", data: "c291cmNl", mime_type: "image/png" }),
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
      input: Array<{ type: string; data?: string }>;
    };
    expect(request.input.filter((item) => item.type === "image")).toEqual([
      expect.objectContaining({ data: "cmVkcmF3" }),
      expect.objectContaining({ data: "c291cmNl" }),
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

  it("rejects an image response without usable PNG data", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output_image: {} }), {
      status: 200,
    }));
    const provider = createGeminiImageProvider("gemini-user-key", fetcher);

    await expect(provider.createCleanRedraw({ source: sourceImage }))
      .rejects.toThrow("Gemini did not return a usable PNG image.");
  });
});
