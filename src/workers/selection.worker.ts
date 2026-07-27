/// <reference lib="webworker" />

import {
  selectedPixelMaskForTile,
  selectedPixelOutlineForTile,
  selectionTilesForRegionNumbers,
  type SelectionTile,
} from "../preview/selection-rendering";

type SelectionWorkerRequest =
  | {
    type: "INITIALIZE";
    width: number;
    height: number;
    labelMap: ArrayBuffer;
    pixels: ArrayBuffer;
    regionBounds: ArrayBuffer;
  }
  | {
    type: "RENDER";
    requestId: number;
    selectionKey: string;
    selectedRegionNumbers: ArrayBuffer;
  }
  | {
    type: "SYNC_SELECTION";
    selectedRegionNumbers: ArrayBuffer;
  };

type SelectionWorkerResponse =
  | { type: "READY" }
  | {
    type: "TILES_RENDERED";
    requestId: number;
    selectionKey: string;
    tiles: Array<SelectionTile & { fillBitmap: ImageBitmap; outlineBitmap: ImageBitmap }>;
  };

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

let width = 0;
let height = 0;
let labelMap: Uint32Array | undefined;
let pixels: Uint8ClampedArray | undefined;
let regionBounds: Uint32Array | undefined;
let selectedRegionNumbers = new Set<number>();

workerScope.onmessage = (event: MessageEvent<SelectionWorkerRequest>) => {
  const request = event.data;
  if (request.type === "INITIALIZE") {
    width = request.width;
    height = request.height;
    labelMap = new Uint32Array(request.labelMap);
    pixels = new Uint8ClampedArray(request.pixels);
    regionBounds = new Uint32Array(request.regionBounds);
    selectedRegionNumbers = new Set<number>();
    workerScope.postMessage({ type: "READY" } satisfies SelectionWorkerResponse);
    return;
  }

  if (request.type === "SYNC_SELECTION") {
    selectedRegionNumbers = new Set(new Uint32Array(request.selectedRegionNumbers));
    return;
  }

  if (!labelMap || !pixels || !regionBounds) return;
  const sourceLabelMap = labelMap;
  const sourcePixels = pixels;
  const sourceRegionBounds = regionBounds;
  const nextSelection = new Set(new Uint32Array(request.selectedRegionNumbers));
  const changedRegionNumbers = new Set<number>();
  selectedRegionNumbers.forEach((regionNumber) => {
    if (!nextSelection.has(regionNumber)) changedRegionNumbers.add(regionNumber);
  });
  nextSelection.forEach((regionNumber) => {
    if (!selectedRegionNumbers.has(regionNumber)) changedRegionNumbers.add(regionNumber);
  });
  selectedRegionNumbers = nextSelection;

  const tiles = selectionTilesForRegionNumbers(
    [...changedRegionNumbers],
    sourceRegionBounds,
    width,
    height,
  ).map((tile) => {
    const fillCanvas = new OffscreenCanvas(tile.width, tile.height);
    const outlineCanvas = new OffscreenCanvas(tile.width, tile.height);
    const fillContext = fillCanvas.getContext("2d");
    const outlineContext = outlineCanvas.getContext("2d");
    if (!fillContext || !outlineContext) throw new Error("Regiona could not render a selection tile.");
    fillContext.putImageData(
      new ImageData(selectedPixelMaskForTile(sourcePixels, sourceLabelMap, width, tile, selectedRegionNumbers), tile.width, tile.height),
      0,
      0,
    );
    outlineContext.putImageData(
      new ImageData(selectedPixelOutlineForTile(sourceLabelMap, width, height, tile, selectedRegionNumbers), tile.width, tile.height),
      0,
      0,
    );
    return {
      ...tile,
      fillBitmap: fillCanvas.transferToImageBitmap(),
      outlineBitmap: outlineCanvas.transferToImageBitmap(),
    };
  });
  workerScope.postMessage(
    {
      type: "TILES_RENDERED",
      requestId: request.requestId,
      selectionKey: request.selectionKey,
      tiles,
    } satisfies SelectionWorkerResponse,
    tiles.flatMap(({ fillBitmap, outlineBitmap }) => [fillBitmap, outlineBitmap]),
  );
};
