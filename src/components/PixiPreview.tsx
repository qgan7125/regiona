import { useCallback, useEffect, useRef, useState } from "react";
import {
  Application,
  Container,
  Graphics,
  Sprite,
  Texture,
} from "pixi.js";

import { fitCamera, zoomCameraAtPoint } from "../preview/camera";

interface PixiPreviewProps {
  width: number;
  height: number;
  zoom: number;
  pixels?: Uint8ClampedArray;
  svgMarkup?: string;
  labelMap?: Uint32Array;
  onZoomChange: (zoom: number) => void;
  onSelectRegion?: (regionNumber: number) => void;
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

export function PixiPreview({
  width,
  height,
  zoom,
  pixels,
  svgMarkup,
  labelMap,
  onZoomChange,
  onSelectRegion,
  ariaLabel,
}: PixiPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Container | null>(null);
  const contentSizeRef = useRef({ width, height });
  const contentVersionRef = useRef(0);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const zoomRef = useRef(zoom);
  const reportedZoomRef = useRef(zoom);
  const onZoomChangeRef = useRef(onZoomChange);
  const onSelectRegionRef = useRef(onSelectRegion);
  const labelMapRef = useRef(labelMap);
  const fitRef = useRef<() => void>(() => undefined);

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
    onSelectRegionRef.current = onSelectRegion;
    labelMapRef.current = labelMap;
    fitRef.current = fitViewport;
  }, [fitViewport, labelMap, onSelectRegion, onZoomChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let initialized = false;
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
      viewportRef.current = viewport;
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
      });
      const endPointer = (event: { global: { x: number; y: number } }) => {
        const drag = dragRef.current;
        dragRef.current = null;
        app.canvas.style.cursor = "grab";
        if (!drag || drag.moved || !labelMapRef.current || !onSelectRegionRef.current) {
          return;
        }
        const imageX = Math.floor((event.global.x - viewport.x) / viewport.scale.x);
        const imageY = Math.floor((event.global.y - viewport.y) / viewport.scale.y);
        if (imageX < 0 || imageY < 0 || imageX >= width || imageY >= height) return;
        const regionNumber = labelMapRef.current[imageY * width + imageX] ?? 0;
        if (regionNumber) onSelectRegionRef.current(regionNumber);
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
      observer?.disconnect();
      if (handleWheel) app.canvas.removeEventListener("wheel", handleWheel);
      if (initialized) app.destroy({ removeView: true });
    };
  }, [height, width]);

  useEffect(() => {
    if (zoom === reportedZoomRef.current) return;
    zoomRef.current = zoom;
    reportedZoomRef.current = zoom;
    fitRef.current();
  }, [zoom]);

  useEffect(() => {
    const app = appRef.current;
    const viewport = viewportRef.current;
    if (!app || !viewport || !ready) return;

    const version = contentVersionRef.current + 1;
    contentVersionRef.current = version;
    viewport.removeChildren().forEach((child) => child.destroy());

    const addDisplayObject = (display: Sprite | Graphics) => {
      if (contentVersionRef.current !== version) {
        display.destroy();
        return;
      }
      viewport.addChild(display);
      contentSizeRef.current = { width, height };
      fitRef.current();
    };

    if (pixels) {
      const sprite = new Sprite(canvasTexture(pixels, width, height));
      addDisplayObject(sprite);
      return;
    }

    if (svgMarkup) {
      addDisplayObject(new Graphics().svg(svgMarkup));
      return;
    }

  }, [height, pixels, ready, svgMarkup, width]);

  return <div ref={hostRef} className="pixi-preview" role="img" aria-label={ariaLabel} />;
}
