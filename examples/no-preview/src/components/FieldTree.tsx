import { useState } from "react";
import type { Locale } from "json-pdf-designer";
import { t } from "../i18n";
import type { FieldNode, FieldTreeNode } from "../lib/jsonExplorer";
import { buildFieldTree, nativeFields } from "../lib/jsonExplorer";

type Props = {
  fields: FieldNode[];
  onAdd?: (field: FieldNode) => void;
  onOpenPicker?: () => void;
  // The SAME `locale` as the <Designer> (see App.tsx).
  locale: Locale;
};

const INDENT_PX = 14;

function iconFor(field: FieldNode): string {
  if (field.kind === "arraySource") return "▦";
  if (field.kind === "native") return "#";
  return "▤";
}

function rowClass(field: FieldNode): string {
  if (field.kind === "arraySource") return "app-field-row is-array";
  if (field.kind === "native") return "app-field-row is-native";
  return "app-field-row";
}

// The field tree: a fixed "Native variables" section (synthetic tokens such
// as pageNumber, always available) + the real JSON's fields, grouped by
// DataSource (each array becomes a group whose columns are individual
// children, each draggable/clickable — see
// lib/jsonExplorer.ts::buildFieldTree). Ordinary "folder" groups (a nested
// object, e.g. "empresa") have no action of their own, they only organize.
//
// Each field row is draggable (the whole FieldNode serialized into the
// dataTransfer, for the DesignerPanel to read on "drop") and, when `onAdd` is
// passed (the "without dragging" modal), has a "+" button.
//
// Each element carries its OWN `.app-*` class, without depending on a rule
// inherited from the container: this component is mounted in two places (in
// the sidebar and inside the modal, which renders in the middle of `.app-main`
// next to the <Designer>), and an element rule scoped by container would not
// reach both — see the long comment in src/index.css.
export default function FieldTree({ fields, onAdd, onOpenPicker, locale }: Props) {
  const s = t(locale);
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  function onDragStart(e: React.DragEvent<HTMLDivElement>, field: FieldNode) {
    e.dataTransfer.setData("application/json", JSON.stringify(field));
    e.dataTransfer.effectAllowed = "copy";
  }

  function toggleGroup(key: string) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderFieldRow(field: FieldNode, label: string, depth: number) {
    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, field)}
        style={{ marginLeft: depth * INDENT_PX }}
        className={rowClass(field)}
        // A JSON field's `title` is the PATH (`rows.total`) — data, not
        // interface, so it stays the same in both languages. Only the native
        // token's explanation is a phrase of ours.
        title={field.kind === "native" ? s.fields.nativeTitle(field.path) : field.path}
      >
        <span className="app-field-row__icon">{iconFor(field)}</span>
        <span className="app-field-row__label">{label}</span>
        {onAdd && (
          <button
            type="button"
            className="app-icon-btn app-field-row__add"
            title={s.fields.add}
            onClick={(e) => {
              e.stopPropagation();
              onAdd(field);
            }}
          >
            +
          </button>
        )}
      </div>
    );
  }

  function renderNode(node: FieldTreeNode, depth: number) {
    if (node.type === "leaf") {
      return <li key={node.field.path}>{renderFieldRow(node.field, node.label, depth)}</li>;
    }

    const collapsed = collapsedKeys.has(node.key);
    return (
      <li key={node.key}>
        <div className="app-tree-group" style={{ marginLeft: depth * INDENT_PX }}>
          <button
            type="button"
            onClick={() => toggleGroup(node.key)}
            // `node.label` is the name of a key in the user's JSON — data.
            aria-label={collapsed ? s.fields.expand(node.label) : s.fields.collapse(node.label)}
            className="app-tree-toggle"
          >
            {collapsed ? "▸" : "▾"}
          </button>
          {node.field ? renderFieldRow(node.field, node.label, 0) : <span className="app-tree-group__label">{node.label}</span>}
        </div>
        {!collapsed && <ul className="app-tree-list">{node.children.map((child) => renderNode(child, depth + 1))}</ul>}
      </li>
    );
  }

  const tree = buildFieldTree(fields);

  return (
    <section className="app-panel app-panel--grow">
      <div className="app-panel__head">
        <span className="app-panel__title">{s.fields.title}</span>
        {onOpenPicker && (
          <button type="button" className="app-icon-btn" title={s.fields.openPicker} onClick={onOpenPicker}>
            +
          </button>
        )}
      </div>
      <p className="app-hint">{s.fields.hint}</p>

      <div className="app-tree-scroll">
        <div className="app-tree-section">
          <p className="app-tree-section__title">{s.fields.nativeSection}</p>
          <ul className="app-tree-list">
            {/* `nativeFields(locale)` translates only the LABEL; the `path`
                that goes into the template (`{pageNumber}`) is data and does
                not change. */}
            {nativeFields(locale).map((f) => (
              <li key={f.path}>{renderFieldRow(f, f.label, 0)}</li>
            ))}
          </ul>
        </div>

        {tree.length > 0 && (
          <div className="app-tree-section app-tree-section--divided">
            <p className="app-tree-section__title">{s.fields.dataSection}</p>
            <ul className="app-tree-list">{tree.map((node) => renderNode(node, 0))}</ul>
          </div>
        )}
      </div>
    </section>
  );
}
