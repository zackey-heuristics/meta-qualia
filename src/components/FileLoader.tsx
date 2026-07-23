import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { loadFromFile } from "../lib/loadFile";
import type { LoadedFile } from "../lib/metadata/types";

interface Props {
  onLoaded: (file: LoadedFile) => void;
  onError: (message: string) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}

export function FileLoader({ onLoaded, onError, busy, setBusy }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const runLoad = async (task: () => Promise<LoadedFile>) => {
    setBusy(true);
    try {
      const loaded = await task();
      onLoaded(loaded);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    void runLoad(() => loadFromFile(file));
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="file-loader">
      <div
        className={`dropzone${isDragOver ? " dropzone--active" : ""}${busy ? " dropzone--busy" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p>
          {busy ? "読み込み中…" : "ファイルをドラッグ&ドロップ、またはクリックして選択"}
        </p>
        <p className="dropzone__hint">画像・PDF・Office文書・音声/動画・その他あらゆるファイル</p>
      </div>
    </div>
  );
}
