import type { LoadedFile } from "./metadata/types";

export async function loadFromFile(file: File): Promise<LoadedFile> {
  const buffer = await file.arrayBuffer();
  return {
    name: file.name,
    size: file.size,
    reportedType: file.type,
    bytes: new Uint8Array(buffer),
  };
}
