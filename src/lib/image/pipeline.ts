export interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  grayscale: number;
  invert: number;
  sepia: number;
  blur: number;
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  grayscale: 0,
  invert: 0,
  sepia: 0,
  blur: 0,
};

export interface Transform {
  rotation: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
}

export const DEFAULT_TRANSFORM: Transform = { rotation: 0, flipH: false, flipV: false };

export function buildFilterString(a: Adjustments): string {
  return [
    `brightness(${a.brightness}%)`,
    `contrast(${a.contrast}%)`,
    `saturate(${a.saturation}%)`,
    `hue-rotate(${a.hue}deg)`,
    `grayscale(${a.grayscale}%)`,
    `invert(${a.invert}%)`,
    `sepia(${a.sepia}%)`,
    a.blur > 0 ? `blur(${a.blur}px)` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Bakes adjustments + rotation/flip into the canvas's pixel buffer at native resolution. */
export function renderToCanvas(
  bitmap: ImageBitmap,
  canvas: HTMLCanvasElement,
  adjustments: Adjustments,
  transform: Transform,
): void {
  const swapped = transform.rotation === 90 || transform.rotation === 270;
  const width = swapped ? bitmap.height : bitmap.width;
  const height = swapped ? bitmap.width : bitmap.height;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.translate(width / 2, height / 2);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);
  ctx.filter = buildFilterString(adjustments);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  ctx.restore();
}

export type ExportFormat = "png" | "jpeg" | "webp";

export function exportCanvas(canvas: HTMLCanvasElement, format: ExportFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("画像の書き出しに失敗しました。"))),
      `image/${format}`,
      format === "png" ? undefined : quality,
    );
  });
}

const TILE_SIZE = 160;
const TILE_GRID = 3; // sample a 3x3 spread of tiles across the image

/**
 * Approximates the export size by encoding a handful of real, un-resampled tiles
 * cropped from across the canvas instead of the full-resolution image. Re-encoding
 * a multi-megapixel canvas on every adjustment tweak (this runs debounced, but still
 * on every slider change) is expensive enough on memory-constrained devices (notably
 * iOS Safari) to trigger an out-of-memory tab reload for large photos.
 *
 * Downscaling the whole image first (instead of cropping tiles) was tried and
 * rejected: shrinking a smooth gradient inflates the per-pixel delta between
 * neighboring pixels, which made lossless PNG compress far *worse* proportionally
 * than the source — a 6000x4000 gradient that PNG-encoded to 2MB estimated at 20MB.
 * Cropping real pixels at native resolution preserves the source's actual
 * compressibility, so the bytes-per-pixel ratio extrapolates much more faithfully
 * for both lossless and lossy formats.
 */
export async function estimateExportSize(
  sourceCanvas: HTMLCanvasElement,
  format: ExportFormat,
  quality: number,
): Promise<number> {
  const { width, height } = sourceCanvas;
  const totalPixels = width * height;
  const tileW = Math.min(TILE_SIZE, width);
  const tileH = Math.min(TILE_SIZE, height);

  if (totalPixels <= tileW * tileH * TILE_GRID * TILE_GRID) {
    const blob = await exportCanvas(sourceCanvas, format, quality);
    return blob.size;
  }

  const proxy = document.createElement("canvas");
  proxy.width = tileW * TILE_GRID;
  proxy.height = tileH * TILE_GRID;
  const ctx = proxy.getContext("2d");
  if (!ctx) {
    const blob = await exportCanvas(sourceCanvas, format, quality);
    return blob.size;
  }

  for (let gy = 0; gy < TILE_GRID; gy++) {
    for (let gx = 0; gx < TILE_GRID; gx++) {
      const srcX = Math.min(width - tileW, Math.max(0, Math.round(((gx + 0.5) / TILE_GRID) * width - tileW / 2)));
      const srcY = Math.min(height - tileH, Math.max(0, Math.round(((gy + 0.5) / TILE_GRID) * height - tileH / 2)));
      ctx.drawImage(sourceCanvas, srcX, srcY, tileW, tileH, gx * tileW, gy * tileH, tileW, tileH);
    }
  }

  const sampleBlob = await exportCanvas(proxy, format, quality);
  const bytesPerPixel = sampleBlob.size / (proxy.width * proxy.height);
  return Math.round(bytesPerPixel * totalPixels);
}
