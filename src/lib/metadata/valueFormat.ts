import type { MetadataField } from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof Uint8Array);
}

function formatPrimitive(value: unknown): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? String(value) : value.toISOString().replace("T", " ").replace("Z", " UTC");
  }
  if (value instanceof Uint8Array) {
    return `<binary, ${value.length} bytes>`;
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  }
  if (Array.isArray(value)) {
    return value.map((item) => (isPlainObject(item) ? JSON.stringify(item) : formatPrimitive(item))).join(", ");
  }
  return String(value);
}

/** Recursively flattens an arbitrary metadata object (e.g. XMP) into dotted-path fields. */
export function flattenToFields(source: Record<string, unknown>, prefix = ""): MetadataField[] {
  const fields: MetadataField[] = [];
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null || value === "") continue;
    const label = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      fields.push(...flattenToFields(value, label));
    } else {
      fields.push({ label, value: formatPrimitive(value) });
    }
  }
  return fields;
}
