import * as exifr from "exifr";
import type { LoadedFile, MetadataGroup, MetadataResult } from "./types";
import { baseFileGroup } from "./generic";
import { flattenToFields } from "./valueFormat";

const GROUP_TITLES: Record<string, string> = {
  ifd0: "TIFF / IFD0",
  ifd1: "IFD1 (サムネイル)",
  exif: "EXIF",
  gps: "GPS",
  interop: "Interoperability",
  iptc: "IPTC",
  xmp: "XMP",
  icc: "ICCプロファイル",
  jfif: "JFIF",
  ihdr: "PNG ヘッダー",
};

const GROUP_ORDER = ["ifd0", "exif", "gps", "iptc", "xmp", "icc", "interop", "jfif", "ihdr", "ifd1"];

export async function parseImage(file: LoadedFile): Promise<MetadataResult> {
  const { fields: baseFields, sniffed } = await baseFileGroup(file);
  const groups: MetadataGroup[] = [{ title: "ファイル情報", fields: baseFields }];
  const warnings: string[] = [];

  let parsed: Record<string, unknown> | undefined;
  try {
    parsed = await exifr.parse(file.bytes, {
      mergeOutput: false,
      tiff: true,
      exif: true,
      gps: true,
      iptc: true,
      xmp: true,
      icc: true,
      jfif: true,
      ihdr: true,
      multiSegment: true,
      sanitize: true,
      reviveValues: true,
      translateKeys: true,
      translateValues: true,
    });
  } catch (err) {
    warnings.push(`EXIF/IPTC/XMP の解析に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!parsed || Object.keys(parsed).length === 0) {
    warnings.push("埋め込みメタデータ(EXIF/IPTC/XMP)が見つかりませんでした。");
  } else {
    for (const key of GROUP_ORDER) {
      const section = parsed[key];
      if (!section || typeof section !== "object") continue;
      const fields = flattenToFields(section as Record<string, unknown>);
      if (fields.length === 0) continue;

      if (key === "gps") {
        const gps = section as { latitude?: number; longitude?: number };
        if (typeof gps.latitude === "number" && typeof gps.longitude === "number") {
          fields.unshift({
            label: "地図で開く",
            value: `${gps.latitude}, ${gps.longitude}`,
            href: `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`,
          });
        }
      }

      groups.push({ title: GROUP_TITLES[key] ?? key, fields });
    }
  }

  if (sniffed && !sniffed.mime.startsWith("image/")) {
    warnings.push(`拡張子/内容から画像として検出されませんでした (検出結果: ${sniffed.mime})。`);
  }

  return { groups, warnings };
}
