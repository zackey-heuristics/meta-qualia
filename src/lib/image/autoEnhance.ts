const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export interface AutoEnhanceResult {
  brightness: number;
  contrast: number;
  saturation: number;
}

/**
 * Analyzes the source image (histogram of luminance + average saturation) and
 * derives brightness/contrast/saturation percentages for the existing sliders.
 * Runs on a small downsampled copy so it stays fast even for huge photos.
 */
export function analyzeAutoEnhance(bitmap: ImageBitmap): AutoEnhanceResult {
  const maxDim = 300;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { brightness: 100, contrast: 100, saturation: 100 };
  ctx.drawImage(bitmap, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  const lumHist = new Array<number>(256).fill(0);
  let satSum = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 8) continue; // ignore transparent pixels

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    lumHist[lum]++;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2 / 255;
    const s = max === min ? 0 : (max - min) / (l > 0.5 ? 510 - max - min : max + min);
    satSum += s;
    count++;
  }

  if (count === 0) return { brightness: 100, contrast: 100, saturation: 100 };

  // Robust dark/bright points: clip the outer 1% of pixels on each side so a few
  // stray black/white pixels don't dominate the contrast estimate.
  const clip = Math.max(1, Math.round(count * 0.01));
  let acc = 0;
  let p1 = 0;
  for (let v = 0; v < 256; v++) {
    acc += lumHist[v];
    if (acc >= clip) {
      p1 = v;
      break;
    }
  }
  acc = 0;
  let p99 = 255;
  for (let v = 255; v >= 0; v--) {
    acc += lumHist[v];
    if (acc >= clip) {
      p99 = v;
      break;
    }
  }

  let lumSum = 0;
  for (let v = 0; v < 256; v++) lumSum += v * lumHist[v];
  const meanLum = lumSum / count;

  // The rendering pipeline applies brightness() before contrast() (see buildFilterString),
  // so brightness runs first here too: fix overall exposure by scaling the mean toward
  // a comfortable midtone.
  const brightness = clamp(Math.round((128 / Math.max(1, meanLum)) * 100), 70, 200);
  const bFactor = brightness / 100;
  const scaledP1 = p1 * bFactor;
  const scaledP99 = p99 * bFactor;

  // CSS contrast() pivots at 128 (output = (input-128)*k+128), not at the image's own
  // black/white point, so an unconstrained stretch can push the dark side below 0
  // (crushing shadows to solid black) before the bright side even reaches 255. Solve
  // for the largest k that keeps both ends within [0, 255].
  let contrastFactor = 1.8;
  if (scaledP1 < 128) contrastFactor = Math.min(contrastFactor, 128 / Math.max(1, 128 - scaledP1));
  if (scaledP99 > 128) contrastFactor = Math.min(contrastFactor, 127 / Math.max(1, scaledP99 - 128));
  const contrast = clamp(Math.round(contrastFactor * 100), 100, 180);

  const meanSat = satSum / count;
  const targetSat = 0.45;
  // Only ever boost saturation, never mute it — an already-vivid photo shouldn't be washed out.
  const saturation = clamp(Math.round(100 + (targetSat - meanSat) * 160), 100, 160);

  return { brightness, contrast, saturation };
}
