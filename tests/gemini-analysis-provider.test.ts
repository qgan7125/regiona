import { describe, expect, it, vi } from "vitest";

import { createGeminiAnalysisProvider } from "../src/ai/gemini-analysis-provider";

const sourceImage = new File(["source"], "source.png", { type: "image/png" });

const validAnalysis = {
  imageKind: "illustration",
  summary: "A character with a warm circular backdrop.",
  subjectDescription: "A dark bird-like character.",
  majorObjects: [],
  suggestedColorCount: 6,
  detectedProblems: ["compression-artifacts"],
  reconstructionStrategy: "redraw",
  regions: [],
};

describe("Gemini analysis provider", () => {
  it("sends the original image and requests a structured JSON analysis", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(validAnalysis) }] } }],
    }), { status: 200 }));
    const provider = createGeminiAnalysisProvider("gemini-user-key", fetcher);

    await expect(provider.analyzeImage({ source: sourceImage })).resolves.toMatchObject({
      imageKind: "illustration",
      suggestedColorCount: 6,
    });

    const request = JSON.parse(fetcher.mock.calls[0]?.[1]?.body as string) as {
      contents: Array<{ parts: Array<{ inline_data?: { data: string } }> }>;
      generationConfig: { responseMimeType: string; responseSchema: { type: string } };
    };
    expect(request.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT" },
    });
    expect(request.contents[0]?.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ inline_data: expect.objectContaining({ data: "c291cmNl" }) }),
    ]));
  });

  it("rejects malformed analysis data after Gemini returns valid JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ ...validAnalysis, imageKind: "unknown" }) }] } }],
    }), { status: 200 }));
    const provider = createGeminiAnalysisProvider("gemini-user-key", fetcher);

    await expect(provider.analyzeImage({ source: sourceImage }))
      .rejects.toThrow("imageKind");
  });

  it("normalizes known Gemini label variants before strict validation", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        ...validAnalysis,
        summary: "x".repeat(300),
        suggestedColorCount: 60,
        reconstructionStrategy: "Trace important contours and rebuild the illustration.",
        majorObjects: [{
          id: "character",
          label: "character",
          role: "structure",
          bounds: [0, 0, 1000, 1000],
          confidence: 5,
        }],
        regions: [{
          id: "main",
          label: "main subject",
          importance: "high",
          bounds: [0, 0, 1000, 1000],
          suggestedFill: "complex gradient",
        }],
      }) }] } }],
    }), { status: 200 }));
    const provider = createGeminiAnalysisProvider("gemini-user-key", fetcher);

    await expect(provider.analyzeImage({ source: sourceImage })).resolves.toMatchObject({
      suggestedColorCount: 32,
      reconstructionStrategy: "redraw",
      majorObjects: [expect.objectContaining({ role: "subject" })],
      regions: [expect.objectContaining({ importance: "primary" })],
    });
  });
});
