import { describe, expect, it } from "vitest";

import { reconstructImage } from "../src/engine/reconstruct";
import { serializeRegionaProject } from "../src/utils/project-export";

describe("serializeRegionaProject", () => {
  it("preserves shared geometry and adjacency in the project source of truth", () => {
    const result = reconstructImage({
      pixels: new Uint8ClampedArray([
        0, 0, 0, 255,
        255, 255, 255, 255,
      ]),
      width: 2,
      height: 1,
      targetColors: 2,
      sourceFilename: "two-regions.png",
    });

    const project = JSON.parse(serializeRegionaProject(result)) as {
      boundaries: typeof result.boundaries;
      adjacency: typeof result.adjacency;
    };

    expect(project.boundaries).toEqual(result.boundaries);
    expect(project.adjacency).toEqual(result.adjacency);
  });
});
