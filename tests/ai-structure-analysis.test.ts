import { describe, expect, it } from "vitest";

import {
  AiStructureAnalysisError,
  parseAiStructureAnalysis,
} from "../src/ai/structure-analysis";

describe("parseAiStructureAnalysis", () => {
  it("accepts a bounded, normalized structure plan from an AI provider", () => {
    expect(parseAiStructureAnalysis({
      imageKind: "illustration",
      summary: "A character with a warm circular backdrop.",
      regions: [
        {
          id: "character",
          label: "Character",
          importance: "primary",
          bounds: [120, 150, 790, 940],
          suggestedFill: "#5A4B48",
        },
      ],
    })).toEqual({
      imageKind: "illustration",
      summary: "A character with a warm circular backdrop.",
      regions: [
        {
          id: "character",
          label: "Character",
          importance: "primary",
          bounds: [120, 150, 790, 940],
          suggestedFill: "#5a4b48",
        },
      ],
    });
  });

  it("rejects a provider response with invalid normalized geometry", () => {
    expect(() => parseAiStructureAnalysis({
      imageKind: "logo",
      summary: "Mark",
      regions: [{
        id: "mark",
        label: "Mark",
        importance: "primary",
        bounds: [0, 1001, 100, 200],
      }],
    })).toThrow(AiStructureAnalysisError);
  });
});
