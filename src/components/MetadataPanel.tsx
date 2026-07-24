import { useEffect, useState } from "react";
import type { FileKind, MetadataGroup } from "../lib/metadata";
import type { MetadataState } from "../hooks/useMetadata";
import { useCopyToClipboard } from "../hooks/useCopyToClipboard";

function groupsToJson(groups: MetadataGroup[]): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {};
  for (const g of groups) {
    const fields: Record<string, string> = {};
    for (const f of g.fields) fields[f.label] = f.value;
    result[g.title] = fields;
  }
  return result;
}

const KIND_LABELS: Record<FileKind, string> = {
  image: "画像",
  svg: "SVG画像",
  pdf: "PDF文書",
  office: "Office/ODF/ZIP系文書",
  "audio-video": "音声/動画",
  generic: "汎用ファイル",
};

function GroupView({
  group,
  open,
  onToggle,
}: {
  group: MetadataGroup;
  open: boolean;
  onToggle: (open: boolean) => void;
}) {
  return (
    <details className="metadata-group" open={open} onToggle={(e) => onToggle(e.currentTarget.open)}>
      <summary>
        {group.title} <span className="metadata-group__count">{group.fields.length}</span>
      </summary>
      <table className="metadata-table">
        <tbody>
          {group.fields.map((f, i) => (
            <tr key={`${f.label}-${i}`}>
              <th>{f.label}</th>
              <td>
                {f.href ? (
                  <a href={f.href} target="_blank" rel="noreferrer noopener">
                    {f.value}
                  </a>
                ) : (
                  <span className={`metadata-value${f.mono ? " metadata-value--mono" : ""}`}>{f.value}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

export function MetadataPanel({ state }: { state: MetadataState }) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const { copy, status: copyStatus } = useCopyToClipboard();

  useEffect(() => {
    if (state.status === "done") {
      setOpenGroups(new Set(state.groups.slice(0, 2).map((g) => g.title)));
    }
  }, [state]);

  const toggleGroup = (title: string, open: boolean) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (open) next.add(title);
      else next.delete(title);
      return next;
    });
  };

  const groups = state.status === "done" ? state.groups : [];
  const allOpen = groups.length > 0 && openGroups.size === groups.length;

  return (
    <div className="metadata-panel">
      {state.status === "done" && groups.length > 0 && (
        <div className="panel-header">
          <button
            className="expand-toggle-btn"
            onClick={() => copy(JSON.stringify(groupsToJson(groups), null, 2))}
          >
            {copyStatus === "copied" ? "コピーしました" : copyStatus === "error" ? "コピー失敗" : "JSONをコピー"}
          </button>
          <button
            className="expand-toggle-btn"
            onClick={() => setOpenGroups(allOpen ? new Set() : new Set(groups.map((g) => g.title)))}
          >
            {allOpen ? "すべて折りたたむ" : "すべて展開"}
          </button>
        </div>
      )}
      {state.status === "loading" && <p className="metadata-loading">解析中…</p>}
      {state.status === "error" && <p className="metadata-error">{state.message}</p>}
      {state.status === "done" && (
        <>
          <p className="metadata-kind">検出種別: {KIND_LABELS[state.kind]}</p>
          {state.warnings.map((w, i) => (
            <p className="metadata-warning" key={i}>
              ⚠ {w}
            </p>
          ))}
          {groups.map((g) => (
            <GroupView group={g} open={openGroups.has(g.title)} onToggle={(open) => toggleGroup(g.title, open)} key={g.title} />
          ))}
        </>
      )}
    </div>
  );
}
