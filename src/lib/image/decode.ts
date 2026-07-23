import { fileTypeFromBuffer } from "file-type";
import type { LoadedFile } from "../metadata/types";

async function resolveMime(file: LoadedFile): Promise<string> {
  if (file.reportedType === "image/svg+xml" || /\.svg$/i.test(file.name)) return "image/svg+xml";
  const sniffed = await fileTypeFromBuffer(file.bytes).catch(() => undefined);
  if (sniffed?.mime.startsWith("image/")) return sniffed.mime;
  if (file.reportedType.startsWith("image/")) return file.reportedType;
  // Last resort: text sniff for SVG served without a proper extension/content-type.
  const head = new TextDecoder("utf-8", { fatal: false }).decode(file.bytes.subarray(0, 1024));
  if (/<svg[\s>]/i.test(head)) return "image/svg+xml";
  return file.reportedType || "application/octet-stream";
}

export class UnsupportedImageError extends Error {}

/** SVG blobs can't be decoded by createImageBitmap() directly in most browsers; rasterize via <img> first. */
function decodeSvgViaImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVGの読み込みに失敗しました。"));
    };
    img.src = url;
  });
}

/** Decodes raster/SVG bytes into a pixel bitmap ready for canvas rendering. */
export async function decodeImage(file: LoadedFile): Promise<ImageBitmap> {
  const mime = await resolveMime(file);
  const blob = new Blob([file.bytes as BlobPart], { type: mime });
  try {
    if (mime === "image/svg+xml") {
      const img = await decodeSvgViaImageElement(blob);
      return await createImageBitmap(img);
    }
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch (err) {
    throw new UnsupportedImageError(
      `このブラウザでは画像形式 (${mime}) をデコードできませんでした。メタデータの解析は上記の通り実行済みです。` +
        (err instanceof Error ? ` (${err.message})` : ""),
    );
  }
}
