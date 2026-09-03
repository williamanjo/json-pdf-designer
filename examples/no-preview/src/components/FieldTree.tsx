import { useState } from "react";
import type { Locale } from "json-pdf-designer";
import { t } from "../i18n";
import type { FieldNode, FieldTreeNode } from "../lib/jsonExplorer";
import { buildFieldTree, nativeFields } from "../lib/jsonExplorer";

type Props = {
  fields: FieldNode[];
  onAdd?: (field: FieldNode) => void;
  onOpenPicker?: () => void;
  // O MESMO `locale` do <Designer> (ver App.tsx).
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

// Árvore de campos: uma seção fixa "Variáveis nativas" (tokens sintéticos
// tipo pageNumber, sempre disponíveis) + os campos do JSON de verdade,
// agrupados por DataSource (cada array vira um grupo cujas colunas são
// filhos individuais, arrastáveis/clicáveis cada uma — ver
// lib/jsonExplorer.ts::buildFieldTree). Grupos "de pasta" comuns (objeto
// aninhado, ex: "empresa") não têm ação própria, só organizam.
//
// Cada linha de campo é arrastável (o FieldNode inteiro serializado no
// dataTransfer, pro DesignerPanel ler no "drop") e, quando `onAdd` é
// passado (modal "sem arrastar"), tem um botão "+".
//
// Cada elemento carrega a PRÓPRIA classe `.app-*`, sem depender de regra
// herdada do container: este componente é montado nos dois lugares (na
// barra lateral e dentro do modal, que renderiza no meio do `.app-main`
// junto do <Designer>), e regra de elemento escopada por container não
// alcançaria os dois — ver o comentário grande do src/index.css.
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
        // O `title` de campo do JSON é o PATH (`rows.total`) — dado, não
        // interface, então segue igual nos dois idiomas. Só a explicação do
        // token nativo é frase nossa.
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
            // `node.label` é nome de chave do JSON do usuário — dado.
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
            {/* `nativeFields(locale)` traduz só o RÓTULO; o `path` que vai pro
                template (`{pageNumber}`) é dado e não muda. */}
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
