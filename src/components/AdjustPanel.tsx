import type { ImageEditorState } from "../hooks/useImageEditor";
import { DEFAULT_ADJUSTMENTS, type Adjustments } from "../lib/image/pipeline";

interface SliderDef {
  key: keyof Adjustments;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const TONE_SLIDERS: SliderDef[] = [
  { key: "brightness", label: "明度", min: 0, max: 300, step: 1, unit: "%" },
  { key: "contrast", label: "コントラスト", min: 0, max: 300, step: 1, unit: "%" },
  { key: "saturation", label: "彩度", min: 0, max: 300, step: 1, unit: "%" },
  { key: "hue", label: "色相", min: -180, max: 180, step: 1, unit: "°" },
];

const EFFECT_SLIDERS: SliderDef[] = [
  { key: "grayscale", label: "グレースケール", min: 0, max: 100, step: 1, unit: "%" },
  { key: "invert", label: "階調反転", min: 0, max: 100, step: 1, unit: "%" },
  { key: "sepia", label: "セピア", min: 0, max: 100, step: 1, unit: "%" },
  { key: "blur", label: "ぼかし", min: 0, max: 20, step: 0.5, unit: "px" },
];

function SliderRow({ def, editor }: { def: SliderDef; editor: ImageEditorState }) {
  const value = editor.adjustments[def.key];
  const changed = value !== DEFAULT_ADJUSTMENTS[def.key];
  return (
    <label className="slider-row">
      <span className="slider-label">{def.label}</span>
      <input
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => editor.updateAdjustment(def.key, Number(e.target.value))}
      />
      <span className={`slider-value${changed ? " slider-value--changed" : ""}`}>
        {value}
        {def.unit}
      </span>
    </label>
  );
}

export function AdjustPanel({ editor }: { editor: ImageEditorState }) {
  return (
    <div className="adjust-panel">
      <div className="adjust-panel__actions">
        <button className="adjust-auto-btn" onClick={editor.applyAutoEnhance} disabled={!editor.bitmap}>
          ✨ 自動調整
        </button>
        <button className="adjust-reset-btn" onClick={editor.resetEdits}>
          リセット
        </button>
      </div>

      <div className="adjust-section-label">色調</div>
      {TONE_SLIDERS.map((def) => (
        <SliderRow def={def} editor={editor} key={def.key} />
      ))}

      <div className="adjust-section-label adjust-section-label--spaced">効果</div>
      {EFFECT_SLIDERS.map((def) => (
        <SliderRow def={def} editor={editor} key={def.key} />
      ))}

      <div className="adjust-hint">
        変更中の値は<span className="adjust-hint__accent">紫</span>で表示。「リセット」で全て初期値に戻ります。
      </div>
    </div>
  );
}
