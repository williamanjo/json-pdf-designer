import { useState } from "react";
import { IconPlus, dictFor } from "json-pdf-designer";
import type { Locale } from "json-pdf-designer";
import { t } from "../i18n";
import type { FieldNode, FieldTreeNode } from "../lib/jsonExplorer";
import { buildFieldTree, nativeFields } from "../lib/jsonExplorer";

type Props = {
  fields: FieldNode[];
  onAdd?: (field: FieldNode) => void;
  locale: Locale;
};

const INDENT_PX = 12;

function iconFor(field: FieldNode): string {
  if (field.kind === "arraySource") return "▦";
  if (field.kind === "native") return "#";
  return "▤";
}

function rowKind(field: FieldNode): string {
  if (field.kind === "arraySource") return " app-field--source";
  if (field.kind === "native") return " app-field--native";
  return "";
}

// The field tree: a fixed "Native variables" section (synthetic tokens such
// as pageNumber, always available) + the real JSON's fields, grouped by
// DataSource (each array becomes a group whose columns are individual
// children, each draggable/clickable — see lib/jsonExplorer.ts::buildFieldTree).
// Ordinary "folder" groups (a nested object, e.g. "empresa") have no action of
// their own, they only organize.
//
// Each field row is draggable (the whole FieldNode serialized into the
// dataTransfer, for the DesignerProvider's `onCanvasDrop` to read on "drop")
// and, when `onAdd` is passed, has a "+" button to add it without dragging.
export default function FieldTree({ fields, onAdd, locale }: Props) {
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const ui = t(locale);
  // "Fields" is the PACKAGE's word (it is the label of its field panel) — it
  // comes from `dictFor`, and only the "from the JSON" is ours.
  const pacote = dictFor(locale);

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
        className={`app-field${rowKind(field)}`}
        // `field.path` cru no title dos outros kinds: é o caminho de dado, não
        // texto de UI.
        title={field.kind === "native" ? ui.nativoTitle(field.path) : field.path}
      >
        <span className="app-field__icon">{iconFor(field)}</span>
        <span className="app-field__label">{label}</span>
        {onAdd && (
          <button
            type="button"
            className="app-icon-btn app-field__add"
            title={ui.adicionarAoCanvas}
            onClick={(e) => {
              e.stopPropagation();
              onAdd(field);
            }}
          >
            <IconPlus />
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
        <div className="app-field-group" style={{ marginLeft: depth * INDENT_PX }}>
          <button
            type="button"
            className="app-icon-btn"
            onClick={() => toggleGroup(node.key)}
            // `node.label` é a chave do JSON — entra crua nos dois idiomas.
            aria-label={collapsed ? ui.expandir(node.label) : ui.colapsar(node.label)}
          >
            {collapsed ? "▸" : "▾"}
          </button>
          {node.field ? renderFieldRow(node.field, node.label, 0) : <span className="app-field-group__label">{node.label}</span>}
        </div>
        {!collapsed && <ul className="app-field-list">{node.children.map((child) => renderNode(child, depth + 1))}</ul>}
      </li>
    );
  }

  const tree = buildFieldTree(fields);

  return (
    <section className="app-card">
      <h2 className="app-h2">{ui.doJson(pacote.fieldsPanel.heading)}</h2>
      <p className="app-note">{ui.arvoreNota}</p>

      <div className="app-field-scroll">
        <p className="app-h3">{ui.variaveisNativas}</p>
        <ul className="app-field-list">
          {nativeFields(locale).map((f) => (
            <li key={f.path}>{renderFieldRow(f, f.label, 0)}</li>
          ))}
        </ul>

        {tree.length > 0 && (
          <>
            <p className="app-h3 app-h3--sep">{ui.grupoDados}</p>
            <ul className="app-field-list">{tree.map((node) => renderNode(node, 0))}</ul>
          </>
        )}
      </div>
    </section>
  );
}
