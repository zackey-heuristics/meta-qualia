import JSZip from "jszip";
import type { LoadedFile, MetadataGroup, MetadataResult } from "./types";
import { baseFileGroup } from "./generic";
import { xmlLeavesToFields } from "./xml";

const OOXML_PART_TITLES: Record<string, string> = {
  "docProps/core.xml": "コアプロパティ (作成者/タイトル等)",
  "docProps/app.xml": "アプリケーションプロパティ",
  "docProps/custom.xml": "カスタムプロパティ",
};

async function parseOoxml(zip: JSZip): Promise<MetadataGroup[]> {
  const groups: MetadataGroup[] = [];
  for (const [path, title] of Object.entries(OOXML_PART_TITLES)) {
    const entry = zip.file(path);
    if (!entry) continue;
    const xml = await entry.async("string");
    const fields = xmlLeavesToFields(xml);
    if (fields.length > 0) groups.push({ title, fields });
  }
  return groups;
}

async function parseOpenDocument(zip: JSZip): Promise<MetadataGroup[]> {
  const entry = zip.file("meta.xml");
  if (!entry) return [];
  const xml = await entry.async("string");
  const fields = xmlLeavesToFields(xml);
  return fields.length > 0 ? [{ title: "ODF メタデータ (meta.xml)", fields }] : [];
}

function zipContentsGroup(zip: JSZip): MetadataGroup {
  const all = Object.values(zip.files).filter((f) => !f.dir);
  const entries = all.slice(0, 100).map((f) => ({ label: f.name, value: f.date.toISOString() }));
  return { title: `ZIP内エントリ (${entries.length}/${all.length}件, 更新日時)`, fields: entries };
}

/** Handles OOXML (docx/xlsx/pptx), OpenDocument (odt/ods/odp), and falls back to a raw zip listing. */
export async function parseOfficeOrZip(file: LoadedFile): Promise<MetadataResult> {
  const { fields: baseFields } = await baseFileGroup(file);
  const groups: MetadataGroup[] = [{ title: "ファイル情報", fields: baseFields }];
  const warnings: string[] = [];

  try {
    const zip = await JSZip.loadAsync(file.bytes);
    const ooxmlGroups = await parseOoxml(zip);
    const odfGroups = await parseOpenDocument(zip);
    groups.push(...ooxmlGroups, ...odfGroups);

    if (ooxmlGroups.length === 0 && odfGroups.length === 0) {
      warnings.push("Office/ODF形式のメタデータ(docProps/meta.xml)が見つからないため、ZIP内のファイル一覧を表示します。");
      groups.push(zipContentsGroup(zip));
    }
  } catch (err) {
    warnings.push(`ZIP/Office文書の解析に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { groups, warnings };
}
