import { useState } from "react";
import type { FieldNode, FieldTreeNode } from "../lib/jsonExplorer";
import { NATIVE_FIELDS, buildFieldTree } from "../lib/jsonExplorer";
import type { ShellDict } from "../i18n";

type Props = {
  fields: FieldNode[];
  // The SHELL's dictionary: the field explorer is a piece of this app (the
  // package's is `<DesignerSidebar>`, which this example does not import). The
  // package's `t.tabBar.data` also says "Data"/"Dados", but it is the name of
  // one of its editor's TABS — another concept; reusing it here would tie a
  // tree section's title to the label of a tab this app does not even have.
  tt: ShellDict;
  // It adds without dragging — used by the "+" button on each row
  // (keyboard/touch, where drag-and-drop is of no use).
  onAdd: (field: FieldNode) => void;
};

const INDENT_PX = 12;

function iconFor(field: FieldNode): string {
  if (field.kind === "arraySource") return "▦";
  if (field.kind === "native") return "#";
  return "▤";
}

// The field tree: a fixed "Native variables" section (synthetic tokens such
// as pageNumber, always available) + the real JSON's fields, grouped by
// DataSource (each array becomes a group whose columns are individual
// children, each draggable/clickable — see
// lib/jsonExplorer.ts::buildFieldTree). Ordinary "folder" groups (a nested
// object, e.g. "company.address") have no action of their own, they only organize.
//
// Each row is draggable, and the payload is the whole FieldNode serialized
// into the dataTransfer — the same contract as report-builder. The difference
// is the other side: here the "drop" is OUR canvas (components/Canvas.tsx),
// which converts the mouse position into mm and hands it back to the App.
export default function FieldTree({ fields, tt, onAdd }: Props) {
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
        className={`tree-row tree-row--${field.kind}`}
        // O `title` de um campo do JSON é o CAMINHO de dado (`rows.total`) —
        // identificador, não texto de UI: sai igual nos dois idiomas.
        title={field.kind === "native" ? tt.tree.nativeTitle(field.path) : field.path}
      >
        <span className="tree-row-icon">{iconFor(field)}</span>
        {/* `label` é nome de campo/coluna do JSON — dado, não se traduz.
            (A exceção são os nativos, cujo rótulo legível é nosso; ver a
            chamada de `renderFieldRow` na seção de variáveis nativas.) */}
        <span className="tree-row-label">{label}</span>
        <button
          type="button"
          className="tree-row-add"
          title={tt.tree.addTitle}
          aria-label={tt.tree.addAria(label)}
          onClick={(e) => {
            e.stopPropagation();
            onAdd(field);
          }}
        >
          +
        </button>
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
        <div className="tree-group" style={{ marginLeft: depth * INDENT_PX }}>
          <button
            type="button"
            className="tree-toggle"
            onClick={() => toggleGroup(node.key)}
            aria-label={collapsed ? tt.tree.expandAria(node.label) : tt.tree.collapseAria(node.label)}
          >
            {collapsed ? "▸" : "▾"}
          </button>
          {node.field ? renderFieldRow(node.field, node.label, 0) : <span className="tree-group-label">{node.label}</span>}
        </div>
        {!collapsed && <ul className="tree-list">{node.children.map((child) => renderNode(child, depth + 1))}</ul>}
      </li>
    );
  }

  const tree = buildFieldTree(fields);

  return (
    <div className="panel">
      <div className="panel-title">{tt.tree.title}</div>
      <p className="panel-hint">{tt.tree.hint}</p>

      <div className="tree-scroll">
        <p className="tree-section">{tt.tree.nativeSection}</p>
        <ul className="tree-list">
          {NATIVE_FIELDS.map((f) => (
            // Único rótulo de campo que É traduzido: o token nativo não vem
            // do JSON do usuário, é um nome que ESTE app dá a uma variável do
            // motor. O `path` (`pageNumber`) segue sendo o identificador, e o
            // `f.label` do jsonExplorer fica como fallback em inglês.
            <li key={f.path}>{renderFieldRow(f, tt.tree.nativeLabels[f.path] ?? f.label, 0)}</li>
          ))}
        </ul>

        {tree.length > 0 && (
          <>
            <p className="tree-section">{tt.tree.dataSection}</p>
            <ul className="tree-list">{tree.map((node) => renderNode(node, 0))}</ul>
          </>
        )}
      </div>
    </div>
  );
}
