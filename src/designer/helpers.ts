import type { Binding, DataSourceColumnType, DataSourceOption, Schema, SectionSchema, Template } from "../types";
import { snapToGrid } from "../page/units";

// Pure functions extracted from Designer.tsx — they depend only on the
// parameters they receive, never on React state captured by a closure. They
// live in a .ts module (not .tsx) for two reasons: they can be tested
// directly, without mounting any component, and a .tsx may only export
// components (otherwise Fast Refresh breaks, see the oxlint
// react(only-export-components) rule) — same pattern as src/bindings/builders.ts.

// While isolated (Designer isolateBands), a new field is born inside the
// first available red band (header > footer > left margin > right) instead
// of at the default position in the body — otherwise it would be born
// hidden. maxHeight/maxWidth caps the schema's default size (e.g. a 30mm
// table) so it does not overflow the band and fall back into the body by
// its own height. `null` when no band has room (>2mm) to take a new
// field.
export function bandSpawnPosition(
  template: Template
): { x: number; y: number; maxHeight?: number; maxWidth?: number } | null {
  const { headerHeight = 0, footerHeight = 0, marginLeft = 0, marginRight = 0, page } = template;
  if (headerHeight > 2) return { x: marginLeft + 2, y: 2, maxHeight: headerHeight - 3 };
  if (footerHeight > 2) return { x: marginLeft + 2, y: page.height - footerHeight + 2, maxHeight: footerHeight - 3 };
  if (marginLeft > 2) return { x: 2, y: 2, maxWidth: marginLeft - 3 };
  if (marginRight > 2) return { x: page.width - marginRight + 2, y: 2, maxWidth: marginRight - 3 };
  return null;
}

// The birth position of a new field (Designer.addSchema) — two modes:
// isolated (inside the red band, see bandSpawnPosition) or normal (always
// at the CENTER of the body area, it no longer stacks below the last
// field). Stacking depended on nextFreeY looking only at fields already
// classified as "body" (classifyZone), but that classification is purely
// GEOMETRIC: a footer field positioned slightly outside the configured
// footerHeight (e.g. y less than page.height-footerHeight) counted as body
// by accident, became the new "floor", and every new field was born stacked
// right below it — including off the page, each "+" click pushing further
// down in sequence. Being born at the center removes that dependency: the
// next field's position no longer depends on where the other fields
// (misclassified or not) already are.
export function computeSpawnPosition(template: Template, schema: Schema, isolateBands: boolean, gridMm?: number): Schema {
  if (isolateBands) {
    const spawn = bandSpawnPosition(template);
    if (!spawn) return schema;
    const placed = { ...schema, x: spawn.x, y: spawn.y };
    if (spawn.maxHeight !== undefined) placed.height = Math.max(2, Math.min(placed.height, spawn.maxHeight));
    if (spawn.maxWidth !== undefined) placed.width = Math.max(5, Math.min(placed.width, spawn.maxWidth));
    return placed;
  }
  const { headerHeight = 0, footerHeight = 0, marginLeft = 0, marginRight = 0, page } = template;
  // A section is always born stretched edge to edge (left/right, respecting
  // the margin) — only the height is left free to adjust afterwards.
  const isSection = schema.type === "section";
  const width = isSection ? Math.max(20, page.width - marginLeft - marginRight) : schema.width;
  const bodyTop = headerHeight;
  const bodyBottom = page.height - footerHeight;
  const x = isSection ? marginLeft : Math.max(marginLeft + 2, marginLeft + (page.width - marginLeft - marginRight - width) / 2);
  const y = Math.max(bodyTop + 2, bodyTop + (bodyBottom - bodyTop - schema.height) / 2);
  return { ...schema, x: snapToGrid(x, gridMm), y: snapToGrid(y, gridMm), width };
}

