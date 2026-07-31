export interface Oklab {
  l: number;
  a: number;
  b: number;
}

const SRGB_TO_LINEAR = new Float64Array(256);
for (let value = 0; value < 256; value += 1) {
  const c = value / 255;
  SRGB_TO_LINEAR[value] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgbByte(linear: number) {
  const clamped = Math.max(0, Math.min(1, linear));
  const c = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
}

// Perceptually uniform color space (Björn Ottosson, 2020): Euclidean distance here tracks
// how different two colors look far better than raw RGB distance, which over-weights green
// and under-weights blue relative to human perception.
export function rgbToOklab(r: number, g: number, b: number): Oklab {
  const lr = SRGB_TO_LINEAR[r] ?? 0;
  const lg = SRGB_TO_LINEAR[g] ?? 0;
  const lb = SRGB_TO_LINEAR[b] ?? 0;

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    l: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export function oklabToRgb(lab: Oklab): [number, number, number] {
  const l_ = lab.l + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.l - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.l - 0.0894841775 * lab.a - 1.291485548 * lab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return [linearToSrgbByte(lr), linearToSrgbByte(lg), linearToSrgbByte(lb)];
}

export function oklabDistanceSquared(left: Oklab, right: Oklab) {
  const dl = left.l - right.l;
  const da = left.a - right.a;
  const db = left.b - right.b;
  return dl * dl + da * da + db * db;
}
