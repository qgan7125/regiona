import { Graphics, GraphicsPath } from "pixi.js";

// Builds a Pixi Graphics object directly from our own SVG markup, one path at a time,
// instead of handing the whole string to Pixi's own Graphics().svg() parser.
//
// Pixi's SVG parser has a real bug for multi-subpath (evenodd hole) paths: it decides
// which subpath is the "main" shape using a bounding-box-area heuristic
// (node_modules/pixi.js/.../svg/utils/pathOperations.mjs calculatePathArea does
// (maxX-minX)*(maxY-minY), not true polygon area), then picks between two hole-handling
// strategies with its own nested-vs-sibling-holes guess
// (utils/fillOperations.mjs checkForNestedPattern). For irregular, elongated, or complex
// shapes - exactly what real photo/illustration regions produce, especially with 2+
// sibling holes - that guess is frequently wrong, and the wrong branch treats a hole as a
// second fill instead of a cutout, silently corrupting the shape.
//
// Verified against a real reconstruction: of 183 regions with exactly one main body and
// two sibling holes, 161 fell into the miscategorized branch. Bypassing Pixi's SVGParser
// and using GraphicsPath's own native evenodd tessellation directly (the same code path
// Pixi's parser itself uses for single-subpath paths, which is correct) fixed it -
// verified pixel-for-pixel against the browser's native SVG fill-rule evaluation
// (path.isPointInFill), which our own exported SVG already matches exactly.
export function buildRegionsGraphic(svgMarkup: string): Graphics {
  const graphics = new Graphics();
  const doc = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
  const pathElements = doc.querySelectorAll("path");

  pathElements.forEach((pathElement) => {
    const d = pathElement.getAttribute("d");
    if (!d) return;

    const fill = pathElement.getAttribute("fill") ?? "#000000";
    const fillOpacityAttribute = pathElement.getAttribute("fill-opacity");
    const fillAlpha = fillOpacityAttribute !== null ? Number(fillOpacityAttribute) : 1;

    graphics.path(new GraphicsPath(d, true));
    graphics.fill({ color: fill, alpha: Number.isFinite(fillAlpha) ? fillAlpha : 1 });

    const stroke = pathElement.getAttribute("stroke");
    if (stroke) {
      const strokeWidthAttribute = pathElement.getAttribute("stroke-width");
      const width = strokeWidthAttribute !== null ? Number(strokeWidthAttribute) : 1;
      graphics.stroke({ color: stroke, width: Number.isFinite(width) ? width : 1 });
    }
  });

  return graphics;
}
