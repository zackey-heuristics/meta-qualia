import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { LoadedFile } from "../lib/metadata/types";
import { decodeImage } from "../lib/image/decode";
import { analyzeAutoEnhance } from "../lib/image/autoEnhance";
import { formatBytes } from "../lib/formatBytes";
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_TRANSFORM,
  exportCanvas,
  renderToCanvas,
  type Adjustments,
  type ExportFormat,
  type Transform,
} from "../lib/image/pipeline";

const MIN_SCALE = 0.02;
const MAX_SCALE = 32;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface Viewport {
  scale: number;
  panX: number;
  panY: number;
}

interface SliderDef {
  key: keyof Adjustments;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const SLIDERS: SliderDef[] = [
  { key: "brightness", label: "明度", min: 0, max: 300, step: 1, unit: "%" },
  { key: "contrast", label: "コントラスト", min: 0, max: 300, step: 1, unit: "%" },
  { key: "saturation", label: "彩度", min: 0, max: 300, step: 1, unit: "%" },
  { key: "hue", label: "色相", min: -180, max: 180, step: 1, unit: "deg" },
  { key: "grayscale", label: "グレースケール", min: 0, max: 100, step: 1, unit: "%" },
  { key: "invert", label: "階調反転", min: 0, max: 100, step: 1, unit: "%" },
  { key: "sepia", label: "セピア", min: 0, max: 100, step: 1, unit: "%" },
  { key: "blur", label: "ぼかし", min: 0, max: 20, step: 0.5, unit: "px" },
];

interface Props {
  file: LoadedFile;
}

export function ImageEditor({ file }: Props) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);
  const [transform, setTransform] = useState<Transform>(DEFAULT_TRANSFORM);
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, panX: 0, panY: 0 });
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [quality, setQuality] = useState(0.92);
  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let localBitmap: ImageBitmap | null = null;
    setBitmap(null);
    setDecodeError(null);
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setTransform(DEFAULT_TRANSFORM);
    decodeImage(file)
      .then((bmp) => {
        if (cancelled) {
          bmp.close();
          return;
        }
        localBitmap = bmp;
        setBitmap(bmp);
      })
      .catch((err) => {
        if (!cancelled) setDecodeError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
      localBitmap?.close();
    };
  }, [file]);

  // Bake adjustments + rotation/flip into the canvas pixel buffer.
  useEffect(() => {
    if (!bitmap || !canvasRef.current) return;
    renderToCanvas(bitmap, canvasRef.current, adjustments, transform);
  }, [bitmap, adjustments, transform]);

  // Estimate the download size for the current format/quality. Debounced since
  // encoding a full-resolution JPEG/WebP on every slider tick would be wasteful.
  useEffect(() => {
    if (!bitmap || !canvasRef.current) return;
    setEstimating(true);
    const canvas = canvasRef.current;
    const timer = setTimeout(() => {
      exportCanvas(canvas, exportFormat, quality)
        .then((blob) => setEstimatedSize(blob.size))
        .catch(() => setEstimatedSize(null))
        .finally(() => setEstimating(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [bitmap, adjustments, transform, exportFormat, quality]);

  const fitToContainer = () => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || canvas.width === 0) return;
    const scale = Math.min(container.clientWidth / canvas.width, container.clientHeight / canvas.height, 1);
    setViewport({
      scale,
      panX: (container.clientWidth - canvas.width * scale) / 2,
      panY: (container.clientHeight - canvas.height * scale) / 2,
    });
  };

  // Re-fit the viewport whenever a new image loads or rotation swaps its dimensions.
  useEffect(() => {
    fitToContainer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bitmap, transform.rotation]);

  const zoomAt = (mx: number, my: number, factor: number) => {
    setViewport((prev) => {
      const newScale = clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE);
      const contentX = (mx - prev.panX) / prev.scale;
      const contentY = (my - prev.panY) / prev.scale;
      return { scale: newScale, panX: mx - contentX * newScale, panY: my - contentY * newScale };
    });
  };

  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.pow(1.0015, -e.deltaY));
  };

  const zoomButton = (factor: number) => {
    const container = containerRef.current;
    if (!container) return;
    zoomAt(container.clientWidth / 2, container.clientHeight / 2, factor);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: viewport.panX, panY: viewport.panY };
  };
  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setViewport((prev) => ({ ...prev, panX: dragRef.current!.panX + dx, panY: dragRef.current!.panY + dy }));
  };
  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const updateAdjustment = (key: keyof Adjustments, value: number) => {
    setAdjustments((prev) => ({ ...prev, [key]: value }));
  };

  const applyAutoEnhance = () => {
    if (!bitmap) return;
    const result = analyzeAutoEnhance(bitmap);
    setAdjustments((prev) => ({ ...prev, ...result }));
  };

  const rotate = (deg: 90 | 270) => {
    setTransform((prev) => ({ ...prev, rotation: ((prev.rotation + deg) % 360) as Transform["rotation"] }));
  };

  const handleDownload = async () => {
    if (!canvasRef.current) return;
    const blob = await exportCanvas(canvasRef.current, exportFormat, quality);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = file.name.replace(/\.[^./\\]+$/, "") || "image";
    a.href = url;
    a.download = `${base}_edited.${exportFormat === "jpeg" ? "jpg" : exportFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (decodeError) {
    return <div className="editor-error">{decodeError}</div>;
  }

  return (
    <div className="image-editor">
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button onClick={() => zoomButton(1 / 1.25)} title="縮小">
            −
          </button>
          <span className="zoom-readout">{Math.round(viewport.scale * 100)}%</span>
          <button onClick={() => zoomButton(1.25)} title="拡大">
            +
          </button>
          <button onClick={fitToContainer}>画面に合わせる</button>
          <button onClick={() => setViewport((prev) => ({ ...prev, scale: 1 }))}>100%</button>
        </div>
        <div className="toolbar-group">
          <button onClick={applyAutoEnhance} disabled={!bitmap} title="明度/コントラスト/彩度を自動調整">
            ✨ 自動調整
          </button>
          <button onClick={() => rotate(270)} title="反時計回りに90°回転">
            ⟲ 90°
          </button>
          <button onClick={() => rotate(90)} title="時計回りに90°回転">
            ⟳ 90°
          </button>
          <button onClick={() => setTransform((prev) => ({ ...prev, flipH: !prev.flipH }))} title="左右反転">
            ⇋ 左右
          </button>
          <button onClick={() => setTransform((prev) => ({ ...prev, flipV: !prev.flipV }))} title="上下反転">
            ⇵ 上下
          </button>
          <button
            onClick={() => {
              setAdjustments(DEFAULT_ADJUSTMENTS);
              setTransform(DEFAULT_TRANSFORM);
            }}
          >
            編集をリセット
          </button>
        </div>
        <div className="toolbar-group toolbar-group--export">
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)}>
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
          <button onClick={handleDownload} disabled={!bitmap}>
            ダウンロード
          </button>
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
      </div>

      <div className="editor-controls">
        {SLIDERS.map((s) => (
          <label className="slider-row" key={s.key}>
            <span className="slider-label">{s.label}</span>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={adjustments[s.key]}
              onChange={(e) => updateAdjustment(s.key, Number(e.target.value))}
            />
            <span className="slider-value">
              {adjustments[s.key]}
              {s.unit}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
