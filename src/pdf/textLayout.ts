import type { PDFFont } from "pdf-lib";

// Offset (não posição absoluta) do X do texto dentro de uma caixa
// (célula/campo), a partir da borda esquerda dela — mesma fórmula usada
// por drawTable.ts (drawRow, com paddingPt = CELL_PADDING_PT) e por
// generate.ts (drawTextField, com paddingPt = 0, sem padding nenhum).
export function alignX(align: "left" | "center" | "right", boxWidth: number, textWidth: number, paddingPt: number): number {
  if (align === "center") return Math.max(0, (boxWidth - textWidth) / 2);
  if (align === "right") return Math.max(0, boxWidth - textWidth - paddingPt);
  return paddingPt;
}

// Offset (não posição absoluta) do Y do texto dentro de uma caixa, a
// partir da borda inferior dela — mesma fórmula usada por drawTable.ts
// (drawRow) pro alinhamento vertical de célula.
export function alignY(vAlign: "top" | "middle" | "bottom", boxHeight: number, fontSizePt: number, paddingPt: number): number {
  if (vAlign === "top") return boxHeight - paddingPt - fontSizePt;
  if (vAlign === "bottom") return paddingPt;
  return boxHeight / 2 - fontSizePt / 2.8;
}

// Corta `text` até caber em `maxWidth` (nessa fonte/tamanho), acrescentando
// "…" no final — movida de drawTable.ts, mesma implementação exata.
export function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}…`, size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}
