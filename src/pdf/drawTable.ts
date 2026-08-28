import type { Color } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";
import type { TableCornerRadii, TableSchema } from "../types";
import { resolveColumnWidthsMm } from "../tableLayout";
import { mmToPt, ptToMm } from "../units";
import { colorOrDefault, parseHex } from "./color";

const CELL_PADDING_PT = mmToPt(1.5);
const BORDER_COLOR = rgb(0.6, 0.6, 0.6);
const DEFAULT_HEAD_BG = rgb(0.16, 0.5, 0.73);
const DEFAULT_HEAD_COLOR = rgb(1, 1, 1);
const DEFAULT_FOOTER_BG = rgb(0.9, 0.9, 0.92);
const DEFAULT_FOOTER_COLOR = rgb(0, 0, 0);
const BODY_FONT_SIZE = 9;
const HEAD_FONT_SIZE = 9;
export const TABLE_ROW_HEIGHT_MM = 7;

type HAlign = "left" | "center" | "right";
type VAlign = "top" | "middle" | "bottom";

// "#rrggbb"/"#rgb" -> Color do pdf-lib — undefined (fora do try) cai no
// default de quem chamou, pra templates antigos sem essas cores continuar
// exatamente iguais.
function hexToColor(hex: string | undefined): Color | undefined {
  const c = parseHex(hex);
  return c ? rgb(c.r, c.g, c.b) : undefined;
}

// Retângulo com até 4 cantos independentes (mesma ideia do roundedRectPath
// uniforme de drawKpi.ts, só que um raio por canto) — usado só quando pelo
// menos um dos 4 é > 0; o caller decide ISSO (ver drawRowBackground
// abaixo), senão continua um page.drawRectangle reto de sempre. Cada raio
// é limitado a metade do lado menor, pra não estourar a forma.
function roundedCornersPath(width: number, height: number, tl: number, tr: number, br: number, bl: number): string {
  const half = Math.min(width, height) / 2;
  const rtl = Math.max(0, Math.min(tl, half));
  const rtr = Math.max(0, Math.min(tr, half));
  const rbr = Math.max(0, Math.min(br, half));
  const rbl = Math.max(0, Math.min(bl, half));
  return `M ${rtl},0 H ${width - rtr} A ${rtr},${rtr} 0 0 1 ${width},${rtr} V ${height - rbr} A ${rbr},${rbr} 0 0 1 ${width - rbr},${height} H ${rbl} A ${rbl},${rbl} 0 0 1 0,${height - rbl} V ${rtl} A ${rtl},${rtl} 0 0 1 ${rtl},0 Z`;
}

// Quantas linhas de corpo cabem numa fatia com essa altura disponível —
// reserva 1 linha pro cabeçalho só se ele for desenhar nessa fatia
// (schema.repeatHeader === false libera essa linha nas fatias de
// continuação, já que o cabeçalho não repete).
export function tableRowsPerSlice(availableHeightMm: number, includeHead = true): number {
  const rows = Math.floor(availableHeightMm / TABLE_ROW_HEIGHT_MM) - (includeHead ? 1 : 0);
  return Math.max(0, rows);
}

