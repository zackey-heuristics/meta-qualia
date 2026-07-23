import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { LoadedFile, MetadataField, MetadataGroup, MetadataResult } from "./types";
import { baseFileGroup } from "./generic";
import { flattenToFields } from "./valueFormat";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// PDF spec (ISO 32000-1 Table 22) user-access permission bits.
const PERMISSION_LABELS: Record<number, string> = {
  4: "印刷",
  8: "内容の編集",
  16: "コピー/抽出",
  32: "注釈の追加/編集",
  256: "フォーム入力",
  512: "アクセシビリティ用の抽出",
  1024: "文書の組み立て(挿入/削除/回転)",
  2048: "高品質印刷",
};

export async function parsePdf(file: LoadedFile): Promise<MetadataResult> {
  const { fields: baseFields } = await baseFileGroup(file);
  const groups: MetadataGroup[] = [{ title: "ファイル情報", fields: baseFields }];
  const warnings: string[] = [];

  // pdfjs detaches/transfers the buffer it's given; pass a copy so callers
  // can still read file.bytes afterwards (e.g. for hex preview elsewhere).
  const loadingTask = getDocument({ data: file.bytes.slice() });
  try {
    const doc = await loadingTask.promise;

    const docFields: MetadataField[] = [
      { label: "ページ数", value: String(doc.numPages) },
      { label: "PDFフィンガープリント", value: doc.fingerprints.filter(Boolean).join(", ") || "(none)" },
    ];

    const permissions = await doc.getPermissions().catch(() => null);
    if (permissions) {
      const granted = Object.entries(PERMISSION_LABELS)
        .filter(([bit]) => permissions.includes(Number(bit)))
        .map(([, label]) => label);
      docFields.push({ label: "許可された操作", value: granted.length ? granted.join(", ") : "(none)" });
    } else {
      docFields.push({ label: "パスワード保護/権限", value: "制限なし、またはドキュメントに権限情報がありません" });
    }
    groups.push({ title: "PDFドキュメント情報", fields: docFields });

    const { info, metadata } = await doc.getMetadata();
    const infoFields = flattenToFields(info as Record<string, unknown>);
    if (infoFields.length > 0) {
      groups.push({ title: "Info辞書 (Title/Author/Producer等)", fields: infoFields });
    }

    if (metadata) {
      const xmpFields: MetadataField[] = [];
      for (const [key, value] of metadata as unknown as Iterable<[string, unknown]>) {
        if (value === undefined || value === null || value === "") continue;
        xmpFields.push({ label: key, value: typeof value === "string" ? value : JSON.stringify(value) });
      }
      if (xmpFields.length > 0) {
        groups.push({ title: "XMPメタデータ", fields: xmpFields });
      }
    }

  } catch (err) {
    warnings.push(`PDFの解析に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await loadingTask.destroy();
  }

  return { groups, warnings };
}