// A unique name for "paste" (Ctrl+V) — deterministic first
// (`${base}_${suffix}`), falling back to a random suffix only if that one is
// already in use (e.g. pasting the SAME selection twice in a row). It MUTATES
// `usedNames` (adding the chosen candidate) — the same behavior as the
// original `freshName`, which also registered each chosen name in the
// caller's Set before moving on to the next pasted schema, so that two fields
// pasted together with the same base name never collide with each other.
export function uniqueSchemaName(base: string, usedNames: Set<string>, suffix: string): string {
  let candidate = `${base}_${suffix}`;
  while (usedNames.has(candidate)) candidate = `${base}_${suffix}_${Math.random().toString(36).slice(2, 5)}`;
  usedNames.add(candidate);
  return candidate;
}

// A fonte do ITEM que um schema resolve: o array por trás dele, com as
// colunas conhecidas. Duas origens, nesta ordem:
// 1) Membro de uma seção (sectionId) — herda a MESMA fonte da seção dona
//    dele, porque é contra cada item dela que o campo resolve.
// 2) Vínculo próprio de array/gráfico/KPI, num path que bate com um
//    `dataSources` conhecido — vale mesmo fora de seção.
export type ItemSource = { path: string; columns: string[]; columnTypes?: Record<string, DataSourceColumnType> };

// Tipos de vínculo que apontam pra um ARRAY e portanto definem um item.
// "section" fica de fora aqui de propósito: ela entra pelo caminho do
// `sectionId` acima, do ponto de vista do MEMBRO, não do dono.
const ITEM_BINDING_TYPES = ["array", "chart", "kpi"] as const;
type ItemBinding = Extract<Binding, { type: (typeof ITEM_BINDING_TYPES)[number] }>;

function sourceForPath(path: string, dataSources: DataSourceOption[] | undefined): ItemSource | undefined {
  const source = dataSources?.find((d) => d.path === path);
  if (!source?.columns || source.columns.length === 0) return undefined;
  return { path: source.path, columns: source.columns, columnTypes: source.columnTypes };
}

export function findItemSource(
  schema: Schema | null,
  schemas: Schema[],
  bindings: Binding[],
  dataSources: DataSourceOption[] | undefined
): ItemSource | undefined {
  if (!schema) return undefined;
  if (schema.sectionId) {
    const section = schemas.find((s): s is SectionSchema => s.id === schema.sectionId && s.type === "section");
    const sectionBinding = section
      ? bindings.find(
          (b): b is Extract<Binding, { type: "section" }> => b.schemaName === section.name && b.type === "section"
        )
      : undefined;
    const inherited = sectionBinding && sourceForPath(sectionBinding.path, dataSources);
    if (inherited) return inherited;
  }
  const ownBinding = bindings.find(
    (b): b is ItemBinding =>
      b.schemaName === schema.name && (ITEM_BINDING_TYPES as readonly string[]).includes(b.type)
  );
  return ownBinding ? sourceForPath(ownBinding.path, dataSources) : undefined;
}

// Fonte de dados conhecida da TABELA, pra mostrar a lista de colunas
// disponíveis pra adicionar com "+" (ver PropertyPanel.tsx). É
// `findItemSource` com o portão de tipo — mantido com a assinatura original
// porque é o que a lista "+" chama, e pra não haver duas cópias da regra de
// herança de seção.
export function findTableDataSource(
  schema: Schema | null,
  schemas: Schema[],
  bindings: Binding[],
  dataSources: DataSourceOption[] | undefined
): ItemSource | undefined {
  if (!schema || schema.type !== "table") return undefined;
  return findItemSource(schema, schemas, bindings, dataSources);
}

// Tudo que o modal de fórmula (FormulaModal.tsx) oferece pra inserir: os
// campos do item à esquerda e os caminhos absolutos das fontes de dados.
//
// Os dois grupos existem porque resolvem em escopos diferentes, e confundir
// um com o outro é justamente o erro que a lista evita: dentro de uma linha
// de tabela, `total` é o campo do item; numa agregação, o caminho é
// `faturas.total` — `SUM(total)` não acharia nada.
export type FieldSources = {
  item?: ItemSource;
  arrays: DataSourceOption[];
};

export function fieldSourcesFor(
  schema: Schema | null,
  schemas: Schema[],
  bindings: Binding[],
  dataSources: DataSourceOption[] | undefined
): FieldSources {
  return {
    item: findItemSource(schema, schemas, bindings, dataSources),
    arrays: dataSources ?? [],
  };
}
