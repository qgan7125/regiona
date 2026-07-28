const DEFAULT_RADIUS = 2;
const DEFAULT_SIGMA_SPACE = 1.6;
const DEFAULT_SIGMA_COLOR = 24;

function buildSpatialWeights(radius: number, sigmaSpace: number) {
  const size = radius * 2 + 1;
  const weights = new Float64Array(size * size);
  const twoSigmaSpaceSquared = 2 * sigmaSpace * sigmaSpace;

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const distanceSquared = dx * dx + dy * dy;
      weights[(dy + radius) * size + (dx + radius)] = Math.exp(
        -distanceSquared / twoSigmaSpaceSquared,
      );
    }
  }

  return weights;
}

function buildRangeWeights(sigmaColor: number) {
  const weights = new Float64Array(256);
  const twoSigmaColorSquared = 2 * sigmaColor * sigmaColor;

  for (let difference = 0; difference < 256; difference += 1) {
    weights[difference] = Math.exp(-(difference * difference) / twoSigmaColorSquared);
  }

  return weights;
}

// Edge-preserving smoothing pass over the source pixels before quantization: averages
// each pixel with nearby pixels of a similar color, but leaves real color edges alone.
export function bilateralFilterPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  radius = DEFAULT_RADIUS,
  sigmaSpace = DEFAULT_SIGMA_SPACE,
  sigmaColor = DEFAULT_SIGMA_COLOR,
): Uint8ClampedArray {
  if (pixels.length !== width * height * 4) {
    return new Uint8ClampedArray(pixels);
  }

  const spatialWeights = buildSpatialWeights(radius, sigmaSpace);
  const rangeWeights = buildRangeWeights(sigmaColor);
  const size = radius * 2 + 1;
  const output = new Uint8ClampedArray(pixels.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const centerOffset = (y * width + x) * 4;
      const centerRed = pixels[centerOffset] ?? 0;
      const centerGreen = pixels[centerOffset + 1] ?? 0;
      const centerBlue = pixels[centerOffset + 2] ?? 0;

      let sumWeight = 0;
      let sumRed = 0;
      let sumGreen = 0;
      let sumBlue = 0;

      for (let dy = -radius; dy <= radius; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;

        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;

          const neighborOffset = (ny * width + nx) * 4;
          const red = pixels[neighborOffset] ?? 0;
          const green = pixels[neighborOffset + 1] ?? 0;
          const blue = pixels[neighborOffset + 2] ?? 0;

          const redWeight = rangeWeights[Math.abs(red - centerRed)] ?? 0;
          const greenWeight = rangeWeights[Math.abs(green - centerGreen)] ?? 0;
          const blueWeight = rangeWeights[Math.abs(blue - centerBlue)] ?? 0;
          const spatialWeight = spatialWeights[(dy + radius) * size + (dx + radius)] ?? 0;
          const weight = spatialWeight * redWeight * greenWeight * blueWeight;

          sumWeight += weight;
          sumRed += weight * red;
          sumGreen += weight * green;
          sumBlue += weight * blue;
        }
      }

      output[centerOffset] = sumWeight ? sumRed / sumWeight : centerRed;
      output[centerOffset + 1] = sumWeight ? sumGreen / sumWeight : centerGreen;
      output[centerOffset + 2] = sumWeight ? sumBlue / sumWeight : centerBlue;
      output[centerOffset + 3] = pixels[centerOffset + 3] ?? 255;
    }
  }

  return output;
}
