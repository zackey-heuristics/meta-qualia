import type { LoadedFile, MetadataGroup, MetadataResult } from "./types";
import { baseFileGroup } from "./generic";
import { xmlLeavesToFields } from "./xml";

/** SVG is text/XML, so magic-byte sniffing can't detect it; it can carry Dublin Core / RDF metadata like an image file. */
export async function parseSvg(file: LoadedFile): Promise<MetadataResult> {
  const { fields: baseFields } = await baseFileGroup(file);
  const groups: MetadataGroup[] = [{ title: "ファイル情報", fields: baseFields }];
  const warnings: string[] = [];

  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(file.bytes);
    const fields = xmlLeavesToFields(text);
    if (fields.length > 0) {
      groups.push({ title: "SVG内メタデータ (<metadata>/RDF等)", fields });
    } else {
      warnings.push("SVG内に<metadata>やRDFなどのメタデータ要素は見つかりませんでした。");
    }
  } catch (err) {
    warnings.push(`SVGの解析に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { groups, warnings };
}
