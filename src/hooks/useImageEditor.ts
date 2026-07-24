import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import type { LoadedFile } from "../lib/metadata/types";
import { decodeImage } from "../lib/image/decode";
import { analyzeAutoEnhance } from "../lib/image/autoEnhance";
import {
  DEFAULT_ADJUSTMENTS,
  DEFAULT_TRANSFORM,
  estimateExportSize,
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

/**
 * Owns all image-editing state (decode, adjustments, transform, viewport, export)
 * so it can be shared between the canvas/toolbar (main area) and the adjustment
 * sliders (side panel tab), which render in different parts of the tree.
 */
export function useImageEditor(file: LoadedFile) {
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

  // Bake adjustments + rotation/flip into the canvas pixel buffer. Coalesced via
  // rAF so a rapid run of slider onChange events (dragging fires many per second)
  // triggers at most one full-resolution redraw per frame instead of one each.
  useEffect(() => {
    if (!bitmap || !canvasRef.current) return;
    const rafId = requestAnimationFrame(() => {
      if (canvasRef.current) renderToCanvas(bitmap, canvasRef.current, adjustments, transform);
    });
    return () => cancelAnimationFrame(rafId);
  }, [bitmap, adjustments, transform]);

  // Estimate the download size for the current format/quality. Debounced since
  // encoding a full-resolution JPEG/WebP on every slider tick would be wasteful.
  useEffect(() => {
    if (!bitmap || !canvasRef.current) return;
    setEstimating(true);
    const canvas = canvasRef.current;
    const timer = setTimeout(() => {
      estimateExportSize(canvas, exportFormat, quality)
        .then((size) => setEstimatedSize(size))
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

  const resetEdits = () => {
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setTransform(DEFAULT_TRANSFORM);
  };

  const rotate = (deg: 90 | 270) => {
    setTransform((prev) => ({ ...prev, rotation: ((prev.rotation + deg) % 360) as Transform["rotation"] }));
  };

  const toggleFlipH = () => setTransform((prev) => ({ ...prev, flipH: !prev.flipH }));
  const toggleFlipV = () => setTransform((prev) => ({ ...prev, flipV: !prev.flipV }));

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

  return {
    bitmap,
    decodeError,
    adjustments,
    updateAdjustment,
    transform,
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
    applyAutoEnhance,
    resetEdits,
    handleDownload,
  };
}

export type ImageEditorState = ReturnType<typeof useImageEditor>;
