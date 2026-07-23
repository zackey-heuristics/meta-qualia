import { fileTypeFromBuffer } from "file-type";
import type { LoadedFile, MetadataResult } from "./types";
import { sha1Hex, sha256Hex } from "./hash";
import { formatBytes } from "../formatBytes";

function hexPreview(bytes: Uint8Array, length = 256): string {
  const slice = bytes.subarray(0, length);
  const lines: string[] = [];
  for (let offset = 0; offset < slice.length; offset += 16) {
    const chunk = slice.subarray(offset, offset + 16);
    const hex = [...chunk].map((b) => b.toString(16).padStart(2, "0")).join(" ").padEnd(47, " ");
    const ascii = [...chunk].map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${offset.toString(16).padStart(8, "0")}  ${hex}  ${ascii}`);
  }
  return lines.join("\n");
}

/** Base file info + hashes + hex preview, shared by every parser as the first group. */
export async function baseFileGroup(file: LoadedFile) {
  const sniffed = await fileTypeFromBuffer(file.bytes).catch(() => undefined);
  const [sha256, sha1] = await Promise.all([sha256Hex(file.bytes), sha1Hex(file.bytes)]);

  const fields = [
    { label: "ファイル名", value: file.name || "(no name)" },
    { label: "サイズ", value: `${formatBytes(file.size)} (${file.size.toLocaleString()} bytes)` },
    { label: "報告されたMIMEタイプ", value: file.reportedType || "(unknown)" },
    {
      label: "検出されたファイル種別",
      value: sniffed ? `${sniffed.mime} (.${sniffed.ext})` : "判定できませんでした",
    },
    { label: "SHA-256", value: sha256 },
    { label: "SHA-1", value: sha1 },
  ];

  return { sniffed, fields };
}

/** Fallback parser for file types with no dedicated parser. */
export async function parseGeneric(file: LoadedFile): Promise<MetadataResult> {
  const { fields } = await baseFileGroup(file);
  return {
    groups: [
      { title: "ファイル情報", fields },
      {
        title: "先頭バイトプレビュー (hex/ascii)",
        fields: [{ label: "0x0000-", value: hexPreview(file.bytes), mono: true }],
      },
    ],
    warnings: ["この種類のファイル専用のメタデータパーサーは未対応のため、汎用情報のみ表示しています。"],
  };
}
