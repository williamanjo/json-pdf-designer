import { useEffect, useState } from "react";
import {
  Designer,
  classifyZone,
  dictFor,
  makeSectionColumnPair,
  tokenFor,
} from "json-pdf-designer";
import type { Binding, Locale, Schema, SectionSchema, TableSchema, Template, TextSchema } from "json-pdf-designer";
import type { FieldNode } from "../lib/jsonExplorer";
import { sanitizeName } from "../lib/jsonExplorer";
import { uid } from "../lib/uid";
import { t } from "../i18n";
import FieldTree from "./FieldTree";

type Props = {
  fields: FieldNode[];
  template: Template;
  bindings: Binding[];
  // It accepts React's functional setState form — it avoids losing a field
  // if two are added in quick succession (before the first re-render), since
  // each call computes the position from the most current state, not from a
  // stale closure.
  onChangeTemplate: React.Dispatch<React.SetStateAction<Template>>;
  onChangeBindings: React.Dispatch<React.SetStateAction<Binding[]>>;
  openFieldPickerRef?: React.MutableRefObject<(() => void) | null>;
  // Required: it feeds the <Designer> (the editor's chrome) AND the picker
  // modal here (the shell). Leaving it optional would let the modal fall back
  // to a fixed language without anyone noticing.
  locale: Locale;
};

function nextFreeY(schemas: Schema[]): number {
  if (schemas.length === 0) return 10;
  return Math.max(...schemas.map((s) => s.y + s.height)) + 5;
}

// It only stacks on top of BODY fields — without this, a footer (or
// header/margin) field already placed made the next field be born right below
// it (nextFreeY looked at everyone, including the red band), landing in that
// band by accident (a zone is only a position, not an intention).
function bodyPosition(template: Template, schemas: Schema[]): { x: number; y: number } {
  const { headerHeight = 0, footerHeight = 0, marginLeft = 0, marginRight = 0 } = template;
  const bands = { headerHeight, footerHeight, marginLeft, marginRight };
  const bodySchemas = schemas.filter((s) => classifyZone(s, template.page, bands) === "body");
  return { x: Math.max(10, marginLeft + 2), y: Math.max(nextFreeY(bodySchemas), headerHeight + 2) };
}

