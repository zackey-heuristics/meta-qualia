import { useState } from "react";
import "./App.css";
import { ExifToolPanel } from "./components/ExifToolPanel";
import { FileLoader } from "./components/FileLoader";
import { ImageEditor } from "./components/ImageEditor";
import { MetadataPanel } from "./components/MetadataPanel";
import { useMetadata } from "./hooks/useMetadata";
import { formatBytes } from "./lib/formatBytes";
import type { LoadedFile } from "./lib/metadata/types";

function Workspace({ file, onClose }: { file: LoadedFile; onClose: () => void }) {
  const metadata = useMetadata(file);
  const isImage = metadata.status === "done" && (metadata.kind === "image" || metadata.kind === "svg");

  return (
    <div className="workspace">
      <div className="file-bar">
        <div className="file-bar__info">
          <strong>{file.name}</strong>
          <span>{formatBytes(file.size)}</span>
        </div>
        <button onClick={onClose}>別のファイルを開く</button>
      </div>
      <div className={`workspace__body${isImage ? "" : " workspace__body--metadata-only"}`}>
        {isImage && <ImageEditor file={file} key={file.name + file.size} />}
        <div className="side-panel">
          <MetadataPanel state={metadata} />
          <ExifToolPanel file={file} key={file.name + file.size} />
        </div>
      </div>
    </div>
  );
}

function App() {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Static Image &amp; Metadata Viewer</h1>
        <p>画像の明るさ/コントラスト調整・拡大表示と、あらゆるファイルのメタデータ閲覧をブラウザ内だけで行うOSINT向けツール</p>
      </header>

      {error && (
        <div className="app-error">
          {error}
          <button onClick={() => setError(null)}>閉じる</button>
        </div>
      )}

      {!file ? (
        <FileLoader
          busy={busy}
          setBusy={setBusy}
          onLoaded={(loaded) => {
            setError(null);
            setFile(loaded);
          }}
          onError={setError}
        />
      ) : (
        <Workspace file={file} onClose={() => setFile(null)} />
      )}
    </div>
  );
}

export default App;
