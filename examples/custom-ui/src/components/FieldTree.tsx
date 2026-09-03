import { useState } from "react";
import type { Locale } from "json-pdf-designer";
import type { FieldNode, FieldTreeNode } from "../lib/jsonExplorer";
import { nativeFields, buildFieldTree } from "../lib/jsonExplorer";
import { t } from "../i18n";

type Props = {
  fields: FieldNode[];
  locale: Locale;
  onAdd?: (field: FieldNode) => void;
  onOpenPicker?: () => void;
};

const INDENT_PX = 14;

function iconFor(field: FieldNode): string {
  if (field.kind === "arraySource") return "▦";
  if (field.kind === "native") return "#";
  return "▤";
}

function rowClass(field: FieldNode): string {
  if (field.kind === "arraySource") return "field-row is-array";
  if (field.kind === "native") return "field-row is-native";
  return "field-row";
}

// Árvore de campos: uma seção fixa "Variáveis nativas" (tokens sintéticos
// tipo pageNumber, sempre disponíveis) + os campos do JSON de verdade,
// agrupados por DataSource (cada array vira um grupo cujas colunas são
// filhos individuais, arrastáveis/clicáveis cada uma — ver
// lib/jsonExplorer.ts::buildFieldTree). Grupos "de pasta" comuns (objeto
// aninhado, ex: "carta") não têm ação própria, só organizam.
//
// Cada linha de campo é arrastável (o FieldNode inteiro serializado no
// dataTransfer, pro DesignerPanel ler no "drop") e, quando `onAdd` é
// passado (modal "sem arrastar"), tem um botão "+".
//
// Toda a marcação aqui é HTML nativo + classes de src/index.css — nenhum
// Card/Button/ícone importado do pacote (é a premissa deste example).
export default function FieldTree({ fields, locale, onAdd, onOpenPicker }: Props) {
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const d = t(locale);

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
        // O `title` de um campo do JSON é o PATH cru (`rows.total`) — dado, e
        // é justamente o que a pessoa precisa ler. Só o aviso do campo nativo
        // é frase, e essa sim vem do dicionário.
        title={field.kind === "native" ? d.nativeOnlyInBands(field.path) : field.path}
      >
        <span className="field-row-icon">{iconFor(field)}</span>
        {/* `label` é dado: nome da chave do JSON ou da coluna do array. */}
        <span className="field-row-label">{label}</span>
        {onAdd && (
          <button
            type="button"
            className="btn-icon push-right"
            title={d.addToReport}
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
        <div className="tree-group-head" style={{ marginLeft: depth * INDENT_PX }}>
          <button
            type="button"
            onClick={() => toggleGroup(node.key)}
            aria-label={collapsed ? d.expandGroup(node.label) : d.collapseGroup(node.label)}
            className="tree-toggle"
          >
            {collapsed ? "▸" : "▾"}
          </button>
          {node.field ? renderFieldRow(node.field, node.label, 0) : <span className="tree-group-label">{node.label}</span>}
        </div>
        {!collapsed && <ul className="tree-list tree-children">{node.children.map((child) => renderNode(child, depth + 1))}</ul>}
      </li>
    );
  }

  const tree = buildFieldTree(fields);

  return (
    <section className="card card-grow">
      <div className="card-head">
        <h2 className="card-title">{d.fieldsTitle}</h2>
        {onOpenPicker && (
          <button type="button" className="btn-icon" title={d.addFieldNoDrag} onClick={onOpenPicker}>
            +
          </button>
        )}
      </div>
      <p className="hint">{d.fieldsHint}</p>

      <div className="tree-scroll">
        <div className="tree-section">
          <p className="tree-section-title">{d.nativeSection}</p>
          <ul className="tree-list">
            {/* O PATH do campo nativo (`pageNumber`) é token do motor e não
                muda; só o RÓTULO exibido sai do dicionário. */}
            {nativeFields(locale).map((f) => (
              <li key={f.path}>{renderFieldRow(f, f.label, 0)}</li>
            ))}
          </ul>
        </div>

        {tree.length > 0 && (
          <div className="tree-section tree-section-divided">
            <p className="tree-section-title">{d.dataSection}</p>
            <ul className="tree-list">{tree.map((node) => renderNode(node, 0))}</ul>
          </div>
        )}
      </div>
    </section>
  );
}