export default function DesignerPanel({
  fields,
  template,
  bindings,
  onChangeTemplate,
  onChangeBindings,
  openFieldPickerRef,
  locale,
}: Props) {
  const [showFieldPicker, setShowFieldPicker] = useState(false);
  const d = t(locale);

  useEffect(() => {
    if (openFieldPickerRef) openFieldPickerRef.current = () => setShowFieldPicker(true);
  }, [openFieldPickerRef]);

  // An individual column of a DataSource (dragged/clicked on its own, not
  // the whole group) — it only comes in if a section bound to that same array
  // (the same path) already exists; with no section, it does nothing (no
  // creating a table or a loose field for a stray column). The position/name
  // are computed once, outside the two functional callbacks, and reused in
  // both — the same pattern used below for the scalar field's
  // `schemaName`/`content` (the only thing the two setStates need to share is
  // THAT value, not the fresh state itself; each `prev` is still read from
  // inside its own callback).
  function addColumnToMatchingSection(field: Extract<FieldNode, { kind: "arrayColumn" }>) {
    const sectionBinding = bindings.find(
      (b): b is Extract<Binding, { type: "section" }> => b.type === "section" && b.path === field.sourcePath
    );
    if (!sectionBinding) return;
    const section = template.schemas.find(
      (s): s is SectionSchema => s.type === "section" && s.name === sectionBinding.schemaName
    );
    if (!section) return;

    const members = template.schemas.filter((s) => s.sectionId === section.id);
    const y = members.length > 0 ? Math.max(...members.map((m) => m.y + m.height)) + 2 : section.y + 2;
    const x = section.x + 2;
    const { header, value, valueBinding } = makeSectionColumnPair(section.id, field.column, x, y);
    const bottom = y + Math.max(header.height, value.height);

    onChangeTemplate((prev) => ({
      ...prev,
      schemas: prev.schemas
        .map((s) => (s.id === section.id && s.type === "section" && bottom - s.y > s.height ? { ...s, height: bottom - s.y } : s))
        .concat([header, value]),
    }));
    onChangeBindings((prev) => [...prev, valueBinding]);
  }

  // It creates the schema (text/table) already bound to the JSON's path and
  // drops it on the canvas — used both by the FieldTree's drop (the canvas)
  // and by the "+" of the field picker (the modal).
  function addFieldToCanvas(field: FieldNode) {
    if (field.kind === "arrayColumn") {
      addColumnToMatchingSection(field);
      return;
    }

    const schemaName = `${sanitizeName(field.path)}_${Math.random().toString(36).slice(2, 6)}`;

    if (field.kind === "arraySource" && field.columns && field.columns.length > 0) {
      const columns = field.columns;
      onChangeTemplate((prev) => {
        const pos = bodyPosition(prev, prev.schemas);
        const schema: TableSchema = {
          id: uid(),
          name: schemaName,
          type: "table",
          x: pos.x,
          y: pos.y,
          width: 180,
          height: 30,
          head: columns,
          // `tokenFor` do pacote, e NÃO o nome em caixa alta que estava aqui.
          //
          // `content[0][i]` é a fórmula da coluna, e é o que o gerador de PDF
          // usa antes de qualquer outra coisa. Um placeholder SEM chaves
          // ("DESCRICAO") não conta como template, então a tabela nascia sem
          // token: o `ƒx` de cada coluna abria vazio, e renomear o título
          // perdia a referência. Com o token, a referência mora na fórmula e
          // não depende do rótulo.
          content: [columns.map((c) => tokenFor(c))],
        };
        return { ...prev, schemas: [...prev.schemas, schema] };
      });
      onChangeBindings((prev) => [...prev, {
          schemaName,
          type: "array",
          path: field.path,
          // Sem coluna de chave crua: o rótulo e a referência viram campos
          // separados, então renomear um não mexe no outro.
          columns: columns.map((c) => ({ label: c, formula: tokenFor(c) })),
        }]);
      return;
    }

    if (field.kind === "arraySource") {
      // sem colunas (array de valores simples) — não cria nada
      return;
    }

    const content = `{${field.path}}`;
    onChangeTemplate((prev) => {
      const pos = bodyPosition(prev, prev.schemas);
      const schema: TextSchema = {
        id: uid(),
        name: schemaName,
        type: "text",
        x: pos.x,
        y: pos.y,
        width: 90,
        height: 8,
        content,
        fontSize: 11,
        fontColor: "#000000",
        alignment: "left",
      };
      return { ...prev, schemas: [...prev.schemas, schema] };
    });
    onChangeBindings((prev) => [...prev, { schemaName, type: "template", template: content }]);
  }

  function handleCanvasDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw) return;
    addFieldToCanvas(JSON.parse(raw) as FieldNode);
  }

  // Arrays já detectados no JSON de exemplo — vira dropdown "Data Source"
  // no vínculo de tabela (BindingEditor), em vez de path digitado livre.
  const dataSources = fields
    .filter((f): f is Extract<FieldNode, { kind: "arraySource" }> => f.kind === "arraySource")
    .map((f) => ({ path: f.path, label: f.path, columns: f.columns, columnTypes: f.columnTypes }));

  return (
    <div className="designer-stack">
      <Designer
        template={template}
        onChangeTemplate={onChangeTemplate}
        bindings={bindings}
        onChangeBindings={onChangeBindings}
        onCanvasDrop={handleCanvasDrop}
        dataSources={dataSources}
        locale={locale}
      />

      {showFieldPicker && (
        <div className="modal-overlay" onClick={() => setShowFieldPicker(false)}>
          <div className="modal modal-picker" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="modal-title">{d.fieldsTitle}</h3>
              {/* "Fechar" de modal é conceito DO PACOTE (ele já traduz o "x"
                  da própria casca de modal em `dict.modal.close`) — sai de
                  `dictFor` em vez de virar mais uma entrada nossa. */}
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowFieldPicker(false)}
                aria-label={dictFor(locale).modal.close}
              >
                ×
              </button>
            </div>
            <p className="hint">{d.pickerHint}</p>
            <div className="modal-body">
              <FieldTree
                fields={fields}
                locale={locale}
                onAdd={(field) => {
                  addFieldToCanvas(field);
                  setShowFieldPicker(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
