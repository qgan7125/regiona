import { describe, expect, it, vi } from "vitest";

import { createGeminiAnalysisProvider } from "../src/ai/gemini-analysis-provider";

const sourceImage = new File(["source"], "source.png", { type: "image/png" });

const validAnalysis = {
  recreationPrompt: Array.from({ length: 130 }, () => "visible").join(" "),
  corePrompt: Array.from({ length: 30 }, () => "graphic").join(" "),
  negativePrompt: "blur, crop, extra objects",
  styleTags: ["flat illustration", "bold outline", "graphic", "centered"],
  analysis: ["The crop is centered.", "The subject is visible.", "The palette is limited."],
  variantOffer: "I can provide variants for another target model.",
};

describe("Gemini analysis provider", () => {
  it("sends the original image and requests a structured JSON analysis", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(validAnalysis) }] } }],
    }), { status: 200 }));
    const provider = createGeminiAnalysisProvider("gemini-user-key", fetcher);

    await expect(provider.analyzeImage({ source: sourceImage })).resolves.toMatchObject({
      recreationPrompt: expect.any(String),
    });

    const request = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as {
      contents: Array<{ parts: Array<{ inline_data?: { data: string } }> }>;
      generationConfig: { responseMimeType: string; responseSchema: { type: string } };
    };
    expect(request.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT" },
    });
    expect(request.contents[0]?.parts[0]).toEqual(expect.objectContaining({
      text: expect.stringMatching(/reverse-prompt analyst[\s\S]*forensic reconstruction/),
    }));
    expect(request.contents[0]?.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ inline_data: expect.objectContaining({ data: "c291cmNl" }) }),
    ]));
  });

  it("rejects malformed analysis data after Gemini returns valid JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ ...validAnalysis, styleTags: ["flat", "flat", "graphic", "centered"] }) }] } }],
    }), { status: 200 }));
    const provider = createGeminiAnalysisProvider("gemini-user-key", fetcher);

    await expect(provider.analyzeImage({ source: sourceImage }))
      .rejects.toThrow("styleTags");
  });
});
