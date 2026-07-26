import { describe, expect, it } from "vitest";

import { clearRenderLayer } from "../src/preview/render-layers";

describe("render layers", () => {
  it("clears a selection layer without removing the base artwork", () => {
    const baseArtwork = { destroy: () => undefined };
    const selectionHighlight = { destroy: () => undefined };
    const destroyed: typeof selectionHighlight[] = [];
    const baseLayer = { children: [baseArtwork] };
    let selectionChildren = [selectionHighlight];
    const selectionLayer = {
      removeChildren: () => {
        const children = selectionChildren;
        selectionChildren = [];
        return children;
      },
    };
    selectionHighlight.destroy = () => {
      destroyed.push(selectionHighlight);
    };

    clearRenderLayer(selectionLayer);

    expect(selectionChildren).toEqual([]);
    expect(destroyed).toEqual([selectionHighlight]);
    expect(baseLayer.children).toEqual([baseArtwork]);
  });
});
