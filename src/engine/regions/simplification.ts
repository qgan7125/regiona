export type RegionSimplification = "off" | "subtle" | "balanced" | "strong";

const AREA_PER_MEGAPIXEL: Record<RegionSimplification, number> = {
  off: 0,
  subtle: 4,
  balanced: 12,
  strong: 36,
};

export function maximumAreaForSimplification(
  level: RegionSimplification,
  width: number,
  height: number,
) {
  const pixels = Math.max(0, width) * Math.max(0, height);
  const area = AREA_PER_MEGAPIXEL[level] * (pixels / 1_000_000);

  return level === "off" ? 0 : Math.max(1, Math.round(area));
}

export function simplificationLabel(level: RegionSimplification) {
  return level.charAt(0).toUpperCase() + level.slice(1);
}
