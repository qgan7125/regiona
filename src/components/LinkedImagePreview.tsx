import { useEffect, useRef, useState } from "react";
import { Application, Container, Sprite, Texture } from "pixi.js";

import {
  comparisonCamera,
  panComparisonTransform,
  zoomComparisonTransformAtPoint,
  type ComparisonTransform,
} from "../preview/comparison-camera";

interface LinkedImagePreviewProps {
  sourceUrl: string;
  width: number;
  height: number;
  transform: ComparisonTransform;
  onTransformChange: (transform: ComparisonTransform) => void;
  onImageLoad?: (dimensions: { width: number; height: number }) => void;
  ariaLabel: string;
}

const minimumZoom = 25;
const maximumZoom = 800;

function clampZoom(zoom: number) {
  return Math.max(minimumZoom, Math.min(maximumZoom, zoom));
}

export function LinkedImagePreview({
  sourceUrl,
  width,
  height,
  transform,
  onTransformChange,
  onImageLoad,
  ariaLabel,
}: LinkedImagePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const viewportRef = useRef<Container | null>(null);
  const imageSizeRef = useRef({ width, height });
  const transformRef = useRef(transform);
  const onTransformChangeRef = useRef(onTransformChange);
  const applyTransformRef = useRef<(next: ComparisonTransform) => void>(() => undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onTransformChangeRef.current = onTransformChange;
  }, [onTransformChange]);

  useEffect(() => {
    imageSizeRef.current = { width, height };
    transformRef.current = transform;
    applyTransformRef.current(transform);
  }, [height, transform, width]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let initialized = false;
    let observer: ResizeObserver | undefined;
    let handleWheel: ((event: WheelEvent) => void) | undefined;
    const app = new Application();
    const drag = { active: false, x: 0, y: 0 };

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
      app.canvas.style.cursor = "grab";
      app.canvas.style.touchAction = "none";
      appRef.current = app;

      const viewport = new Container();
      viewportRef.current = viewport;
      app.stage.addChild(viewport);
      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;

      const applyTransform = (next: ComparisonTransform) => {
        transformRef.current = next;
        const camera = comparisonCamera(imageSizeRef.current, app.screen, next);
        viewport.scale.set(camera.scale);
        viewport.position.set(camera.x, camera.y);
      };
      applyTransformRef.current = applyTransform;
      applyTransform(transformRef.current);

      const publishTransform = (next: ComparisonTransform) => {
        applyTransform(next);
        onTransformChangeRef.current(next);
      };

      app.stage.on("pointerdown", (event) => {
        if (event.button !== 0) return;
        drag.active = true;
        drag.x = event.global.x;
        drag.y = event.global.y;
        app.canvas.style.cursor = "grabbing";
      });
      app.stage.on("globalpointermove", (event) => {
        if (!drag.active) return;
        const delta = { x: event.global.x - drag.x, y: event.global.y - drag.y };
        drag.x = event.global.x;
        drag.y = event.global.y;
        publishTransform(panComparisonTransform(
          imageSizeRef.current,
          app.screen,
          transformRef.current,
          delta,
        ));
      });
      const endDrag = () => {
        drag.active = false;
        app.canvas.style.cursor = "grab";
      };
      app.stage.on("pointerup", endDrag);
      app.stage.on("pointerupoutside", endDrag);

      handleWheel = (event) => {
        event.preventDefault();
        const bounds = app.canvas.getBoundingClientRect();
        const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
        const nextZoom = clampZoom(transformRef.current.zoom * Math.exp(-event.deltaY * 0.0015));
        publishTransform(zoomComparisonTransformAtPoint(
          imageSizeRef.current,
          app.screen,
          transformRef.current,
          point,
          nextZoom,
        ));
      };
      app.canvas.addEventListener("wheel", handleWheel, { passive: false });

      observer = new ResizeObserver(() => {
        app.renderer.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight));
        app.stage.hitArea = app.screen;
        applyTransform(transformRef.current);
      });
      observer.observe(host);
      setReady(true);
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      if (handleWheel) app.canvas.removeEventListener("wheel", handleWheel);
      if (appRef.current === app) appRef.current = null;
      if (viewportRef.current) viewportRef.current = null;
      if (initialized) app.destroy({ removeView: true });
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!ready || !viewport) return;

    let disposed = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (disposed) return;
      const texture = Texture.from(image);
      const sprite = new Sprite(texture);
      sprite.width = width;
      sprite.height = height;
      viewport.removeChildren().forEach((child) => child.destroy());
      viewport.addChild(sprite);
      onImageLoad?.({ width: image.naturalWidth, height: image.naturalHeight });
      applyTransformRef.current(transformRef.current);
    };
    image.src = sourceUrl;

    return () => {
      disposed = true;
      image.onload = null;
    };
  }, [height, onImageLoad, ready, sourceUrl, width]);

  return <div ref={hostRef} className="linked-image-preview" role="img" aria-label={ariaLabel} />;
}
