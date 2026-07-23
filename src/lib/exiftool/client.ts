import { parseMetadata, writeMetadata } from "@uswriting/exiftool";
import type { LoadedFile } from "../metadata/types";
import { cachedFetch } from "./wasmCache";
import { dmsToDecimal } from "./dms";

const GROUP_ORDER = ["File", "EXIF", "GPS", "IPTC", "XMP", "Composite", "MakerNotes", "ICC_Profile", "Photoshop", "JFIF", "PNG", "RIFF", "QuickTime", "ID3"];

function groupRank(group: string): number {
  const i = GROUP_ORDER.indexOf(group);
  return i === -1 ? GROUP_ORDER.length : i;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

/** A single extracted tag, addressable for editing as `${group}:${tag}`. */
export interface ExifTag {
  group: string;
  tag: string;
  qualifiedName: string;
  value: string;
}

export interface ExifTagGroup {
  title: string;
  tags: ExifTag[];
}

export interface ExifToolReadResult {
  tags: ExifTag[];
  groups: ExifTagGroup[];
  mapsUrl: string | null;
  raw: Record<string, unknown>;
}

function toBinaryfile(file: LoadedFile) {
  return { name: file.name, data: file.bytes };
}

/** Runs real ExifTool (via WASM) and returns every tag it finds, grouped for display and keyed for editing. */
export async function extractAllTags(file: LoadedFile): Promise<ExifToolReadResult> {
  const result = await parseMetadata<Record<string, unknown>[]>(toBinaryfile(file), {
    args: ["-json", "-G", "-a", "-u"],
    fetch: cachedFetch,
    transform: (data) => JSON.parse(data),
  });

  if (!result.success) {
    throw new Error(result.error || "ExifToolの実行に失敗しました。");
  }

  const raw = result.data[0] ?? {};
  const tags: ExifTag[] = [];
  const byGroup = new Map<string, ExifTag[]>();

  // Composite GPS values (e.g. "Composite:GPSLatitude") duplicate the raw EXIF GPS IFD
  // tags but with the hemisphere folded in and aren't independently writable, so they're
  // used only for the maps link below and skipped from the tag list to avoid duplicate rows.
  const compositeGps = new Map<string, string>();

  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null || value === "") continue;
    const colonIdx = key.indexOf(":");
    const originalGroup = colonIdx === -1 ? "File" : key.slice(0, colonIdx);
    const tag = colonIdx === -1 ? key : key.slice(colonIdx + 1);
    const formatted = formatValue(value);

    if (originalGroup === "Composite" && tag.startsWith("GPS")) {
      compositeGps.set(tag, formatted);
      continue;
    }

    // GPS tags live inside the EXIF IFD by default -G grouping; break them out into
    // their own "GPS" bucket so location data is easy to find/redact at a glance.
    const group = tag.startsWith("GPS") ? "GPS" : originalGroup;
    const entry: ExifTag = { group, tag, qualifiedName: `${originalGroup}:${tag}`, value: formatted };
    tags.push(entry);
    const list = byGroup.get(group) ?? [];
    list.push(entry);
    byGroup.set(group, list);
  }

  const groups: ExifTagGroup[] = [...byGroup.entries()]
    .sort((a, b) => groupRank(a[0]) - groupRank(b[0]))
    .map(([title, groupTags]) => ({ title, tags: groupTags }));

  const latDms = compositeGps.get("GPSLatitude") ?? tags.find((t) => t.tag === "GPSLatitude")?.value;
  const lonDms = compositeGps.get("GPSLongitude") ?? tags.find((t) => t.tag === "GPSLongitude")?.value;
  const latDec = latDms ? dmsToDecimal(latDms) : null;
  const lonDec = lonDms ? dmsToDecimal(lonDms) : null;
  const mapsUrl = latDec !== null && lonDec !== null ? `https://www.google.com/maps?q=${latDec},${lonDec}` : null;

  return { tags, groups, mapsUrl, raw };
}

export interface TagEdit {
  /** Tag reference as accepted by ExifTool: a bare name ("Author"), group-qualified ("EXIF:Artist"), or a group wildcard ("GPS:all"). */
  tag: string;
  /** Empty string deletes the tag (ExifTool's `-TAG=` syntax). */
  value: string;
}

/** Applies tag edits/deletions with ExifTool and returns the modified file bytes. Original bytes are untouched. */
export async function writeTags(file: LoadedFile, edits: TagEdit[]): Promise<Uint8Array> {
  if (edits.length === 0) {
    throw new Error("変更するタグがありません。");
  }
  const tags: Record<string, string> = {};
  for (const edit of edits) {
    tags[edit.tag] = edit.value;
  }

  const result = await writeMetadata(toBinaryfile(file), tags, { fetch: cachedFetch });
  if (!result.success) {
    throw new Error(result.error || "ExifToolでの書き込みに失敗しました。");
  }
  return new Uint8Array(result.data);
}

/** Preset: delete only the GPS group (location metadata). */
export const STRIP_GPS_EDIT: TagEdit = { tag: "GPS:all", value: "" };

/** Preset: delete every writable tag ExifTool knows about. */
export const STRIP_ALL_EDIT: TagEdit = { tag: "all", value: "" };
