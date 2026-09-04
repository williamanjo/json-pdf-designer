// Seção repetida (data band/mestre-detalhe) — a peça mais complexa do
// gerador, isolada num arquivo só: quantas repetições, quanto cada uma
// cresce (tabela membro mestre-detalhe empurra o resto da seção pra
// baixo) e o desenho de UMA repetição. generate.ts só chama isto —
// resolveSectionItems/sectionInstanceHeight pra saber quantas
// repetições/quanto espaço cada uma ocupa antes de desenhar (paginação),
// drawSectionInstance pra desenhar de verdade.
import type { PDFFont, PDFPage } from "pdf-lib";
import type { Binding, Schema, SectionSchema, TemplatePage } from "../../types";
import { mmToPt } from "../../page/units";
import { drawTableSlice } from "./renderTable";
// Medição da seção mora em layout/sectionLayout.ts (matemática pura, precisa
// rodar antes de desenhar); aqui ficou só o desenho. Reexportadas porque há
// quem importe por este caminho.
export { resolveSectionItems, sectionInstanceHeight, sectionMembersOf } from "../layout/sectionLayout";
import { sectionMembersOf, tableGrowth } from "../layout/sectionLayout";
import { resolveFooterRow, resolveNestedTableRows, resolveTextValue } from "../resolvers";

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
