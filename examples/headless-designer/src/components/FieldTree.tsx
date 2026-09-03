import { useState } from "react";
import type { FieldNode, FieldTreeNode } from "../lib/jsonExplorer";
import { NATIVE_FIELDS, buildFieldTree } from "../lib/jsonExplorer";
import type { ShellDict } from "../i18n";

type Props = {
  fields: FieldNode[];
  // Dicionário da CASCA: o explorador de campos é peça deste app (o do
  // pacote é o `<DesignerSidebar>`, que este example não importa). O
  // `t.tabBar.data` do pacote também diz "Data"/"Dados", mas é o nome de uma
  // ABA do editor dele — outro conceito; reusá-lo aqui amarraria o título de
  // uma seção de árvore ao rótulo de uma aba que este app nem tem.
  tt: ShellDict;
  // Adiciona sem arrastar — usado pelo botão "+" de cada linha (teclado/
  // touch, onde drag-and-drop não serve).
  onAdd: (field: FieldNode) => void;
};

const INDENT_PX = 12;

function iconFor(field: FieldNode): string {
  if (field.kind === "arraySource") return "▦";
  if (field.kind === "native") return "#";
  return "▤";
}

// Árvore de campos: uma seção fixa "Native variables" (tokens sintéticos
// tipo pageNumber, sempre disponíveis) + os campos do JSON de verdade,
// agrupados por DataSource (cada array vira um grupo cujas colunas são
// filhos individuais, arrastáveis/clicáveis cada uma — ver
// lib/jsonExplorer.ts::buildFieldTree). Grupos "de pasta" comuns (objeto
// aninhado, ex: "company.address") não têm ação própria, só organizam.
//
// Cada linha é arrastável, e o payload é o FieldNode inteiro serializado no
// dataTransfer — mesmo contrato do report-builder. A diferença é o outro
// lado: aqui o "drop" é o NOSSO canvas (components/Canvas.tsx), que converte
// a posição do mouse em mm e devolve pro App montar o schema.
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
