import { formatBytes } from "../lib/formatBytes";
import type { ImageEditorState } from "../hooks/useImageEditor";
import type { ExportFormat } from "../lib/image/pipeline";

export function ImageCanvas({ editor }: { editor: ImageEditorState }) {
  const {
    bitmap,
    decodeError,
    viewport,
    exportFormat,
    setExportFormat,
    quality,
    setQuality,
    estimatedSize,
    estimating,
    canvasRef,
    containerRef,
    fitToContainer,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    zoomButton,
    rotate,
    toggleFlipH,
    toggleFlipV,
    handleDownload,
  } = editor;

  if (decodeError) {
    return <div className="editor-error">{decodeError}</div>;
  }

  return (
    <div className="image-editor">
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <div className="toolbar-group__row">
            <button className="toolbar-btn toolbar-btn--zoom" onClick={() => zoomButton(1 / 1.25)} title="縮小">
              −
            </button>
            <span className="zoom-readout">{Math.round(viewport.scale * 100)}%</span>
            <button className="toolbar-btn toolbar-btn--zoom" onClick={() => zoomButton(1.25)} title="拡大">
              +
            </button>
            <button className="toolbar-btn toolbar-btn--wide" onClick={fitToContainer}>
              全体
            </button>
          </div>
          <span className="toolbar-group__label">表示</span>
        </div>

        <div className="toolbar-divider" />

        <div className="toolbar-group">
          <div className="toolbar-group__row">
            <button className="toolbar-btn toolbar-btn--icon" onClick={() => rotate(270)} title="反時計回りに90°回転">
              ⟲
            </button>
            <button className="toolbar-btn toolbar-btn--icon" onClick={() => rotate(90)} title="時計回りに90°回転">
              ⟳
            </button>
            <button className="toolbar-btn toolbar-btn--icon" onClick={toggleFlipH} title="左右反転">
              ⇋
            </button>
            <button className="toolbar-btn toolbar-btn--icon" onClick={toggleFlipV} title="上下反転">
              ⇵
            </button>
          </div>
          <span className="toolbar-group__label">回転・反転</span>
        </div>

        <div className="toolbar-group toolbar-group--export">
          <div className="toolbar-group__row">
            <select
              className="toolbar-select"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
            {exportFormat !== "png" && (
              <>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.01}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                />
                <span className="quality-readout">{Math.round(quality * 100)}%</span>
              </>
            )}
            <span className={`size-readout${estimating ? " is-estimating" : ""}`}>
              {estimatedSize !== null ? `≈ ${formatBytes(estimatedSize)}` : bitmap ? "計算中…" : ""}
            </span>
            <button className="toolbar-btn toolbar-btn--primary" onClick={() => void handleDownload()} disabled={!bitmap}>
              ダウンロード
            </button>
          </div>
          <span className="toolbar-group__label">書き出し</span>
        </div>
      </div>

      <div
        className="editor-canvas-wrap"
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {!bitmap && <div className="editor-loading">画像を読み込み中…</div>}
        <canvas
          ref={canvasRef}
          style={{
            transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.scale})`,
            transformOrigin: "0 0",
            visibility: bitmap ? "visible" : "hidden",
          }}
        />
        {bitmap && (
          <div className="canvas-info-chip">
            {bitmap.width} × {bitmap.height}
          </div>
        )}
      </div>
    </div>
  );
}
