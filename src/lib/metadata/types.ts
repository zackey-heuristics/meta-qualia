export interface MetadataField {
  label: string;
  value: string;
  /** Rendered as a clickable link when set (e.g. Google Maps for GPS coords). */
  href?: string;
}

export interface MetadataGroup {
  title: string;
  fields: MetadataField[];
}

export interface MetadataResult {
  groups: MetadataGroup[];
  warnings: string[];
}

export interface LoadedFile {
  name: string;
  size: number;
  /** MIME type reported by the browser / fetch response; may be empty or wrong. */
  reportedType: string;
  bytes: Uint8Array;
}
