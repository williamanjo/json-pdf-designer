import type { Binding, DataSourceColumnType, DataSourceOption, Schema, SectionSchema, Template } from "../types";
import { snapToGrid } from "../units";

// Funções puras extraídas de Designer.tsx — só dependem dos parâmetros
// recebidos, nunca de estado React fechado por closure. Ficam num módulo
// .ts (não .tsx) por dois motivos: dão pra testar direto, sem montar
// componente nenhum, e um .tsx só pode exportar componente (senão quebra
// o Fast Refresh, ver regra oxlint react(only-export-components)) — mesmo
// padrão de src/bindingBuilders.ts e src/canvasGeometry.ts.

// Enquanto isolado (Designer isolateBands), campo novo nasce dentro da
// primeira faixa vermelha disponível (header > footer > margem esquerda >
// direita) em vez da posição padrão no corpo — senão nasceria escondido.
// maxHeight/maxWidth limita o tamanho padrão do schema (ex: tabela de
// 30mm) pra não extrapolar a faixa e cair de volta pro corpo por conta
// própria altura. `null` quando nenhuma faixa tem espaço (>2mm) pra
// receber campo novo.
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

// Posição de nascimento de um campo novo (Designer.addSchema) — dois
// modos: isolado (dentro da faixa vermelha, ver bandSpawnPosition) ou
// normal (sempre no CENTRO da área do corpo, não empilha mais embaixo do
// último campo). Empilhar dependia de nextFreeY olhar só campos já
// classificados como "corpo" (classifyZone), mas essa classificação é só
// GEOMÉTRICA: um campo de rodapé posicionado um pouco fora do
// footerHeight configurado (ex: y menor que page.height-footerHeight)
// conta como corpo por acidente, virava o novo "chão", e todo campo novo
// nascia empilhado logo abaixo dele — inclusive fora da página, cada "+"
// clicado empurrando mais pra baixo em sequência. Nascer no centro
// elimina essa dependência: a posição do próximo campo não depende mais
// de onde os outros campos (mal classificados ou não) já estão.
export function computeSpawnPosition(template: Template, schema: Schema, isolateBands: boolean): Schema {
  if (isolateBands) {
    const spawn = bandSpawnPosition(template);
    if (!spawn) return schema;
    const placed = { ...schema, x: spawn.x, y: spawn.y };
    if (spawn.maxHeight !== undefined) placed.height = Math.max(2, Math.min(placed.height, spawn.maxHeight));
    if (spawn.maxWidth !== undefined) placed.width = Math.max(5, Math.min(placed.width, spawn.maxWidth));
    return placed;
  }
  const { headerHeight = 0, footerHeight = 0, marginLeft = 0, marginRight = 0, page } = template;
  // Seção sempre nasce esticada de ponta a ponta (esquerda/direita,
  // respeitando margem) — só a altura fica livre pra ajustar depois.
  const isSection = schema.type === "section";
  const width = isSection ? Math.max(20, page.width - marginLeft - marginRight) : schema.width;
  const bodyTop = headerHeight;
  const bodyBottom = page.height - footerHeight;
  const x = isSection ? marginLeft : Math.max(marginLeft + 2, marginLeft + (page.width - marginLeft - marginRight - width) / 2);
  const y = Math.max(bodyTop + 2, bodyTop + (bodyBottom - bodyTop - schema.height) / 2);
  return { ...schema, x: snapToGrid(x), y: snapToGrid(y), width };
}

// Nome único pro "colar" (Ctrl+V) — determinístico primeiro (`${base}_${suffix}`),
// só cai pro sufixo aleatório se esse já estiver em uso (ex: colar a MESMA
// seleção duas vezes seguidas). MUTA `usedNames` (adiciona o candidato
// escolhido) — mesmo comportamento do `freshName` original, que também
// registrava cada nome escolhido no Set do chamador antes de seguir pro
// próximo schema colado, pra dois campos colados juntos com o mesmo nome
// base nunca colidirem entre si.
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
