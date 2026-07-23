import { parseBuffer } from "music-metadata";
import type { LoadedFile, MetadataField, MetadataGroup, MetadataResult } from "./types";
import { baseFileGroup } from "./generic";
import { flattenToFields } from "./valueFormat";

function formatDuration(seconds?: number): string | undefined {
  if (!seconds || !Number.isFinite(seconds)) return undefined;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** Parses ID3/Vorbis/MP4-atom/RIFF/Matroska tags via music-metadata. Covers most audio and many video containers. */
export async function parseAudioVideo(file: LoadedFile, mimeHint?: string): Promise<MetadataResult> {
  const { fields: baseFields } = await baseFileGroup(file);
  const groups: MetadataGroup[] = [{ title: "ファイル情報", fields: baseFields }];
  const warnings: string[] = [];

  try {
    const metadata = await parseBuffer(file.bytes, mimeHint ? { mimeType: mimeHint, size: file.size } : undefined, {
      duration: true,
    });

    const { format, common, native } = metadata;

    const formatFields: MetadataField[] = [
      { label: "コンテナ", value: format.container ?? "(unknown)" },
      { label: "コーデック", value: format.codec ?? "(unknown)" },
      ...(format.duration ? [{ label: "長さ", value: formatDuration(format.duration)! }] : []),
      ...(format.bitrate ? [{ label: "ビットレート", value: `${Math.round(format.bitrate / 1000)} kbps` }] : []),
      ...(format.sampleRate ? [{ label: "サンプルレート", value: `${format.sampleRate} Hz` }] : []),
      ...(format.numberOfChannels ? [{ label: "チャンネル数", value: String(format.numberOfChannels) }] : []),
      ...(format.bitsPerSample ? [{ label: "ビット深度", value: String(format.bitsPerSample) }] : []),
      ...(typeof format.lossless === "boolean" ? [{ label: "ロスレス", value: format.lossless ? "はい" : "いいえ" }] : []),
      ...(format.tool ? [{ label: "エンコーダー", value: format.tool }] : []),
      { label: "検出されたタグ形式", value: format.tagTypes.length ? format.tagTypes.join(", ") : "(none)" },
    ];
    groups.push({ title: "フォーマット", fields: formatFields });

    const commonCopy: Record<string, unknown> = { ...common };
    if (Array.isArray(common.picture) && common.picture.length > 0) {
      commonCopy.picture = common.picture.map(
        (p) => `${p.format}, ${p.data.length.toLocaleString()} bytes${p.description ? `, "${p.description}"` : ""}`,
      );
    }
    const commonFields = flattenToFields(commonCopy);
    if (commonFields.length > 0) {
      groups.push({ title: "共通タグ (タイトル/アーティスト等)", fields: commonFields });
    } else {
      warnings.push("タイトルやアーティストなどの共通タグは見つかりませんでした。");
    }

    for (const [tagType, tags] of Object.entries(native)) {
      if (!tags || tags.length === 0) continue;
      const fields = tags.map((tag) => {
        const value = tag.value;
        const isPicture = value && typeof value === "object" && "data" in value && (value as { data: unknown }).data instanceof Uint8Array;
        if (isPicture) {
          const pic = value as { format?: string; data: Uint8Array };
          return { label: tag.id, value: `<embedded image: ${pic.format ?? "?"}, ${pic.data.length.toLocaleString()} bytes>` };
        }
        return { label: tag.id, value: typeof value === "string" ? value : JSON.stringify(value) };
      });
      groups.push({ title: `RAWタグ: ${tagType}`, fields });
    }
  } catch (err) {
    warnings.push(`音声/動画メタデータの解析に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { groups, warnings };
}
