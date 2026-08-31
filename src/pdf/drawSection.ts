// Seção repetida (data band/mestre-detalhe) — a peça mais complexa do
// gerador, isolada num arquivo só: quantas repetições, quanto cada uma
// cresce (tabela membro mestre-detalhe empurra o resto da seção pra
// baixo) e o desenho de UMA repetição. generate.ts só chama isto —
// resolveSectionItems/sectionInstanceHeight pra saber quantas
// repetições/quanto espaço cada uma ocupa antes de desenhar (paginação),
// drawSectionInstance pra desenhar de verdade.
import type { PDFFont, PDFPage } from "pdf-lib";
import { getCaseInsensitive } from "../bindings/bindings";
import type { Binding, Schema, SectionSchema, TableSchema, TemplatePage } from "../types";
import { mmToPt } from "../units";
import { drawTableSlice, TABLE_ROW_HEIGHT_MM } from "./drawTable";
import { resolveFooterRow, resolveNestedTableRows, resolveTextValue } from "./resolvers";

// Campos membros de uma seção — qualquer schema do template com
// sectionId apontando pra ela (ver PageCanvas.tsx: arrastar em cima
// absorve, arrastar pra fora limpa).
export function sectionMembersOf(pageDef: TemplatePage, section: SectionSchema): Schema[] {
  return pageDef.schemas.filter((s) => s.sectionId === section.id);
}

// Crescimento (mm) de UMA tabela membro além do próprio placeholder, pro
// item atual — nunca negativo (não encolhe abaixo do desenhado). Conta a
// linha de totais (footer) como +1 linha extra, se houver.
function tableGrowth(tableMember: TableSchema, item: unknown, bindings: Binding[]): number {
  const rows = resolveNestedTableRows(tableMember, item, bindings);
  const footerRows = tableMember.footer && tableMember.footer.length > 0 ? 1 : 0;
  const actualHeight = (rows.length + 1 + footerRows) * TABLE_ROW_HEIGHT_MM; // +1 = linha de cabeçalho
  return Math.max(0, actualHeight - tableMember.height);
}

// Altura real desta repetição da seção pro item atual — a altura
// autorada (section.height) serve de mínimo; a soma do crescimento de
// TODAS as tabelas membro (mestre-detalhe) é o quanto falta caber a
// mais, já que cada uma empurra pra baixo tudo que vem depois dela (ver
// drawSectionInstance) — com 1 tabela só é só o crescimento dela mesma.
export function sectionInstanceHeight(pageDef: TemplatePage, section: SectionSchema, item: unknown, bindings: Binding[]): number {
  let totalGrowth = 0;
  for (const member of sectionMembersOf(pageDef, section)) {
    if (member.type !== "table") continue;
    totalGrowth += tableGrowth(member, item, bindings);
  }
  return section.height + totalGrowth;
}

// Itens do array vinculado a uma seção — sem vínculo, desenha 1 instância
// só com o conteúdo de design (preview), igual à tabela sem vínculo.
export function resolveSectionItems(sectionSchema: SectionSchema, bindings: Binding[], data: unknown): unknown[] {
  const binding = bindings.find(
    (b): b is Extract<Binding, { type: "section" }> => b.schemaName === sectionSchema.name && b.type === "section"
  );
  if (!binding) return [undefined];
  const arr = getCaseInsensitive(data, binding.path);
  return Array.isArray(arr) && arr.length > 0 ? arr : [undefined];
}

// O que drawSectionInstance precisa emprestado de generatePdf — só o
// necessário pra desenhar um membro que NÃO é tabela (drawField já sabe
// desenhar texto/imagem/gráfico/indicador com doc/imageCache/inputs por
// dentro do seu próprio closure).
export type SectionDrawContext = {
  template: TemplatePage;
  bindings: Binding[];
  font: PDFFont;
  pageHeightPt: number;
  drawField: (page: PDFPage, schema: Schema, value: string | undefined) => Promise<void>;
};

// Uma repetição de uma seção: processa os membros em ordem de Y (de cima
// pra baixo) acumulando um deslocamento — cada tabela que cresce além do
// próprio placeholder empurra pra baixo TUDO que vem depois dela (outra
// tabela, texto, imagem), não só o que tá abaixo da ÚLTIMA tabela. Com
// uma tabela só isso equivale ao comportamento de antes; com duas ou
// mais, a segunda (e o que vier depois) agora desloca certo em vez de
// ficar parada na posição desenhada e sobrepor a primeira. Cada membro
// mantém seu X absoluto (mesma coluna em toda repetição). Vínculo
// resolve contra o ITEM atual (não o documento todo); {Line} dá o
// número da repetição (1, 2, 3...).
export async function drawSectionInstance(
  ctx: SectionDrawContext,
  page: PDFPage,
  sectionSchema: SectionSchema,
  item: unknown,
  lineNumber: number,
  topMm: number
): Promise<void> {
  const { template, bindings, font, pageHeightPt, drawField } = ctx;
  const base = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  const augmented = { ...base, Line: lineNumber, index: lineNumber };
  const members = sectionMembersOf(template, sectionSchema).slice().sort((a, b) => a.y - b.y);

  let shiftSoFar = 0;
  for (const member of members) {
    const offsetY = member.y - sectionSchema.y + shiftSoFar;

    if (member.type === "table") {
      const rows = resolveNestedTableRows(member, item, bindings);
      const xPt = mmToPt(member.x);
      const widthPt = mmToPt(member.width);
      const topYPt = pageHeightPt - mmToPt(topMm + offsetY);
      drawTableSlice(page, font, member, rows, xPt, topYPt, widthPt, true, resolveFooterRow(member, augmented));
      shiftSoFar += tableGrowth(member, item, bindings);
      continue;
    }

    const absoluteMember = { ...member, y: topMm + offsetY } as Schema;
    if (member.type !== "text") {
      await drawField(page, absoluteMember, undefined);
      continue;
    }
    const binding = bindings.find((b) => b.schemaName === member.name);
    const text = resolveTextValue(member.content, binding, augmented);
    await drawField(page, absoluteMember, text);
  }
}
