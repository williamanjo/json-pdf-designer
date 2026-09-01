import type { Binding, Schema, SectionSchema, TableSchema, TemplatePage } from "../../types";
import { getCaseInsensitive } from "../../expressions/dataAccess";
import { resolveNestedTableRows } from "../resolvers";
import { TABLE_ROW_HEIGHT_MM } from "../tableMetrics";

// Medição de seção repetida (data band / mestre-detalhe) — quantas
// repetições e quanto cada uma ocupa. Vive em layout/ e não em
// render/renderSection.ts porque é matemática pura: nenhuma destas funções
// precisa de PDFPage, e todas são necessárias ANTES de desenhar qualquer
// coisa (é o layout que decide onde cada repetição cai). O
// render/renderSection.ts ficou só com o desenho.

// Campos membros de uma seção — qualquer schema do template com sectionId
// apontando pra ela (ver PageCanvas.tsx: arrastar em cima absorve, arrastar
// pra fora limpa).
export function sectionMembersOf(pageDef: TemplatePage, section: SectionSchema): Schema[] {
  return pageDef.schemas.filter((s) => s.sectionId === section.id);
}

// Crescimento (mm) de UMA tabela membro além do próprio placeholder, pro item
// atual — nunca negativo (não encolhe abaixo do desenhado). Conta a linha de
// totais (footer) como +1 linha extra, se houver.
export function tableGrowth(tableMember: TableSchema, item: unknown, bindings: Binding[]): number {
  const rows = resolveNestedTableRows(tableMember, item, bindings);
  const footerRows = tableMember.footer && tableMember.footer.length > 0 ? 1 : 0;
  const actualHeight = (rows.length + 1 + footerRows) * TABLE_ROW_HEIGHT_MM; // +1 = linha de cabeçalho
  return Math.max(0, actualHeight - tableMember.height);
}

// Altura real desta repetição da seção pro item atual — a altura autorada
// (section.height) serve de mínimo; a soma do crescimento de TODAS as tabelas
// membro (mestre-detalhe) é o quanto falta caber a mais, já que cada uma
// empurra pra baixo tudo que vem depois dela (ver drawSectionInstance) — com 1
// tabela só é só o crescimento dela mesma.
export function sectionInstanceHeight(pageDef: TemplatePage, section: SectionSchema, item: unknown, bindings: Binding[]): number {
  let totalGrowth = 0;
  for (const member of sectionMembersOf(pageDef, section)) {
    if (member.type !== "table") continue;
    totalGrowth += tableGrowth(member, item, bindings);
  }
  return section.height + totalGrowth;
}

// Itens do array vinculado a uma seção — sem vínculo, desenha 1 instância só
// com o conteúdo de design (preview), igual à tabela sem vínculo.
export function resolveSectionItems(sectionSchema: SectionSchema, bindings: Binding[], data: unknown): unknown[] {
  const binding = bindings.find(
    (b): b is Extract<Binding, { type: "section" }> => b.schemaName === sectionSchema.name && b.type === "section"
  );
  if (!binding) return [undefined];
  const arr = getCaseInsensitive(data, binding.path);
  return Array.isArray(arr) && arr.length > 0 ? arr : [undefined];
}
