export interface Size {
  width: number;
  height: number;
}

export interface Camera {
  scale: number;
  x: number;
  y: number;
}

export function fitCamera(image: Size, viewport: Size, zoom: number): Camera {
  const scale = Math.min(viewport.width / image.width, viewport.height / image.height)
    * (zoom / 100);
  return {
    scale,
    x: (viewport.width - image.width * scale) / 2,
    y: (viewport.height - image.height * scale) / 2,
  };
}

export function zoomCameraAtPoint(
  camera: Camera,
  point: { x: number; y: number },
  nextScale: number,
): Camera {
  const imageX = (point.x - camera.x) / camera.scale;
  const imageY = (point.y - camera.y) / camera.scale;
  return {
    scale: nextScale,
    x: point.x - imageX * nextScale,
    y: point.y - imageY * nextScale,
  };
}
