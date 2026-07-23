import { useEffect, useState } from "react";
import "./App.css";
import { AdjustPanel } from "./components/AdjustPanel";
import { ExifToolPanel } from "./components/ExifToolPanel";
import { FileLoader } from "./components/FileLoader";
import { ImageCanvas } from "./components/ImageCanvas";
import { MetadataPanel } from "./components/MetadataPanel";
import { useImageEditor } from "./hooks/useImageEditor";
import { useMetadata } from "./hooks/useMetadata";
import { useTheme } from "./hooks/useTheme";
import { formatBytes } from "./lib/formatBytes";
import type { LoadedFile } from "./lib/metadata/types";

type SidebarTab = "adjust" | "metadata" | "exiftool";

function AppBar({
  file,
  onClose,
  theme,
  onToggleTheme,
}: {
  file: LoadedFile | null;
  onClose: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  return (
    <div className="app-bar">
      <div className="app-bar__brand">
        <div className="app-bar__logo">Q</div>
        <div className="app-bar__name">Meta Qualia</div>
      </div>
      <div className="app-bar__right">
        {file && (
          <div className="app-bar__file">
            <div className="app-bar__file-info">
              <strong>{file.name}</strong>
              <span>{formatBytes(file.size)}</span>
            </div>
            <button onClick={onClose}>別のファイルを開く</button>
          </div>
        )}
        <button
          className="theme-toggle-btn"
          onClick={onToggleTheme}
          title={theme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え"}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>
    </div>
  );
}

function Workspace({ file }: { file: LoadedFile }) {
  const metadata = useMetadata(file);
  const isImage = metadata.status === "done" && (metadata.kind === "image" || metadata.kind === "svg");
  const editor = useImageEditor(file);
  const [tab, setTab] = useState<SidebarTab>("adjust");

  useEffect(() => {
    setTab("adjust");
  }, [file]);

  const effectiveTab: SidebarTab = isImage ? tab : tab === "adjust" ? "metadata" : tab;

  return (
    <div className="workspace">
      <div className={`workspace__body${isImage ? "" : " workspace__body--metadata-only"}`}>
        {isImage && <ImageCanvas editor={editor} />}
        <div className="side-panel">
          <div className="side-panel__tabs">
            {isImage && (
              <button
                className={`side-tab${effectiveTab === "adjust" ? " is-active" : ""}`}
                onClick={() => setTab("adjust")}
              >
                調整
              </button>
            )}
            <button
              className={`side-tab${effectiveTab === "metadata" ? " is-active" : ""}`}
              onClick={() => setTab("metadata")}
            >
              メタデータ
            </button>
            <button
              className={`side-tab${effectiveTab === "exiftool" ? " is-active" : ""}`}
              onClick={() => setTab("exiftool")}
            >
              ExifTool
            </button>
          </div>

          {isImage && (
            <div className={effectiveTab === "adjust" ? "side-tab-content" : "side-tab-content is-hidden"}>
              <AdjustPanel editor={editor} />
            </div>
          )}
          <div className={effectiveTab === "metadata" ? "side-tab-content" : "side-tab-content is-hidden"}>
            <MetadataPanel state={metadata} />
          </div>
          <div className={effectiveTab === "exiftool" ? "side-tab-content" : "side-tab-content is-hidden"}>
            <ExifToolPanel file={file} key={file.name + file.size} />
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app">
      <AppBar file={file} onClose={() => setFile(null)} theme={theme} onToggleTheme={toggleTheme} />

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
        <Workspace file={file} />
      )}
    </div>
  );
}

export default App;
