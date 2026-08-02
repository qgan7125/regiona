import type { Camera, Size } from "./camera";

export interface ComparisonTransform {
  zoom: number;
  center: { x: number; y: number };
}

export function comparisonCamera(
  image: Size,
  viewport: Size,
  transform: ComparisonTransform,
): Camera {
  const fitScale = Math.min(viewport.width / image.width, viewport.height / image.height);
  const scale = fitScale * (transform.zoom / 100);
  return {
    scale,
    x: viewport.width / 2 - image.width * scale * transform.center.x,
    y: viewport.height / 2 - image.height * scale * transform.center.y,
  };
}

export function zoomComparisonTransformAtPoint(
  image: Size,
  viewport: Size,
  transform: ComparisonTransform,
  point: { x: number; y: number },
  nextZoom: number,
): ComparisonTransform {
  const current = comparisonCamera(image, viewport, transform);
  const imagePoint = {
    x: (point.x - current.x) / current.scale,
    y: (point.y - current.y) / current.scale,
  };
  const nextScale = Math.min(viewport.width / image.width, viewport.height / image.height)
    * (nextZoom / 100);
  const nextCamera = {
    x: point.x - imagePoint.x * nextScale,
    y: point.y - imagePoint.y * nextScale,
  };
  return {
    zoom: nextZoom,
    center: {
      x: (viewport.width / 2 - nextCamera.x) / (image.width * nextScale),
      y: (viewport.height / 2 - nextCamera.y) / (image.height * nextScale),
    },
  };
}

export function panComparisonTransform(
  image: Size,
  viewport: Size,
  transform: ComparisonTransform,
  delta: { x: number; y: number },
): ComparisonTransform {
  const camera = comparisonCamera(image, viewport, transform);
  return {
    zoom: transform.zoom,
    center: {
      x: (viewport.width / 2 - (camera.x + delta.x)) / (image.width * camera.scale),
      y: (viewport.height / 2 - (camera.y + delta.y)) / (image.height * camera.scale),
    },
  };
}
