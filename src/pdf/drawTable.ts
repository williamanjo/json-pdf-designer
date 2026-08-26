import type { Color } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";
import type { TableSchema } from "../types";
import { mmToPt } from "../units";
import { parseHex } from "./color";

const CELL_PADDING_PT = mmToPt(1.5);
const BORDER_COLOR = rgb(0.6, 0.6, 0.6);
const DEFAULT_HEAD_BG = rgb(0.16, 0.5, 0.73);
const DEFAULT_HEAD_COLOR = rgb(1, 1, 1);
const DEFAULT_FOOTER_BG = rgb(0.9, 0.9, 0.92);
const DEFAULT_FOOTER_COLOR = rgb(0, 0, 0);
const BODY_FONT_SIZE = 9;
const HEAD_FONT_SIZE = 9;
export const TABLE_ROW_HEIGHT_MM = 7;

// "#rrggbb"/"#rgb" -> Color do pdf-lib — undefined (fora do try) cai no
// default de quem chamou, pra templates antigos sem essas cores continuar
// exatamente iguais.
function hexToColor(hex: string | undefined): Color | undefined {
  const c = parseHex(hex);
  return c ? rgb(c.r, c.g, c.b) : undefined;
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
  footerRow?: string[]
): number {
  const head = schema.head;
  const colCount = head.length || (rows[0]?.length ?? footerRow?.length ?? 1);
  if (colCount === 0) return topYPt;

  const colWidth = widthPt / colCount;
  const rowHeightPt = mmToPt(TABLE_ROW_HEIGHT_MM);
  let cursorY = topYPt;

  const headBg = hexToColor(schema.headBackgroundColor) ?? DEFAULT_HEAD_BG;
  const headColor = hexToColor(schema.headTextColor) ?? DEFAULT_HEAD_COLOR;
  const headSize = schema.headFontSize ?? HEAD_FONT_SIZE;
  const bodyBg = hexToColor(schema.bodyBackgroundColor);
  const bodyColor = hexToColor(schema.bodyTextColor) ?? rgb(0, 0, 0);
  const bodySize = schema.bodyFontSize ?? BODY_FONT_SIZE;
  const footerBg = hexToColor(schema.footerBackgroundColor) ?? DEFAULT_FOOTER_BG;
  const footerColor = hexToColor(schema.footerTextColor) ?? DEFAULT_FOOTER_COLOR;
  const footerSize = schema.footerFontSize ?? BODY_FONT_SIZE;

  // Fundo/cor/tamanho: override por coluna (mais específico) > estilo da
  // linha toda (header/valor/rodapé, campos da tabela acima) > default
  // embutido. Rodapé não tem override por coluna, só linha toda.
  function drawRow(cells: string[], variant: "head" | "body" | "footer") {
    cursorY -= rowHeightPt;
    if (variant === "footer") {
      page.drawRectangle({ x: xPt, y: cursorY, width: colWidth * colCount, height: rowHeightPt, color: footerBg });
    } else if (variant === "body" && bodyBg) {
      page.drawRectangle({ x: xPt, y: cursorY, width: colWidth * colCount, height: rowHeightPt, color: bodyBg });
    }
    for (let c = 0; c < colCount; c++) {
      const cellX = xPt + c * colWidth;
      const colStyle = schema.columnStyles?.[c];
      const fontSize =
        variant === "head" ? colStyle?.headFontSize ?? headSize : variant === "body" ? colStyle?.cellFontSize ?? bodySize : footerSize;
      const textColor =
        variant === "head"
          ? hexToColor(colStyle?.headTextColor) ?? headColor
          : variant === "footer"
            ? footerColor
            : hexToColor(colStyle?.cellTextColor) ?? bodyColor;
      const cellBg =
        variant === "head" ? hexToColor(colStyle?.headBackgroundColor) ?? headBg : variant === "body" ? hexToColor(colStyle?.cellBackgroundColor) : undefined;
      if (cellBg) {
        page.drawRectangle({ x: cellX, y: cursorY, width: colWidth, height: rowHeightPt, color: cellBg });
      }
      const text = cells[c] ?? "";
      page.drawText(truncateToWidth(text, font, fontSize, colWidth - CELL_PADDING_PT * 2), {
        x: cellX + CELL_PADDING_PT,
        y: cursorY + rowHeightPt / 2 - fontSize / 2.8,
        size: fontSize,
        font,
        color: textColor,
      });
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

  if (includeHead) drawRow(head, "head");
  for (const row of rows) drawRow(row, "body");
  if (footerRow) drawRow(footerRow, "footer");
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
