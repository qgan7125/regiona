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
import { clearRenderLayer } from "../preview/render-layers";

interface PixiPreviewProps {
  width: number;
  height: number;
  zoom: number;
  pixels?: Uint8ClampedArray;
  svgMarkup?: string;
  selectedPath?: string;
  selectedFill?: string;
  selectedOpacity?: number;
  labelMap?: Uint32Array;
  isViewLinked?: boolean;
  linkedCamera?: Camera;
  onZoomChange: (zoom: number) => void;
  onCameraChange?: (camera: Camera) => void;
  onSelectRegion?: (regionNumber: number) => void;
  onClearSelection?: () => void;
  ariaLabel: string;
}

const clampZoom = (zoom: number) => Math.max(50, Math.min(400, zoom));

function canvasTexture(pixels: Uint8ClampedArray, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Regiona could not create a preview canvas.");
  context.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);
  return Texture.from(canvas);
}

function selectedRegionGraphic(
  pathData: string,
  fill: string,
  opacity: number,
  width: number,
  height: number,
) {
  return new Graphics().svg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${pathData}" fill="${fill}" fill-opacity="${opacity}" /><path d="${pathData}" fill="none" stroke="#ffffff" stroke-width="3" /><path d="${pathData}" fill="none" stroke="#f25c35" stroke-width="1.5" /></svg>`,
  );
}

export function PixiPreview({
  width,
  height,
  zoom,
  pixels,
  svgMarkup,
  selectedPath,
  selectedFill,
  selectedOpacity = 1,
  labelMap,
  isViewLinked = false,
  linkedCamera,
  onZoomChange,
  onCameraChange,
  onSelectRegion,
  onClearSelection,
  ariaLabel,
}: PixiPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [contentRevision, setContentRevision] = useState(0);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Container | null>(null);
  const baseLayerRef = useRef<Container | null>(null);
  const selectionLayerRef = useRef<Container | null>(null);
  const contentSizeRef = useRef({ width, height });
  const contentVersionRef = useRef(0);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const zoomRef = useRef(zoom);
  const reportedZoomRef = useRef(zoom);
  const onZoomChangeRef = useRef(onZoomChange);
  const onCameraChangeRef = useRef(onCameraChange);
  const onSelectRegionRef = useRef(onSelectRegion);
  const onClearSelectionRef = useRef(onClearSelection);
  const labelMapRef = useRef(labelMap);
  const baseDisplayRef = useRef<Sprite | Graphics | null>(null);
  const fitRef = useRef<() => void>(() => undefined);
  const pixelTextureCacheRef = useRef(new WeakMap<Uint8ClampedArray, Texture>());
  const vectorGraphicCacheRef = useRef<
    { markup: string; graphic: Graphics } | undefined
  >(undefined);

  const textureForPixels = useCallback((imagePixels: Uint8ClampedArray) => {
    const cached = pixelTextureCacheRef.current.get(imagePixels);
    if (cached) return cached;
    const texture = canvasTexture(imagePixels, width, height);
    pixelTextureCacheRef.current.set(imagePixels, texture);
    return texture;
  }, [height, width]);

  const fitViewport = useCallback(() => {
    const app = appRef.current;
    const viewport = viewportRef.current;
    if (!app || !viewport) return;
    const camera = fitCamera(contentSizeRef.current, app.screen, zoomRef.current);
    viewport.scale.set(camera.scale);
    viewport.position.set(camera.x, camera.y);
  }, []);

  useEffect(() => {
    onZoomChangeRef.current = onZoomChange;
    onCameraChangeRef.current = onCameraChange;
    onSelectRegionRef.current = onSelectRegion;
    onClearSelectionRef.current = onClearSelection;
    labelMapRef.current = labelMap;
    fitRef.current = fitViewport;
  }, [
    fitViewport,
    labelMap,
    onCameraChange,
    onClearSelection,
    onSelectRegion,
    onZoomChange,
  ]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let initialized = false;
    let reportFrame = 0;
    let observer: ResizeObserver | undefined;
    let handleWheel: ((event: WheelEvent) => void) | undefined;
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
      viewportRef.current = viewport;
      baseLayerRef.current = baseLayer;
      selectionLayerRef.current = selectionLayer;
      viewport.addChild(baseLayer);
      viewport.addChild(selectionLayer);
      app.stage.addChild(viewport);
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;

      app.stage.on("pointerdown", (event) => {
        dragRef.current = { x: event.global.x, y: event.global.y, moved: false };
        app.canvas.style.cursor = "grabbing";
      });
      app.stage.on("globalpointermove", (event) => {
        const drag = dragRef.current;
        if (!drag) return;
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
      const endPointer = (event: { global: { x: number; y: number } }) => {
        const drag = dragRef.current;
        dragRef.current = null;
        app.canvas.style.cursor = "grab";
        if (!drag || drag.moved) {
          return;
        }
        const imageX = Math.floor((event.global.x - viewport.x) / viewport.scale.x);
        const imageY = Math.floor((event.global.y - viewport.y) / viewport.scale.y);
        if (imageX < 0 || imageY < 0 || imageX >= width || imageY >= height) {
          onClearSelectionRef.current?.();
          return;
        }
        const regionNumber = labelMapRef.current?.[imageY * width + imageX] ?? 0;
        if (regionNumber && onSelectRegionRef.current) {
          onSelectRegionRef.current(regionNumber);
        } else {
          onClearSelectionRef.current?.();
        }
      };
      app.stage.on("pointerup", endPointer);
      app.stage.on("pointerupoutside", endPointer);

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
        zoomRef.current = nextZoom;
        reportedZoomRef.current = nextZoom;
        onCameraChangeRef.current?.(camera);
        onZoomChangeRef.current(nextZoom);
      };
      app.canvas.addEventListener("wheel", handleWheel, { passive: false });
      app.canvas.style.cursor = "grab";

      observer = new ResizeObserver(() => {
        app.renderer.resize(
          Math.max(1, host.clientWidth),
          Math.max(1, host.clientHeight),
        );
        app.stage.hitArea = app.screen;
        fitRef.current();
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
      baseDisplayRef.current = null;
      vectorGraphicCacheRef.current = undefined;
      pixelTextureCacheRef.current = new WeakMap<Uint8ClampedArray, Texture>();
      observer?.disconnect();
      window.cancelAnimationFrame(reportFrame);
      if (handleWheel) app.canvas.removeEventListener("wheel", handleWheel);
      if (initialized) app.destroy({ removeView: true });
    };
  }, [height, width]);

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
  }, [linkedCamera]);

  useEffect(() => {
    const app = appRef.current;
    const viewport = viewportRef.current;
    const baseLayer = baseLayerRef.current;
    if (!app || !viewport || !baseLayer || !ready) return;

    const version = contentVersionRef.current + 1;
    contentVersionRef.current = version;
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
      fitRef.current();
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

    clearRenderLayer(selectionLayer);

    display.alpha = selectedPath ? 0.2 : 1;
    if (!selectedPath || !selectedFill) return;

    const overlay = selectedRegionGraphic(
      selectedPath,
      selectedFill,
      selectedOpacity,
      width,
      height,
    );
    selectionLayer.addChild(overlay);
  }, [
    contentRevision,
    height,
    ready,
    selectedFill,
    selectedOpacity,
    selectedPath,
    width,
  ]);

  return <div ref={hostRef} className="pixi-preview" role="img" aria-label={ariaLabel} />;
}
