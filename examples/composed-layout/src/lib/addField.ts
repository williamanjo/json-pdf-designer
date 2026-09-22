import {
  classifyZone,
  makeSectionColumnPair,
  tokenFor,
} from "json-pdf-designer";
import type { Binding, Schema, SectionSchema, TableSchema, Template, TextSchema } from "json-pdf-designer";
import type { FieldNode } from "./jsonExplorer";
import { sanitizeName } from "./jsonExplorer";
import { uid } from "./uid";

// It translates a field from the JSON explorer (a FieldNode) into an
// already-bound schema, and drops it on the canvas. Used by the FieldTree's
// drop (through the DesignerProvider's `onCanvasDrop`) and by the "+" button
// on each row of the tree.
//
// It lives in a lib, and not in the component, because this example's App.tsx
// is about LAYOUT — stuffing 80 lines of position arithmetic into the middle
// of it would hide the subject. (In report-builder this lives inside DesignerPanel.tsx.)

type Ctx = {
  // The ACTIVE page (it is what the DesignerProvider is editing).
  template: Template;
  bindings: Binding[];
  // The functional form of setState: it avoids losing a field if two are
  // added in quick succession (before the first re-render), since each call
  // computes the position from the most current state, not from a stale
  // closure.
  setTemplate: React.Dispatch<React.SetStateAction<Template>>;
  setBindings: React.Dispatch<React.SetStateAction<Binding[]>>;
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

// An individual column of a DataSource (dragged/clicked on its own, not the
// whole group) — it only comes in if a section bound to that same array (the
// same path) already exists; with no section, it does nothing (no creating a
// table or a loose field for a stray column). The position/name are computed
// once, outside the two functional callbacks, and reused in both — the only
// thing the two setStates need to share is THAT value, not the fresh state
// itself; each `prev` is still read from inside its own callback.
function addColumnToMatchingSection(field: Extract<FieldNode, { kind: "arrayColumn" }>, ctx: Ctx) {
  const sectionBinding = ctx.bindings.find(
    (b): b is Extract<Binding, { type: "section" }> => b.type === "section" && b.path === field.sourcePath
  );
  if (!sectionBinding) return;
  const section = ctx.template.schemas.find(
    (s): s is SectionSchema => s.type === "section" && s.name === sectionBinding.schemaName
  );
  if (!section) return;

  const members = ctx.template.schemas.filter((s) => s.sectionId === section.id);
  const y = members.length > 0 ? Math.max(...members.map((m) => m.y + m.height)) + 2 : section.y + 2;
  const x = section.x + 2;
  const { header, value, valueBinding } = makeSectionColumnPair(section.id, field.column, x, y);
  const bottom = y + Math.max(header.height, value.height);

  ctx.setTemplate((prev) => ({
    ...prev,
    schemas: prev.schemas
      .map((s) => (s.id === section.id && s.type === "section" && bottom - s.y > s.height ? { ...s, height: bottom - s.y } : s))
      .concat([header, value]),
  }));
  ctx.setBindings((prev) => [...prev, valueBinding]);
}

export function addFieldToCanvas(field: FieldNode, ctx: Ctx) {
  if (field.kind === "arrayColumn") {
    addColumnToMatchingSection(field, ctx);
    return;
  }

  const schemaName = `${sanitizeName(field.path)}_${Math.random().toString(36).slice(2, 6)}`;

  if (field.kind === "arraySource" && field.columns && field.columns.length > 0) {
    const columns = field.columns;
    ctx.setTemplate((prev) => {
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
    ctx.setBindings((prev) => [...prev, {
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
  ctx.setTemplate((prev) => {
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
  ctx.setBindings((prev) => [...prev, { schemaName, type: "template", template: content }]);
}

// Extrai do explorador os arrays de objetos e devolve no formato que o
// `dataSources` do DesignerProvider espera — é isso que troca o path digitado
// à mão por um dropdown no editor de vínculo.
export function dataSourcesFromFields(fields: FieldNode[]) {
  return fields
    .filter((f): f is Extract<FieldNode, { kind: "arraySource" }> => f.kind === "arraySource")
    .map((f) => ({ path: f.path, label: f.path, columns: f.columns, columnTypes: f.columnTypes }));
}
