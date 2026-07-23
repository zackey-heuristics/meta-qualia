import { fileTypeFromBuffer } from "file-type";
import type { LoadedFile, MetadataResult } from "./types";
import { parseImage } from "./image";
import { parseSvg } from "./svg";
import { parseGeneric } from "./generic";

const ZIP_CONTAINER_EXTS = new Set([
  "docx", "dotx", "xlsx", "xltx", "pptx", "potx",
  "odt", "ott", "ods", "ots", "odp", "otp",
  "epub", "zip", "jar", "apk", "aar",
]);

function looksLikeSvg(file: LoadedFile): boolean {
  if (file.reportedType === "image/svg+xml" || /\.svg$/i.test(file.name)) return true;
  const head = new TextDecoder("utf-8", { fatal: false }).decode(file.bytes.subarray(0, 1024));
  return /<svg[\s>]/i.test(head);
}

export type FileKind = "image" | "svg" | "pdf" | "office" | "audio-video" | "generic";

export async function detectFileKind(file: LoadedFile): Promise<FileKind> {
  if (looksLikeSvg(file)) return "svg";

  const sniffed = await fileTypeFromBuffer(file.bytes).catch(() => undefined);
  const mime = sniffed?.mime ?? file.reportedType;

  if (mime === "application/pdf") return "pdf";
  if (sniffed && ZIP_CONTAINER_EXTS.has(sniffed.ext)) return "office";
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("audio/") || mime?.startsWith("video/")) return "audio-video";
  return "generic";
}

export async function extractMetadata(file: LoadedFile): Promise<MetadataResult & { kind: FileKind }> {
  const kind = await detectFileKind(file);
  let result: MetadataResult;
  switch (kind) {
    case "image":
      result = await parseImage(file);
      break;
    case "svg":
      result = await parseSvg(file);
      break;
    case "pdf": {
      const { parsePdf } = await import("./pdf");
      result = await parsePdf(file);
      break;
    }
    case "office": {
      const { parseOfficeOrZip } = await import("./office");
      result = await parseOfficeOrZip(file);
      break;
    }
    case "audio-video": {
      const { parseAudioVideo } = await import("./audioVideo");
      result = await parseAudioVideo(file, file.reportedType || undefined);
      break;
    }
    default:
      result = await parseGeneric(file);
  }
  return { ...result, kind };
}

export type { MetadataResult, MetadataGroup, MetadataField, LoadedFile } from "./types";
