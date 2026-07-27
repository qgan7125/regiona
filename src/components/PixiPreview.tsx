import { useCallback, useEffect, useRef, useState } from "react";
import {
  Application,
  Container,
  Graphics,
  Sprite,
  Texture,
} from "pixi.js";

import { fitCamera, zoomCameraAtPoint } from "../preview/camera";
import type { Camera } from "../preview/camera";
import { colorSampleAt } from "../preview/color-sample";
import type { ColorSample } from "../preview/color-sample";
import { isPrimaryPointerButton } from "../preview/pointer-button";
import { regionNumbersInBrush } from "../preview/brush-selection";
import {
  selectionGraphicCacheKey,
  shouldUseSelectionTexture,
  type SelectionTile,
} from "../preview/selection-rendering";

interface PixiPreviewProps {
  width: number;
  height: number;
  zoom: number;
  pixels?: Uint8ClampedArray;
  selectionPixels?: Uint8ClampedArray;
  svgMarkup?: string;
  selectedPath?: string;
  selectedFill?: string;
  selectedOpacity?: number;
  selectedRegions?: Array<{
    path: string;
    fill: string;
    opacity: number;
    bounds: { x: number; y: number; width: number; height: number };
    regionNumber: number;
  }>;
  labelMap?: Uint32Array;
  regionBounds?: Uint32Array;
  isViewLinked?: boolean;
  linkedCamera?: Camera;
  onZoomChange: (zoom: number) => void;
  onCameraChange?: (camera: Camera) => void;
  onSelectRegion?: (
    regionNumbers: number | number[],
    mode?: "replace" | "toggle" | "add" | "remove",
  ) => void;
  brushMode?: "add" | "remove";
  brushSize?: number;
  onContextMenuRegion?: (
    regionNumber: number,
    anchorPosition: { left: number; top: number },
  ) => void;
  onClearSelection?: () => void;
  onPickColor?: (sample: ColorSample, anchorPosition: { left: number; top: number }) => void;
  ariaLabel: string;
}

interface SelectionRaster {
  selectionKey: string;
  tiles: Array<SelectionTile & { fillBitmap: ImageBitmap; outlineBitmap: ImageBitmap }>;
}

interface SelectionWorkerResponse {
  type: "READY" | "TILES_RENDERED";
  requestId?: number;
  selectionKey?: string;
  tiles?: Array<SelectionTile & { fillBitmap: ImageBitmap; outlineBitmap: ImageBitmap }>;
}

interface SelectionTileSprites {
  fillSprite: Sprite;
  outlineSprite: Sprite;
  fillTexture: Texture;
  outlineTexture: Texture;
}

const clampZoom = (zoom: number) => Math.max(50, Math.min(2000, zoom));

function canvasTexture(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  scaleMode?: "nearest",
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Regiona could not create a preview canvas.");
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
  const texture = Texture.from(canvas);
  if (scaleMode) texture.source.scaleMode = scaleMode;
  return texture;
}

function bitmapTexture(bitmap: ImageBitmap, scaleMode?: "nearest") {
  const texture = Texture.from(bitmap);
  if (scaleMode) texture.source.scaleMode = scaleMode;
  return texture;
}

function selectedRegionGraphic(
  region: { path: string; fill: string; opacity: number },
  width: number,
  height: number,
  viewportScale: number,
) {
  const strokeWidth = 2 / viewportScale;
  return new Graphics().svg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${region.path}" fill="${region.fill}" fill-opacity="${region.opacity}" stroke="#f25c35" stroke-width="${strokeWidth}" /></svg>`,
  );
}

function drawBrushCursor(cursor: Graphics, point: { x: number; y: number }, brushSize: number) {
  cursor.clear()
    .circle(0, 0, brushSize / 2)
    .fill({ color: 0x2f80ed, alpha: 0.08 })
    .stroke({ color: 0x2f80ed, alpha: 0.95, width: 1.5 });
  cursor.position.set(point.x, point.y);
  cursor.visible = true;
}

