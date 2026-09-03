import { classifyZone, makeSectionColumnPair } from "json-pdf-designer";
import type { Binding, Schema, SectionSchema, TableSchema, Template, TextSchema } from "json-pdf-designer";
import type { FieldNode } from "./jsonExplorer";
import { sanitizeName } from "./jsonExplorer";
import { uid } from "./uid";

// Traduz um campo do explorador de JSON (FieldNode) num schema já vinculado,
// e joga no canvas. Usado pelo drop do FieldTree (via `onCanvasDrop` do
// DesignerProvider) e pelo botão "+" de cada linha da árvore.
//
// Mora numa lib, e não no componente, porque o App.tsx deste example é sobre
// LAYOUT — enfiar 80 linhas de cálculo de posição no meio dele esconderia o
// assunto. (No report-builder isto vive dentro do DesignerPanel.tsx.)

type Ctx = {
  // Página ATIVA (é o que o DesignerProvider está editando).
  template: Template;
  bindings: Binding[];
  // Forma funcional do setState: evita perder um campo se dois forem
  // adicionados em sequência rápida (antes do primeiro re-render), já que
  // cada chamada calcula a posição a partir do estado mais atual, não de uma
  // closure velha.
  setTemplate: React.Dispatch<React.SetStateAction<Template>>;
  setBindings: React.Dispatch<React.SetStateAction<Binding[]>>;
};

function nextFreeY(schemas: Schema[]): number {
  if (schemas.length === 0) return 10;
  return Math.max(...schemas.map((s) => s.y + s.height)) + 5;
}

// Empilha só em cima de campos do CORPO — sem isso, um rodapé (ou
// cabeçalho/margem) já colocado fazia o próximo campo nascer logo abaixo
// dele (nextFreeY olhava todo mundo, inclusive faixa vermelha), caindo na
// própria faixa por acidente (zona é só posição, não intenção).
function bodyPosition(template: Template, schemas: Schema[]): { x: number; y: number } {
  const { headerHeight = 0, footerHeight = 0, marginLeft = 0, marginRight = 0 } = template;
  const bands = { headerHeight, footerHeight, marginLeft, marginRight };
  const bodySchemas = schemas.filter((s) => classifyZone(s, template.page, bands) === "body");
  return { x: Math.max(10, marginLeft + 2), y: Math.max(nextFreeY(bodySchemas), headerHeight + 2) };
}

// Coluna individual de um DataSource (arrastada/clicada sozinha, não o grupo
// inteiro) — só entra se já existir uma seção vinculada a esse mesmo array
// (mesmo path); sem seção, não faz nada (nada de criar tabela ou campo solto
// pra uma coluna avulsa). Posição/nome são calculados uma vez só, fora dos
// dois callbacks funcionais, e reaproveitados nos dois — a única coisa que os
// dois setState precisam compartilhar é ESSE valor, não o estado fresco em
// si; cada `prev` continua sendo lido de dentro do próprio callback.
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
        content: [columns.map((c) => c.toUpperCase())],
      };
      return { ...prev, schemas: [...prev.schemas, schema] };
    });
    ctx.setBindings((prev) => [...prev, { schemaName, type: "array", path: field.path, columns }]);
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
