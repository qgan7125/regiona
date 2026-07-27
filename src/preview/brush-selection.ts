export function regionNumbersInBrush(
  labelMap: Uint32Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number,
) {
  const regionNumbers = new Set<number>();
  const safeRadius = Math.max(0, radius);
  const radiusSquared = safeRadius * safeRadius;
  const minimumX = Math.max(0, Math.floor(centerX - safeRadius));
  const maximumX = Math.min(width - 1, Math.ceil(centerX + safeRadius));
  const minimumY = Math.max(0, Math.floor(centerY - safeRadius));
  const maximumY = Math.min(height - 1, Math.ceil(centerY + safeRadius));

  for (let y = minimumY; y <= maximumY; y += 1) {
    const deltaY = y - centerY;
    for (let x = minimumX; x <= maximumX; x += 1) {
      const deltaX = x - centerX;
      if (deltaX * deltaX + deltaY * deltaY > radiusSquared) continue;
      const regionNumber = labelMap[y * width + x] ?? 0;
      if (regionNumber) regionNumbers.add(regionNumber);
    }
  }

  return [...regionNumbers].sort((left, right) => left - right);
}
