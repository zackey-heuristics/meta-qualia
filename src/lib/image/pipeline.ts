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
