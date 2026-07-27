/// <reference lib="webworker" />

import {
  selectedPixelMask,
  selectedPixelOutline,
} from "../preview/selection-rendering";

type SelectionWorkerRequest =
  | {
    type: "INITIALIZE";
    width: number;
    height: number;
    labelMap: ArrayBuffer;
    pixels: ArrayBuffer;
  }
  | {
    type: "RENDER";
    requestId: number;
    selectionKey: string;
    selectedRegionNumbers: ArrayBuffer;
  };

type SelectionWorkerResponse =
  | { type: "READY" }
  | {
    type: "RENDERED";
    requestId: number;
    selectionKey: string;
    fillBitmap: ImageBitmap;
    outlineBitmap: ImageBitmap;
  };

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

let width = 0;
let height = 0;
let labelMap: Uint32Array | undefined;
let pixels: Uint8ClampedArray | undefined;
let fillCanvas: OffscreenCanvas | undefined;
let outlineCanvas: OffscreenCanvas | undefined;
let fillContext: OffscreenCanvasRenderingContext2D | null = null;
let outlineContext: OffscreenCanvasRenderingContext2D | null = null;

workerScope.onmessage = (event: MessageEvent<SelectionWorkerRequest>) => {
  const request = event.data;
  if (request.type === "INITIALIZE") {
    width = request.width;
    height = request.height;
    labelMap = new Uint32Array(request.labelMap);
    pixels = new Uint8ClampedArray(request.pixels);
    fillCanvas = new OffscreenCanvas(width, height);
    outlineCanvas = new OffscreenCanvas(width, height);
    fillContext = fillCanvas.getContext("2d");
    outlineContext = outlineCanvas.getContext("2d");
    workerScope.postMessage({ type: "READY" } satisfies SelectionWorkerResponse);
    return;
  }

  if (!labelMap || !pixels || !fillCanvas || !outlineCanvas || !fillContext || !outlineContext) return;
  const selectedRegionNumbers = new Set(new Uint32Array(request.selectedRegionNumbers));
  const fillPixels = selectedPixelMask(pixels, labelMap, selectedRegionNumbers);
  const outlinePixels = selectedPixelOutline(
    labelMap,
    width,
    height,
    selectedRegionNumbers,
  );
  fillContext.putImageData(new ImageData(fillPixels, width, height), 0, 0);
  outlineContext.putImageData(new ImageData(outlinePixels, width, height), 0, 0);
  const fillBitmap = fillCanvas.transferToImageBitmap();
  const outlineBitmap = outlineCanvas.transferToImageBitmap();
  workerScope.postMessage(
    {
      type: "RENDERED",
      requestId: request.requestId,
      selectionKey: request.selectionKey,
      fillBitmap,
      outlineBitmap,
    } satisfies SelectionWorkerResponse,
    [fillBitmap, outlineBitmap],
  );
};
