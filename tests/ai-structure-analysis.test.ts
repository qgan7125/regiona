import { describe, expect, it } from "vitest";

import {
  AiStructureAnalysisError,
  parseAiStructureAnalysis,
} from "../src/ai/structure-analysis";

const reversePromptFields = {
  recreationPrompt: Array.from({ length: 130 }, () => "visible").join(" "),
  corePrompt: Array.from({ length: 30 }, () => "graphic").join(" "),
  negativePrompt: "blur, crop, extra objects",
  styleTags: ["flat illustration", "bold outline", "graphic", "centered"] as [string, string, string, string],
  analysis: ["The crop is centered.", "The subject is visible.", "The palette is limited."],
  variantOffer: "I can provide variants for another target model.",
};

describe("parseAiStructureAnalysis", () => {
  it("accepts the six reverse-prompt sections without Regiona advice", () => {
    const analysis = parseAiStructureAnalysis({
      recreationPrompt: "A centered dark bird-like character with a layered feather silhouette stands before a warm circular emblem. The composition uses a near-front view, with a symmetrical body and a clear separation between the character, the pale background, and the gold geometric frame. Dark brown and charcoal forms define the subject while small bright accents establish the eyes and the surrounding symbol. Preserve the deliberate black contours, flat regions, and sharp pointed feather tips. Keep the figure large within the frame and leave breathing room around its outer silhouette. The image reads as a stylized graphic illustration with clean, closed regions rather than a textured painting. Preserve the visible proportions, the layered wings, and the centered halo-like backdrop without adding objects or changing the crop. Maintain crisp graphic edges and balanced spacing around the emblem.",
      corePrompt: "Centered stylized dark bird-like character with layered pointed feathers, flat dark brown regions, sharp black contour lines, small bright eye accents, and a warm gold circular geometric emblem behind it on a pale background. Symmetrical frontal composition with generous negative space.",
      negativePrompt: "photorealism, gradients, painterly texture, extra limbs, cropped subject, blurred outlines",
      styleTags: ["flat illustration", "bold linework", "graphic emblem", "centered composition"],
      analysis: [
        "The subject is centered and mostly symmetrical.",
        "The silhouette is defined by pointed feather-like contours.",
        "The frame contains a pale background and a warm circular emblem.",
      ],
      variantOffer: "I can also provide shorter, model-specific prompt variants.",
    });

    expect(analysis.styleTags).toHaveLength(4);
    expect(analysis.recreationPrompt).toContain("bird-like character");
    expect(analysis.analysis).toHaveLength(3);
  });

  it("rejects an invalid reverse-prompt section from an untrusted provider response", () => {
    expect(() => parseAiStructureAnalysis({
      ...reversePromptFields,
      styleTags: ["flat", "flat", "graphic", "centered"],
    })).toThrow(AiStructureAnalysisError);
  });
});