function brushPreviewStamp(
  point: { x: number; y: number },
  brushSize: number,
  viewport: Container,
) {
  const imageX = (point.x - viewport.x) / viewport.scale.x;
  const imageY = (point.y - viewport.y) / viewport.scale.y;
  const imageRadius = brushSize / (2 * viewport.scale.x);
  return new Graphics()
    .circle(imageX, imageY, imageRadius)
    .fill({ color: 0x2f80ed, alpha: 0.22 });
}

const MAX_CACHED_SELECTION_GRAPHICS = 96;

export function PixiPreview({
  width,
  height,
  zoom,
  pixels,
  selectionPixels,
  svgMarkup,
  selectedPath,
  selectedFill,
  selectedOpacity = 1,
  selectedRegions,
  labelMap,
  regionBounds,
  isViewLinked = false,
  linkedCamera,
  onZoomChange,
  onCameraChange,
  onSelectRegion,
  brushMode,
  brushSize = 24,
  onContextMenuRegion,
  onClearSelection,
  onPickColor,
  ariaLabel,
}: PixiPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [contentRevision, setContentRevision] = useState(0);
  const [selectionScale, setSelectionScale] = useState(1);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Container | null>(null);
  const baseLayerRef = useRef<Container | null>(null);
  const selectionLayerRef = useRef<Container | null>(null);
  const brushPreviewRef = useRef<Container | null>(null);
  const brushCursorRef = useRef<Graphics | null>(null);
  const brushCursorPointerRef = useRef<{ x: number; y: number } | undefined>(undefined);
  const hasFittedViewportRef = useRef(false);
  const contentSizeRef = useRef({ width, height });
  const contentVersionRef = useRef(0);
  const dragRef = useRef<{
    x: number;
    y: number;
    moved: boolean;
    brushing: boolean;
    brushMode?: "add" | "remove";
  } | null>(null);
  const pendingBrushRegionsRef = useRef(new Set<number>());
  const pendingBrushModeRef = useRef<"add" | "remove" | undefined>(undefined);
  const brushFrameRef = useRef(0);
  const zoomRef = useRef(zoom);
  const reportedZoomRef = useRef(zoom);
  const onZoomChangeRef = useRef(onZoomChange);
  const onCameraChangeRef = useRef(onCameraChange);
  const onSelectRegionRef = useRef(onSelectRegion);
  const brushModeRef = useRef(brushMode);
  const brushSizeRef = useRef(brushSize);
  const spacePressedRef = useRef(false);
  const onContextMenuRegionRef = useRef(onContextMenuRegion);
  const onClearSelectionRef = useRef(onClearSelection);
  const onPickColorRef = useRef(onPickColor);
  const labelMapRef = useRef(labelMap);
  const pixelsRef = useRef(pixels);
  const baseDisplayRef = useRef<Sprite | Graphics | null>(null);
  const fitRef = useRef<() => void>(() => undefined);
  const pixelTextureCacheRef = useRef(new WeakMap<Uint8ClampedArray, Texture>());
  const vectorGraphicCacheRef = useRef<
    { markup: string; graphic: Graphics } | undefined
  >(undefined);
  const selectionGraphicCacheRef = useRef(new Map<string, Graphics>());
  const selectionTileSpritesRef = useRef(new Map<string, SelectionTileSprites>());
  const selectionWorkerRef = useRef<Worker | null>(null);
  const selectionWorkerReadyRef = useRef(false);
  const selectionWorkerInFlightRef = useRef<{ requestId: number; selectionKey: string } | undefined>(undefined);
  const selectionWorkerPendingRef = useRef<{ selectionKey: string; regionNumbers: Uint32Array } | undefined>(undefined);
  const selectionRequestIdRef = useRef(0);
  const selectionWorkerGenerationRef = useRef(0);
  const selectionCurrentKeyRef = useRef<string | undefined>(undefined);
  const selectionWorkerSyncedKeyRef = useRef<string | undefined>(undefined);
  const appliedSelectionRasterRef = useRef<SelectionRaster | undefined>(undefined);
  const [selectionRaster, setSelectionRaster] = useState<SelectionRaster>();

  const destroySelectionTileSprites = useCallback(() => {
    selectionTileSpritesRef.current.forEach((sprites) => {
      sprites.fillSprite.destroy();
      sprites.outlineSprite.destroy();
      sprites.fillTexture.destroy(true);
      sprites.outlineTexture.destroy(true);
    });
    selectionTileSpritesRef.current.clear();
    appliedSelectionRasterRef.current = undefined;
  }, []);

  const textureForPixels = useCallback((imagePixels: Uint8ClampedArray) => {
    const cached = pixelTextureCacheRef.current.get(imagePixels);
    if (cached) return cached;
    const texture = canvasTexture(imagePixels, width, height);
    pixelTextureCacheRef.current.set(imagePixels, texture);
    return texture;
  }, [height, width]);

  const dispatchPendingSelectionWorkerRender = useCallback(() => {
    const worker = selectionWorkerRef.current;
    const pending = selectionWorkerPendingRef.current;
    if (!worker || !pending || !selectionWorkerReadyRef.current || selectionWorkerInFlightRef.current) return;
    selectionWorkerPendingRef.current = undefined;
    const requestId = selectionRequestIdRef.current + 1;
    selectionRequestIdRef.current = requestId;
    selectionWorkerInFlightRef.current = { requestId, selectionKey: pending.selectionKey };
    worker.postMessage(
      {
        type: "RENDER",
        requestId,
        selectionKey: pending.selectionKey,
        selectedRegionNumbers: pending.regionNumbers.buffer,
      },
      [pending.regionNumbers.buffer],
    );
  }, []);

  const queueSelectionWorkerRender = useCallback((selectionKey: string, regionNumbers: number[]) => {
    if (selectionWorkerInFlightRef.current?.selectionKey === selectionKey
      || selectionWorkerPendingRef.current?.selectionKey === selectionKey) return;
    selectionWorkerPendingRef.current = {
      selectionKey,
      regionNumbers: new Uint32Array(regionNumbers),
    };
    dispatchPendingSelectionWorkerRender();
  }, [dispatchPendingSelectionWorkerRender]);

  const syncSelectionWorker = useCallback((selectionKey: string, regionNumbers: number[]) => {
    if (selectionWorkerSyncedKeyRef.current === selectionKey) return;
    const worker = selectionWorkerRef.current;
    if (!worker) return;
    const selectedRegionNumbers = new Uint32Array(regionNumbers);
    selectionWorkerSyncedKeyRef.current = selectionKey;
    worker.postMessage(
      {
        type: "SYNC_SELECTION",
        selectedRegionNumbers: selectedRegionNumbers.buffer,
      },
      [selectedRegionNumbers.buffer],
    );
  }, []);

  useEffect(() => {
    if (!labelMap || !selectionPixels || !regionBounds) return;
    const worker = new Worker(new URL("../workers/selection.worker.ts", import.meta.url), {
      type: "module",
    });
    selectionWorkerRef.current = worker;
    selectionWorkerReadyRef.current = false;
    selectionWorkerInFlightRef.current = undefined;
    selectionWorkerPendingRef.current = undefined;
    selectionWorkerSyncedKeyRef.current = undefined;
    selectionWorkerGenerationRef.current += 1;
    worker.onmessage = (event: MessageEvent<SelectionWorkerResponse>) => {
      const response = event.data;
      if (response.type === "READY") {
        selectionWorkerReadyRef.current = true;
        dispatchPendingSelectionWorkerRender();
        return;
      }
      if (!response.tiles || !response.selectionKey) return;
      selectionWorkerInFlightRef.current = undefined;
      if (response.selectionKey !== selectionCurrentKeyRef.current) {
        response.tiles.forEach(({ fillBitmap, outlineBitmap }) => {
          fillBitmap.close();
          outlineBitmap.close();
        });
        dispatchPendingSelectionWorkerRender();
        return;
      }
      setSelectionRaster({
        selectionKey: response.selectionKey,
        tiles: response.tiles,
      });
      dispatchPendingSelectionWorkerRender();
    };
    const initialLabelMap = new Uint32Array(labelMap);
    const initialPixels = new Uint8ClampedArray(selectionPixels);
    const initialRegionBounds = new Uint32Array(regionBounds);
    worker.postMessage(
      {
        type: "INITIALIZE",
        width,
        height,
        labelMap: initialLabelMap.buffer,
        pixels: initialPixels.buffer,
        regionBounds: initialRegionBounds.buffer,
      },
      [initialLabelMap.buffer, initialPixels.buffer, initialRegionBounds.buffer],
    );
    return () => {
      if (selectionWorkerRef.current === worker) selectionWorkerRef.current = null;
      worker.terminate();
    };
  }, [dispatchPendingSelectionWorkerRender, height, labelMap, regionBounds, selectionPixels, width]);

  const fitViewport = useCallback(() => {
    const app = appRef.current;
    const viewport = viewportRef.current;
    if (!app || !viewport) return;
    const camera = fitCamera(contentSizeRef.current, app.screen, zoomRef.current);
    viewport.scale.set(camera.scale);
    viewport.position.set(camera.x, camera.y);
    setSelectionScale(camera.scale);
    hasFittedViewportRef.current = true;
  }, []);

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
    onCameraChangeRef.current = onCameraChange;
    onSelectRegionRef.current = onSelectRegion;
    brushModeRef.current = brushMode;
    brushSizeRef.current = brushSize;
    onContextMenuRegionRef.current = onContextMenuRegion;
    onClearSelectionRef.current = onClearSelection;
    onPickColorRef.current = onPickColor;
    labelMapRef.current = labelMap;
    pixelsRef.current = pixels;
    fitRef.current = fitViewport;
  }, [
    fitViewport,
    labelMap,
    onCameraChange,
    onClearSelection,
    onContextMenuRegion,
    onPickColor,
    onSelectRegion,
    brushMode,
    brushSize,
    onZoomChange,
    pixels,
  ]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const selectionGraphicCache = selectionGraphicCacheRef.current;
    let disposed = false;
    let initialized = false;
    let reportFrame = 0;
    let observer: ResizeObserver | undefined;
    let handleWheel: ((event: WheelEvent) => void) | undefined;
    let handleContextMenu: ((event: MouseEvent) => void) | undefined;
    let handleKeyDown: ((event: KeyboardEvent) => void) | undefined;
    let handleKeyUp: ((event: KeyboardEvent) => void) | undefined;
    let handleWindowBlur: (() => void) | undefined;
    let handlePointerLeave: (() => void) | undefined;
    let clearBrushPreview: (() => void) | undefined;
    const app = new Application();
    void (async () => {
      await app.init({
        width: Math.max(1, host.clientWidth),
        height: Math.max(1, host.clientHeight),
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      initialized = true;
      if (disposed) {
        app.destroy({ removeView: true });
        return;
      }

      host.appendChild(app.canvas);
      appRef.current = app;
      const viewport = new Container();
      const baseLayer = new Container();
      const selectionLayer = new Container();
      const brushPreview = new Container();
      const brushPreviewTimers = new Map<Graphics, number>();
      const brushCursor = new Graphics();
      brushPreview.eventMode = "none";
      brushCursor.eventMode = "none";
      brushCursor.visible = false;
      viewport.interactiveChildren = false;
      viewportRef.current = viewport;
      baseLayerRef.current = baseLayer;
      selectionLayerRef.current = selectionLayer;
      brushPreviewRef.current = brushPreview;
      brushCursorRef.current = brushCursor;
      viewport.addChild(baseLayer);
      viewport.addChild(selectionLayer);
      viewport.addChild(brushPreview);
      app.stage.addChild(viewport);
      app.stage.addChild(brushCursor);
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;
      const updateCursor = () => {
        const drag = dragRef.current;
        app.canvas.style.cursor = drag && !drag.brushing
          ? "grabbing"
          : brushModeRef.current && !spacePressedRef.current
            ? "none"
            : "grab";
        if (!brushModeRef.current || spacePressedRef.current || (drag && !drag.brushing)) {
          brushCursor.visible = false;
        }
      };
      const updateBrushCursor = (point: { x: number; y: number }) => {
        brushCursorPointerRef.current = { x: point.x, y: point.y };
        if (!brushModeRef.current || spacePressedRef.current) {
          brushCursor.visible = false;
          return;
        }
        drawBrushCursor(brushCursor, point, brushSizeRef.current);
      };
      const addBrushPreview = (point: { x: number; y: number }) => {
        const stamp = brushPreviewStamp(point, brushSizeRef.current, viewport);
        brushPreview.addChild(stamp);
        const timer = window.setTimeout(() => {
          brushPreviewTimers.delete(stamp);
          stamp.destroy();
        }, 350);
        brushPreviewTimers.set(stamp, timer);
      };
      clearBrushPreview = () => {
        brushPreviewTimers.forEach((timer) => window.clearTimeout(timer));
        brushPreviewTimers.clear();
        brushPreview.removeChildren().forEach((child) => child.destroy());
      };
      const enqueueBrushSelection = (
        regionNumbers: number | number[],
        mode: "add" | "remove",
      ) => {
        const numbers = Array.isArray(regionNumbers) ? regionNumbers : [regionNumbers];
        numbers.forEach((regionNumber) => pendingBrushRegionsRef.current.add(regionNumber));
        pendingBrushModeRef.current ??= mode;
        if (brushFrameRef.current) return;
        brushFrameRef.current = window.requestAnimationFrame(() => {
          brushFrameRef.current = 0;
          const pendingRegionNumbers = [...pendingBrushRegionsRef.current];
          const pendingMode = pendingBrushModeRef.current;
          pendingBrushRegionsRef.current.clear();
          pendingBrushModeRef.current = undefined;
          if (pendingRegionNumbers.length && pendingMode) {
            onSelectRegionRef.current?.(pendingRegionNumbers, pendingMode);
          }
        });
      };
      const brushRegionNumbersAt = (point: { x: number; y: number }) => {
        const imageX = Math.floor((point.x - viewport.x) / viewport.scale.x);
        const imageY = Math.floor((point.y - viewport.y) / viewport.scale.y);
        const radius = brushSizeRef.current / (2 * Math.max(viewport.scale.x, 0.001));
        const labels = labelMapRef.current;
        return labels
          ? regionNumbersInBrush(labels, width, height, imageX, imageY, radius)
          : [];
      };

      app.stage.on("pointerdown", (event) => {
        if (!isPrimaryPointerButton(event.button)) return;
        updateBrushCursor(event.global);
        const activeBrushMode = brushModeRef.current;
        const brushing = Boolean(activeBrushMode) && !spacePressedRef.current && Boolean(onSelectRegionRef.current);
        dragRef.current = { x: event.global.x, y: event.global.y, moved: false, brushing, brushMode: activeBrushMode };
        if (brushing) {
          addBrushPreview(event.global);
          const regionNumbers = brushRegionNumbersAt(event.global);
          if (regionNumbers.length && activeBrushMode) enqueueBrushSelection(regionNumbers, activeBrushMode);
          app.canvas.style.cursor = "none";
        } else app.canvas.style.cursor = "grabbing";
      });
      app.stage.on("globalpointermove", (event) => {
        updateBrushCursor(event.global);
        const drag = dragRef.current;
        if (!drag) return;
        if (drag.brushing) {
          addBrushPreview(event.global);
          const regionNumbers = brushRegionNumbersAt(event.global);
          if (regionNumbers.length && drag.brushMode) enqueueBrushSelection(regionNumbers, drag.brushMode);
          return;
        }
        const deltaX = event.global.x - drag.x;
        const deltaY = event.global.y - drag.y;
        if (Math.abs(deltaX) + Math.abs(deltaY) > 2) drag.moved = true;
        viewport.x += deltaX;
        viewport.y += deltaY;
        drag.x = event.global.x;
        drag.y = event.global.y;
        if (!onCameraChangeRef.current || reportFrame) return;
        reportFrame = window.requestAnimationFrame(() => {
          reportFrame = 0;
          onCameraChangeRef.current?.({
            scale: viewport.scale.x,
            x: viewport.x,
            y: viewport.y,
          });
        });
      });
      const endPointer = (event: { global: { x: number; y: number }; shiftKey: boolean }) => {
        const drag = dragRef.current;
        dragRef.current = null;
        updateCursor();
        if (!drag || drag.moved) {
          return;
        }
        if (drag.brushing) return;
        const imageX = Math.floor((event.global.x - viewport.x) / viewport.scale.x);
        const imageY = Math.floor((event.global.y - viewport.y) / viewport.scale.y);
        if (imageX < 0 || imageY < 0 || imageX >= width || imageY >= height) {
          onClearSelectionRef.current?.();
          return;
        }
        const sampledPixels = pixelsRef.current;
        if (sampledPixels && onPickColorRef.current) {
          const sample = colorSampleAt(sampledPixels, width, height, imageX, imageY);
          if (sample) {
            const bounds = app.canvas.getBoundingClientRect();
            onPickColorRef.current(sample, {
              left: bounds.left + event.global.x,
              top: bounds.top + event.global.y,
            });
          }
          return;
        }
        const regionNumber = labelMapRef.current?.[imageY * width + imageX] ?? 0;
        if (regionNumber && onSelectRegionRef.current) {
          onSelectRegionRef.current(regionNumber, event.shiftKey ? "toggle" : "replace");
        }
      };
      app.stage.on("pointerup", endPointer);
      app.stage.on("pointerupoutside", endPointer);

      handleContextMenu = (event: MouseEvent) => {
        if (!onContextMenuRegionRef.current) return;
        event.preventDefault();
        const bounds = app.canvas.getBoundingClientRect();
        const imageX = Math.floor((event.clientX - bounds.left - viewport.x) / viewport.scale.x);
        const imageY = Math.floor((event.clientY - bounds.top - viewport.y) / viewport.scale.y);
        const regionNumber = labelMapRef.current?.[imageY * width + imageX] ?? 0;
        if (regionNumber) {
          onContextMenuRegionRef.current(regionNumber, {
            left: event.clientX,
            top: event.clientY,
          });
        }
      };
      app.canvas.addEventListener("contextmenu", handleContextMenu);
      handlePointerLeave = () => {
        brushCursor.visible = false;
        brushCursorPointerRef.current = undefined;
      };
      app.canvas.addEventListener("pointerleave", handlePointerLeave);

      handleWheel = (event: WheelEvent) => {
        event.preventDefault();
        const bounds = app.canvas.getBoundingClientRect();
        const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        const nextZoom = clampZoom(zoomRef.current * (event.deltaY < 0 ? 1.1 : 0.9));
        const nextScale = viewport.scale.x * (nextZoom / zoomRef.current);
        const camera = zoomCameraAtPoint(
          { scale: viewport.scale.x, x: viewport.x, y: viewport.y },
          point,
          nextScale,
        );
        viewport.scale.set(camera.scale);
        viewport.position.set(camera.x, camera.y);
        setSelectionScale(camera.scale);
        zoomRef.current = nextZoom;
        reportedZoomRef.current = nextZoom;
        onCameraChangeRef.current?.(camera);
        onZoomChangeRef.current(nextZoom);
      };
      app.canvas.addEventListener("wheel", handleWheel, { passive: false });
      handleKeyDown = (event) => {
        if (event.code !== "Space" || !brushModeRef.current) return;
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
        spacePressedRef.current = true;
        event.preventDefault();
        updateCursor();
      };
      handleKeyUp = (event) => {
        if (event.code !== "Space") return;
        spacePressedRef.current = false;
        updateCursor();
      };
      handleWindowBlur = () => {
        spacePressedRef.current = false;
        updateCursor();
      };
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      window.addEventListener("blur", handleWindowBlur);
      updateCursor();

      observer = new ResizeObserver(() => {
        app.renderer.resize(
          Math.max(1, host.clientWidth),
          Math.max(1, host.clientHeight),
        );
        app.stage.hitArea = app.screen;
        if (!hasFittedViewportRef.current) fitRef.current();
      });
      observer.observe(host);
      fitRef.current();
      setReady(true);
    })();

    return () => {
      disposed = true;
      appRef.current = null;
      viewportRef.current = null;
      baseLayerRef.current = null;
      selectionLayerRef.current = null;
      brushPreviewRef.current = null;
      brushCursorRef.current = null;
      brushCursorPointerRef.current = undefined;
      baseDisplayRef.current = null;
      hasFittedViewportRef.current = false;
      vectorGraphicCacheRef.current = undefined;
      selectionGraphicCache.forEach((graphic) => graphic.destroy());
      selectionGraphicCache.clear();
      destroySelectionTileSprites();
      clearBrushPreview?.();
      pixelTextureCacheRef.current = new WeakMap<Uint8ClampedArray, Texture>();
      observer?.disconnect();
      window.cancelAnimationFrame(reportFrame);
      window.cancelAnimationFrame(brushFrameRef.current);
      if (handleWheel) app.canvas.removeEventListener("wheel", handleWheel);
      if (handleContextMenu) app.canvas.removeEventListener("contextmenu", handleContextMenu);
      if (handlePointerLeave) app.canvas.removeEventListener("pointerleave", handlePointerLeave);
      if (handleKeyDown) window.removeEventListener("keydown", handleKeyDown);
      if (handleKeyUp) window.removeEventListener("keyup", handleKeyUp);
      if (handleWindowBlur) window.removeEventListener("blur", handleWindowBlur);
      if (initialized) app.destroy({ removeView: true });
    };
  }, [destroySelectionTileSprites, height, width]);

  useEffect(() => {
    if (zoom === reportedZoomRef.current) return;
    zoomRef.current = zoom;
    reportedZoomRef.current = zoom;
    if (isViewLinked) return;
    fitRef.current();
  }, [isViewLinked, zoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!linkedCamera || !viewport) return;
    viewport.scale.set(linkedCamera.scale);
    viewport.position.set(linkedCamera.x, linkedCamera.y);
    setSelectionScale(linkedCamera.scale);
  }, [linkedCamera]);

  useEffect(() => {
    const app = appRef.current;
    if (!app || dragRef.current) return;
    app.canvas.style.cursor = brushMode && !spacePressedRef.current ? "none" : "grab";
  }, [brushMode]);

  useEffect(() => {
    const cursor = brushCursorRef.current;
    const pointer = brushCursorPointerRef.current;
    if (!cursor || !pointer || !brushMode || spacePressedRef.current) return;
    drawBrushCursor(cursor, pointer, brushSize);
  }, [brushMode, brushSize]);

  useEffect(() => {
    const app = appRef.current;
    const viewport = viewportRef.current;
    const baseLayer = baseLayerRef.current;
    if (!app || !viewport || !baseLayer || !ready) return;

    const version = contentVersionRef.current + 1;
    contentVersionRef.current = version;
    selectionLayerRef.current?.removeChildren();
    selectionGraphicCacheRef.current.forEach((graphic) => graphic.destroy());
    selectionGraphicCacheRef.current.clear();
    destroySelectionTileSprites();
    baseLayer.removeChildren().forEach((child) => {
      if (child !== vectorGraphicCacheRef.current?.graphic) child.destroy();
    });
    baseDisplayRef.current = null;

    const addDisplayObject = (display: Sprite | Graphics) => {
      if (contentVersionRef.current !== version) {
        return;
      }
      display.alpha = 1;
      baseLayer.addChild(display);
      baseDisplayRef.current = display;
      contentSizeRef.current = { width, height };
      setContentRevision((current) => current + 1);
    };

    if (pixels) {
      addDisplayObject(new Sprite(textureForPixels(pixels)));
      return;
    }

    if (svgMarkup) {
      if (vectorGraphicCacheRef.current?.markup !== svgMarkup) {
        vectorGraphicCacheRef.current?.graphic.destroy();
        vectorGraphicCacheRef.current = {
          markup: svgMarkup,
          graphic: new Graphics().svg(svgMarkup),
        };
      }
      addDisplayObject(vectorGraphicCacheRef.current.graphic);
      return;
    }

  }, [
    destroySelectionTileSprites,
    height,
    pixels,
    ready,
    svgMarkup,
    textureForPixels,
    width,
  ]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const selectionLayer = selectionLayerRef.current;
    const display = baseDisplayRef.current;
    if (!viewport || !selectionLayer || !display || !ready) return;

    const clearSelectionOverlay = () => {
      selectionLayer.removeChildren();
      destroySelectionTileSprites();
    };

    const selection = selectedRegions ?? (selectedPath && selectedFill
      ? [{ path: selectedPath, fill: selectedFill, opacity: selectedOpacity, bounds: { x: 0, y: 0, width, height }, regionNumber: 0 }]
      : []);
    const useSelectionTexture = shouldUseSelectionTexture(selection);
    display.alpha = selection.length ? 0.2 : 1;
    if (!selection.length) {
      selectionCurrentKeyRef.current = undefined;
      syncSelectionWorker("", []);
      clearSelectionOverlay();
      return;
    }

    if (useSelectionTexture && selectionPixels && labelMap && regionBounds) {
      const regionNumbers = selection.map(({ regionNumber }) => regionNumber);
      const selectionKey = `${selectionWorkerGenerationRef.current}:${regionNumbers.join(",")}`;
      selectionCurrentKeyRef.current = selectionKey;
      queueSelectionWorkerRender(selectionKey, regionNumbers);
      if (selectionRaster?.selectionKey !== selectionKey) return;
      if (appliedSelectionRasterRef.current === selectionRaster) return;
      selectionRaster.tiles.forEach((tile) => {
        const tileKey = `${tile.x}:${tile.y}`;
        const previousSprites = selectionTileSpritesRef.current.get(tileKey);
        if (previousSprites) {
          previousSprites.fillSprite.destroy();
          previousSprites.outlineSprite.destroy();
          previousSprites.fillTexture.destroy(true);
          previousSprites.outlineTexture.destroy(true);
        }
        const fillTexture = bitmapTexture(tile.fillBitmap);
        const outlineTexture = bitmapTexture(tile.outlineBitmap, "nearest");
        const fillSprite = new Sprite(fillTexture);
        const outlineSprite = new Sprite(outlineTexture);
        fillSprite.position.set(tile.x, tile.y);
        outlineSprite.position.set(tile.x, tile.y);
        selectionLayer.addChild(fillSprite, outlineSprite);
        selectionTileSpritesRef.current.set(tileKey, {
          fillSprite,
          outlineSprite,
          fillTexture,
          outlineTexture,
        });
      });
      appliedSelectionRasterRef.current = selectionRaster;
      return;
    }

    selectionCurrentKeyRef.current = undefined;
    syncSelectionWorker(`fallback:${selection.map(({ regionNumber }) => regionNumber).join(",")}`, selection.map(({ regionNumber }) => regionNumber));
    clearSelectionOverlay();
    selection.forEach((region) => {
      const cacheKey = selectionGraphicCacheKey(region, selectionScale);
      let graphic = selectionGraphicCacheRef.current.get(cacheKey);
      if (!graphic) {
        if (selectionGraphicCacheRef.current.size >= MAX_CACHED_SELECTION_GRAPHICS) {
          const oldestKey = selectionGraphicCacheRef.current.keys().next().value;
          if (oldestKey) {
            selectionGraphicCacheRef.current.get(oldestKey)?.destroy();
            selectionGraphicCacheRef.current.delete(oldestKey);
          }
        }
        graphic = selectedRegionGraphic(region, width, height, selectionScale);
        selectionGraphicCacheRef.current.set(cacheKey, graphic);
      }
      selectionLayer.addChild(graphic);
    });
  }, [
    contentRevision,
    height,
    ready,
    selectedFill,
    selectedOpacity,
    selectedPath,
    selectedRegions,
    selectionScale,
    selectionPixels,
    labelMap,
    regionBounds,
    queueSelectionWorkerRender,
    syncSelectionWorker,
    selectionRaster,
    width,
    destroySelectionTileSprites,
  ]);

  return <div ref={hostRef} className="pixi-preview" role="img" aria-label={ariaLabel} />;
}