// Desenha (opcionalmente) cabeçalho + um bloco de linhas começando no topo
// (topYPt, sistema pdf-lib com origem embaixo-esquerda) indo pra baixo.
// Usada tanto pra tabela de página única quanto por fatia, quando pagina
// em várias páginas. Retorna o Y (pt) da base da última linha desenhada,
// pra caller saber onde a fatia terminou.
//
// `isLastSlice` (default true — seguro pros call-sites que nunca paginam,
// tabela solta em header/footer/margem) diz se ESTA chamada é a última
// fatia de verdade da tabela inteira — usado só pra decidir onde os
// cantos arredondados de BAIXO (bodyBorderRadius/footerBorderRadius) se
// aplicam: corpo/rodapé só arredondam o fundo na fatia REALMENTE final
// (senão uma tabela de 3 páginas ficaria com "cantos arredondados" no meio
// dela). O cabeçalho arredonda o TOPO toda vez que É desenhado (repetir em
// toda página, se `repeatHeader`, é esperado repetir o arredondamento
// também) — não depende de `isLastSlice`.
export function drawTableSlice(
  page: PDFPage,
  font: PDFFont,
  schema: TableSchema,
  rows: string[][],
  xPt: number,
  topYPt: number,
  widthPt: number,
  includeHead = true,
  // Linha de totais — só desenha se informada (chamador decide QUANDO,
  // ex: só na última fatia de uma tabela que pagina — ver generate.ts).
  footerRow?: string[],
  isLastSlice = true
): number {
  const head = schema.head;
  const colCount = head.length || (rows[0]?.length ?? footerRow?.length ?? 1);
  if (colCount === 0) return topYPt;

  const colWidthsPt = resolveColumnWidthsMm(schema.columnWidths, colCount, ptToMm(widthPt)).map(mmToPt);
  const colOffsetsPt: number[] = [];
  {
    let acc = 0;
    for (const w of colWidthsPt) {
      colOffsetsPt.push(acc);
      acc += w;
    }
  }
  const rowHeightPt = mmToPt(TABLE_ROW_HEIGHT_MM);
  let cursorY = topYPt;

  const headBg = colorOrDefault(schema.headBackgroundColor, DEFAULT_HEAD_BG);
  const headColor = colorOrDefault(schema.headTextColor, DEFAULT_HEAD_COLOR);
  const headSize = schema.headFontSize ?? HEAD_FONT_SIZE;
  const headAlign: HAlign = schema.headAlign ?? "left";
  const headVAlign: VAlign = schema.headVerticalAlign ?? "middle";
  const bodyBg = hexToColor(schema.bodyBackgroundColor);
  const bodyBandBg = hexToColor(schema.bodyBandColor);
  const bodyColor = colorOrDefault(schema.bodyTextColor, rgb(0, 0, 0));
  const bodySize = schema.bodyFontSize ?? BODY_FONT_SIZE;
  const bodyAlign: HAlign = schema.bodyAlign ?? "left";
  const bodyVAlign: VAlign = schema.bodyVerticalAlign ?? "middle";
  const footerBg = colorOrDefault(schema.footerBackgroundColor, DEFAULT_FOOTER_BG);
  const footerColor = colorOrDefault(schema.footerTextColor, DEFAULT_FOOTER_COLOR);
  const footerSize = schema.footerFontSize ?? BODY_FONT_SIZE;
  const footerAlign: HAlign = schema.footerAlign ?? "left";
  const footerVAlign: VAlign = schema.footerVerticalAlign ?? "middle";

  // Tabela TEM rodapé (em alguma fatia, não necessariamente esta) — corpo
  // nunca arredonda o próprio canto de baixo quando isso é verdade (quem
  // fecha o canto de baixo é o rodapé, ver headBorderRadius/
  // bodyBorderRadius/footerBorderRadius em types/schema.ts).
  const tableHasFooter = Boolean(schema.footer && schema.footer.length > 0);

  function radiiOrZero(r: TableCornerRadii | undefined): { tl: number; tr: number; bl: number; br: number } {
    return { tl: mmToPt(r?.topLeft ?? 0), tr: mmToPt(r?.topRight ?? 0), bl: mmToPt(r?.bottomLeft ?? 0), br: mmToPt(r?.bottomRight ?? 0) };
  }

  // Fundo (se houver) + moldura da linha — quando algum canto é
  // arredondado, desenha os DOIS (preenchimento e contorno) num `drawSvgPath`
  // só, senão o contorno reto de cada célula (desenhado à parte, no loop de
  // colunas abaixo) ficaria "espiando" quadrado por baixo do preenchimento
  // arredondado (bug real reportado: cantos pareciam retos mesmo com
  // borderRadius definido). Sem NENHUM canto arredondado, continua um
  // `drawRectangle` reto de sempre (ou nada, se não tiver cor de fundo) —
  // regressão intacta. Retorna se desenhou a moldura arredondada, pro loop
  // de colunas saber se ainda precisa desenhar a borda de fora de cada
  // célula (não precisa — só os divisores internos entre colunas).
  function drawRowFrame(
    y: number,
    width: number,
    fillColor: Color | undefined,
    corners: { tl: number; tr: number; bl: number; br: number } | null
  ): boolean {
    const rounded = Boolean(corners && (corners.tl || corners.tr || corners.bl || corners.br));
    if (rounded) {
      page.drawSvgPath(roundedCornersPath(width, rowHeightPt, corners!.tl, corners!.tr, corners!.br, corners!.bl), {
        x: xPt,
        y: y + rowHeightPt,
        color: fillColor,
        borderColor: BORDER_COLOR,
        borderWidth: 0.5,
      });
      return true;
    }
    if (fillColor) {
      page.drawRectangle({ x: xPt, y, width, height: rowHeightPt, color: fillColor });
    }
    return false;
  }

  // Fundo/cor/tamanho: override por coluna (mais específico) > estilo da
  // linha toda (header/valor/rodapé, campos da tabela acima) > default
  // embutido. Rodapé não tem override por coluna, só linha toda.
  function drawRow(cells: string[], variant: "head" | "body" | "footer", roundTop: boolean, roundBottom: boolean, banded: boolean) {
    cursorY -= rowHeightPt;
    const rowWidthPt = colOffsetsPt[colCount - 1] + colWidthsPt[colCount - 1];
    // Cada bloco só arredonda o(s) canto(s) que fazem sentido pra ELE —
    // cabeçalho é sempre o topo (nunca o próprio fundo, o corpo desenha
    // logo abaixo); rodapé é sempre a base (nunca o próprio topo); corpo
    // só arredonda a base, e só na linha REALMENTE final (roundBottom),
    // nunca o topo (o cabeçalho já cobre isso). Ver comentário de
    // TableCornerRadii em types/schema.ts.
    const corners =
      roundTop || roundBottom
        ? variant === "head"
          ? { ...radiiOrZero(schema.headBorderRadius), bl: 0, br: 0 }
          : variant === "footer"
            ? { ...radiiOrZero(schema.footerBorderRadius), tl: 0, tr: 0 }
            : { ...radiiOrZero(schema.bodyBorderRadius), tl: 0, tr: 0 }
        : null;
    const roundedFrame =
      variant === "footer"
        ? drawRowFrame(cursorY, rowWidthPt, footerBg, corners)
        : variant === "body"
          ? drawRowFrame(cursorY, rowWidthPt, banded && bodyBandBg ? bodyBandBg : bodyBg, corners)
          : drawRowFrame(cursorY, rowWidthPt, headBg, corners);
    const align = variant === "head" ? headAlign : variant === "footer" ? footerAlign : bodyAlign;
    const vAlign = variant === "head" ? headVAlign : variant === "footer" ? footerVAlign : bodyVAlign;
    for (let c = 0; c < colCount; c++) {
      const cellX = xPt + colOffsetsPt[c];
      const colWidth = colWidthsPt[c];
      const colStyle = schema.columnStyles?.[c];
      const fontSize =
        variant === "head" ? colStyle?.headFontSize ?? headSize : variant === "body" ? colStyle?.cellFontSize ?? bodySize : footerSize;
      const textColor =
        variant === "head"
          ? colorOrDefault(colStyle?.headTextColor, headColor)
          : variant === "footer"
            ? footerColor
            : colorOrDefault(colStyle?.cellTextColor, bodyColor);
      // Override por coluna é a única coisa que ainda desenha um retângulo
      // POR CÉLULA — a cor "de linha toda" (default de cabeçalho/corpo) já
      // sai no fundo da própria linha (drawRowBackground acima), pra não
      // desenhar 2x a mesma cor E pra não "re-quadrar" um canto arredondado
      // por cima dele com N retângulos retos, um por coluna.
      const cellBg =
        variant === "head" ? hexToColor(colStyle?.headBackgroundColor) : variant === "body" ? hexToColor(colStyle?.cellBackgroundColor) : undefined;
      if (cellBg) {
        page.drawRectangle({ x: cellX, y: cursorY, width: colWidth, height: rowHeightPt, color: cellBg });
      }
      const text = cells[c] ?? "";
      const truncated = truncateToWidth(text, font, fontSize, colWidth - CELL_PADDING_PT * 2);
      const textWidth = font.widthOfTextAtSize(truncated, fontSize);
      const x =
        align === "center"
          ? cellX + Math.max(0, (colWidth - textWidth) / 2)
          : align === "right"
            ? cellX + Math.max(0, colWidth - textWidth - CELL_PADDING_PT)
            : cellX + CELL_PADDING_PT;
      const y =
        vAlign === "top"
          ? cursorY + rowHeightPt - CELL_PADDING_PT - fontSize
          : vAlign === "bottom"
            ? cursorY + CELL_PADDING_PT
            : cursorY + rowHeightPt / 2 - fontSize / 2.8;
      page.drawText(truncated, { x, y, size: fontSize, font, color: textColor });
      // Quando a linha teve o contorno externo já desenhado arredondado
      // (drawRowFrame acima), NÃO redesenha um retângulo reto de 4 lados
      // por cima dele (era exatamente isso que deixava o canto parecendo
      // quadrado mesmo com o preenchimento arredondado) — só o divisor
      // interno entre colunas, reto mesmo (não faz parte do contorno
      // externo). Sem arredondamento nenhum, comportamento idêntico a
      // antes: retângulo reto de sempre, célula por célula.
      if (roundedFrame) {
        if (c < colCount - 1) {
          page.drawLine({
            start: { x: cellX + colWidth, y: cursorY },
            end: { x: cellX + colWidth, y: cursorY + rowHeightPt },
            thickness: 0.5,
            color: BORDER_COLOR,
          });
        }
      } else {
        page.drawRectangle({
          x: cellX,
          y: cursorY,
          width: colWidth,
          height: rowHeightPt,
          borderColor: BORDER_COLOR,
          borderWidth: 0.5,
        });
      }
    }
  }

  if (includeHead) drawRow(head, "head", true, false, false);
  rows.forEach((row, i) => {
    const isVeryLastBodyRow = isLastSlice && i === rows.length - 1 && !footerRow;
    drawRow(row, "body", false, isVeryLastBodyRow && !tableHasFooter, i % 2 === 1);
  });
  if (footerRow) drawRow(footerRow, "footer", false, true, false);
  return cursorY;
}

export function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}…`, size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}
