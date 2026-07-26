interface Destroyable {
  destroy: () => void;
}

interface RenderLayer<T extends Destroyable> {
  removeChildren: () => T[];
}

/** Removes one render layer without touching its siblings. */
export function clearRenderLayer<T extends Destroyable>(layer: RenderLayer<T>) {
  layer.removeChildren().forEach((child) => child.destroy());
}
