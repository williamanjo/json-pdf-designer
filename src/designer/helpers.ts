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

// Fonte de dados conhecida da tabela, pra mostrar a lista de colunas
// disponíveis pra adicionar com "+" (ver PropertyPanel.tsx) — dois casos:
// 1) Tabela membro de uma seção (sectionId) — puxa a MESMA fonte da
//    seção dona dela.
// 2) Tabela solta (ou com vínculo próprio) já vinculada (type "array")
//    a um path que bate com um dataSources conhecido — usa as colunas
//    dele direto, mesmo fora de seção.
export function findTableDataSource(
  schema: Schema | null,
  schemas: Schema[],
  bindings: Binding[],
  dataSources: DataSourceOption[] | undefined
): { path: string; columns: string[]; columnTypes?: Record<string, DataSourceColumnType> } | undefined {
  if (!schema || schema.type !== "table") return undefined;
  if (schema.sectionId) {
    const section = schemas.find(
      (s): s is SectionSchema => s.id === schema.sectionId && s.type === "section"
    );
    const sectionBinding = section
      ? bindings.find(
          (b): b is Extract<Binding, { type: "section" }> => b.schemaName === section.name && b.type === "section"
        )
      : undefined;
    if (sectionBinding) {
      const source = dataSources?.find((d) => d.path === sectionBinding.path);
      if (source?.columns && source.columns.length > 0) {
        return { path: source.path, columns: source.columns, columnTypes: source.columnTypes };
      }
    }
  }
  const ownBinding = bindings.find(
    (b): b is Extract<Binding, { type: "array" }> => b.schemaName === schema.name && b.type === "array"
  );
  if (ownBinding) {
    const source = dataSources?.find((d) => d.path === ownBinding.path);
    if (source?.columns && source.columns.length > 0) {
      return { path: source.path, columns: source.columns, columnTypes: source.columnTypes };
    }
  }
  return undefined;
}
