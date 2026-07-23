import { useState } from "react";
import type { LoadedFile } from "../lib/metadata/types";
import type { ExifToolReadResult } from "../lib/exiftool/client";

type Status =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready" }
  | { phase: "applying" }
  | { phase: "error"; message: string };

type Preset = "none" | "strip-gps" | "strip-all";

interface CustomRow {
  id: string;
  tag: string;
  value: string;
}

let nextRowId = 0;

export function ExifToolPanel({ file }: { file: LoadedFile }) {
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [read, setRead] = useState<ExifToolReadResult | null>(null);
  const [editing, setEditing] = useState(false);
  const [preset, setPreset] = useState<Preset>("none");
  const [valueEdits, setValueEdits] = useState<Map<string, string>>(new Map());
  const [customRows, setCustomRows] = useState<CustomRow[]>([]);
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const load = async () => {
    setStatus({ phase: "loading" });
    setAppliedMessage(null);
    try {
      const { extractAllTags } = await import("../lib/exiftool/client");
      const result = await extractAllTags(file);
      setRead(result);
      setOpenGroups(new Set());
      setStatus({ phase: "ready" });
    } catch (err) {
      setStatus({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  const toggleGroup = (title: string, open: boolean) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (open) next.add(title);
      else next.delete(title);
      return next;
    });
  };

  const resetEdits = () => {
    setPreset("none");
    setValueEdits(new Map());
    setCustomRows([]);
  };

  const setValueEdit = (qualifiedName: string, value: string) => {
    setValueEdits((prev) => {
      const next = new Map(prev);
      next.set(qualifiedName, value);
      return next;
    });
  };

  const deleteTag = (qualifiedName: string) => setValueEdit(qualifiedName, "");

  const addCustomRow = () => setCustomRows((prev) => [...prev, { id: `row-${nextRowId++}`, tag: "", value: "" }]);
  const updateCustomRow = (id: string, patch: Partial<CustomRow>) =>
    setCustomRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeCustomRow = (id: string) => setCustomRows((prev) => prev.filter((r) => r.id !== id));

  const hasPendingEdits = preset !== "none" || valueEdits.size > 0 || customRows.some((r) => r.tag.trim());

  const apply = async () => {
    setStatus({ phase: "applying" });
    setAppliedMessage(null);
    try {
      const { writeTags, STRIP_GPS_EDIT, STRIP_ALL_EDIT } = await import("../lib/exiftool/client");
      const edits: { tag: string; value: string }[] = [];

      if (preset === "strip-all") {
        edits.push(STRIP_ALL_EDIT);
      } else {
        if (preset === "strip-gps") edits.push(STRIP_GPS_EDIT);
        const gpsQualifiedNames = new Set(read?.tags.filter((t) => t.group === "GPS").map((t) => t.qualifiedName));
        for (const [qualifiedName, value] of valueEdits) {
          if (preset === "strip-gps" && gpsQualifiedNames.has(qualifiedName)) continue;
          edits.push({ tag: qualifiedName, value });
        }
        for (const row of customRows) {
          if (!row.tag.trim()) continue;
          edits.push({ tag: row.tag.trim(), value: row.value });
        }
      }

      const bytes = await writeTags(file, edits);
      const blob = new Blob([bytes as BlobPart], { type: file.reportedType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dotIdx = file.name.lastIndexOf(".");
      const base = dotIdx > 0 ? file.name.slice(0, dotIdx) : file.name;
      const ext = dotIdx > 0 ? file.name.slice(dotIdx) : "";
      a.href = url;
      a.download = `${base}_exiftool${ext}`;
      a.click();
      URL.revokeObjectURL(url);

      setAppliedMessage(`変更を適用したファイルをダウンロードしました (${edits.length}件の操作)。`);
      resetEdits();
      setEditing(false);
      setStatus({ phase: "ready" });
    } catch (err) {
      setStatus({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="exiftool-panel">
      {status.phase === "idle" && (
        <p className="exiftool-hint">
          実際のExifTool(WASM)で全タグを読み取り、自由に編集・削除できます。初回のみ約5MBのダウンロードが発生します(以降はブラウザにキャッシュされます)。
        </p>
      )}

      {status.phase === "idle" && (
        <button className="exiftool-run-btn" onClick={() => void load()}>
          ExifToolで詳細解析を実行
        </button>
      )}

      {status.phase === "loading" && <p className="exiftool-loading">ExifTool (WASM) を読み込み中…</p>}

      {status.phase === "error" && (
        <>
          <p className="metadata-error">{status.message}</p>
          <button onClick={() => void load()}>再試行</button>
        </>
      )}

      {status.phase === "applying" && <p className="exiftool-loading">変更を書き込み中…</p>}

      {appliedMessage && <p className="exiftool-success">{appliedMessage}</p>}

      {read && (status.phase === "ready" || status.phase === "applying") && (
        <>
          <div className="exiftool-toolbar">
            <span>{read.tags.length}個のタグを検出</span>
            {read.mapsUrl && (
              <a href={read.mapsUrl} target="_blank" rel="noreferrer noopener">
                GPS位置を地図で開く
              </a>
            )}
            <button
              className="expand-toggle-btn"
              onClick={() =>
                setOpenGroups(
                  openGroups.size === read.groups.length ? new Set() : new Set(read.groups.map((g) => g.title)),
                )
              }
            >
              {openGroups.size === read.groups.length ? "すべて折りたたむ" : "すべて展開"}
            </button>
            <button onClick={() => setEditing((v) => !v)} disabled={status.phase === "applying"}>
              {editing ? "編集を終了" : "編集する"}
            </button>
          </div>

          {editing && (
            <div className="exiftool-edit-toolbar">
              <button
                className={preset === "strip-gps" ? "is-active" : ""}
                onClick={() => setPreset((p) => (p === "strip-gps" ? "none" : "strip-gps"))}
                disabled={status.phase === "applying"}
              >
                位置情報(GPS)を削除
              </button>
              <button
                className={preset === "strip-all" ? "is-active" : ""}
                onClick={() => setPreset((p) => (p === "strip-all" ? "none" : "strip-all"))}
                disabled={status.phase === "applying"}
              >
                全メタデータを削除
              </button>
              <button
                className="exiftool-apply-btn"
                onClick={() => void apply()}
                disabled={!hasPendingEdits || status.phase === "applying"}
              >
                変更を適用してダウンロード
              </button>
            </div>
          )}

          {editing && preset === "strip-all" && (
            <p className="metadata-warning">⚠ 全メタデータ削除が選択されているため、個別の編集は無視されます。</p>
          )}

          {editing && preset !== "strip-all" && (
            <div className="exiftool-custom-rows">
              <h3>カスタムタグを追加/削除</h3>
              {customRows.map((row) => (
                <div className="exiftool-custom-row" key={row.id}>
                  <input
                    placeholder="タグ名 (例: EXIF:Artist)"
                    value={row.tag}
                    onChange={(e) => updateCustomRow(row.id, { tag: e.target.value })}
                  />
                  <input
                    placeholder="値 (空欄で削除)"
                    value={row.value}
                    onChange={(e) => updateCustomRow(row.id, { value: e.target.value })}
                  />
                  <button onClick={() => removeCustomRow(row.id)}>×</button>
                </div>
              ))}
              <button onClick={addCustomRow}>+ タグを追加</button>
            </div>
          )}

          {read.groups.map((group) => (
            <details
              className="metadata-group"
              open={openGroups.has(group.title)}
              onToggle={(e) => toggleGroup(group.title, e.currentTarget.open)}
              key={group.title}
            >
              <summary>
                {group.title} <span className="metadata-group__count">{group.tags.length}</span>
              </summary>
              <table className="metadata-table">
                <tbody>
                  {group.tags.map((t) => {
                    const isGpsUnderStripAll = preset === "strip-all";
                    const isGpsUnderStripGps = preset === "strip-gps" && group.title === "GPS";
                    const disabled = !editing || isGpsUnderStripAll || isGpsUnderStripGps;
                    const currentValue = valueEdits.has(t.qualifiedName) ? valueEdits.get(t.qualifiedName)! : t.value;
                    const isDeleted = editing && valueEdits.get(t.qualifiedName) === "";
                    return (
                      <tr key={t.qualifiedName}>
                        <th>{t.tag}</th>
                        <td>
                          {editing ? (
                            <div className="exiftool-edit-cell">
                              <input
                                value={isGpsUnderStripAll || isGpsUnderStripGps ? "" : currentValue}
                                placeholder={isGpsUnderStripAll || isGpsUnderStripGps ? "(削除されます)" : undefined}
                                disabled={disabled}
                                className={isDeleted ? "is-deleted" : ""}
                                onChange={(e) => setValueEdit(t.qualifiedName, e.target.value)}
                              />
                              {!disabled && (
                                <button title="このタグを削除" onClick={() => deleteTag(t.qualifiedName)}>
                                  🗑
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="metadata-value">{t.value}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          ))}
        </>
      )}
    </div>
  );
}
