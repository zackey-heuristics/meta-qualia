import { useEffect, useState } from "react";
import type { LoadedFile } from "../lib/metadata/types";
import { extractMetadata, type FileKind, type MetadataGroup } from "../lib/metadata";

export type MetadataState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; kind: FileKind; groups: MetadataGroup[]; warnings: string[] };

export function useMetadata(file: LoadedFile): MetadataState {
  const [state, setState] = useState<MetadataState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    extractMetadata(file)
      .then((result) => {
        if (!cancelled) setState({ status: "done", ...result });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  return state;
}
