import { useState } from "react";
import type { FieldNode, FieldTreeNode } from "../lib/jsonExplorer";
import { nativeFields, buildFieldTree } from "../lib/jsonExplorer";
import { Button, Card, CardTitle, IconPlus } from "json-pdf-designer";
import type { Locale } from "json-pdf-designer";
import { t } from "../i18n";

type Props = {
  locale: Locale;
  fields: FieldNode[];
  onAdd?: (field: FieldNode) => void;
  onOpenPicker?: () => void;
};

const INDENT_PX = 14;

function iconFor(field: FieldNode): string {
  if (field.kind === "arraySource") return "▦";
  if (field.kind === "native") return "#";
  return "▤";
}

function rowClasses(field: FieldNode): string {
  if (field.kind === "arraySource") return "border-sky-200 bg-sky-50/60";
  if (field.kind === "native") return "border-amber-200 bg-amber-50/60";
  return "border-slate-200 bg-slate-50";
}

// Árvore de campos: uma seção fixa "Variáveis nativas" (tokens sintéticos
// tipo pageNumber, sempre disponíveis) + os campos do JSON de verdade,
// agrupados por DataSource (cada array vira um grupo cujas colunas são
// filhos individuais, arrastáveis/clicáveis cada uma — ver
// lib/jsonExplorer.ts::buildFieldTree). Grupos "de pasta" comuns (objeto
// aninhado, ex: "carta") não têm ação própria, só organizam.
//
// Cada linha de campo é arrastável (mesmo contrato de sempre: o FieldNode
// inteiro serializado no dataTransfer, pro DesignerPanel ler no "drop") e,
// quando `onAdd` é passado (modal "sem arrastar"), tem um botão "+".
export default function FieldTree({ locale, fields, onAdd, onOpenPicker }: Props) {
  const tx = t(locale);
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
        className={`flex flex-1 cursor-grab items-center gap-1.5 rounded-lg border p-2 text-xs transition-colors ${rowClasses(field)}`}
        // `field.path` sozinho não traduz — é o caminho no JSON (dado).
        title={field.kind === "native" ? tx.fieldNativeOnlyBands(field.path) : field.path}
      >
        <span className="text-slate-400">{iconFor(field)}</span>
        <span className="truncate font-medium text-slate-700">{label}</span>
        {onAdd && (
          <Button
            size="icon"
            className="ml-auto"
            title={tx.fieldAddToReport}
            onClick={(e) => {
              e.stopPropagation();
              onAdd(field);
            }}
          >
            <IconPlus />
          </Button>
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
        <div className="flex items-center gap-1" style={{ marginLeft: depth * INDENT_PX }}>
          <button
            type="button"
            onClick={() => toggleGroup(node.key)}
            // `node.label` é chave do JSON (dado) — entra na frase sem traduzir.
            aria-label={collapsed ? tx.fieldGroupExpandAria(node.label) : tx.fieldGroupCollapseAria(node.label)}
            className="shrink-0 rounded px-1 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            {collapsed ? "▸" : "▾"}
          </button>
          {node.field ? renderFieldRow(node.field, node.label, 0) : <span className="text-xs font-medium text-slate-600">{node.label}</span>}
        </div>
        {!collapsed && (
          <ul className="flex flex-col gap-1.5 pt-1.5">{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    );
  }

  const tree = buildFieldTree(fields);

  return (
    <Card className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
      <div className="flex items-center justify-between">
        <CardTitle>{tx.fieldsTitle}</CardTitle>
        {onOpenPicker && (
          <Button size="icon" title={tx.fieldsAddWithoutDrag} onClick={onOpenPicker}>
            <IconPlus />
          </Button>
        )}
      </div>
      <p className="text-[11px] text-slate-500">{tx.fieldsDragHint}</p>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tx.fieldsNativeGroup}</p>
          <ul className="flex flex-col gap-1.5">
            {nativeFields(tx).map((f) => (
              <li key={f.path}>{renderFieldRow(f, f.label, 0)}</li>
            ))}
          </ul>
        </div>

        {tree.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-slate-200 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tx.fieldsDataGroup}</p>
            <ul className="flex flex-col gap-1.5">{tree.map((node) => renderNode(node, 0))}</ul>
          </div>
        )}
      </div>
    </Card>
  );
}
