import type { PDFFont } from "pdf-lib";
import { sanitizeText } from "./textSafety";

// The offset (not the absolute position) of the text's X inside a box
// (cell/field), from its left edge — the same formula used by
// render/renderTable.ts (drawRow, with paddingPt = CELL_PADDING_PT) and by
// generate.ts (drawTextField, with paddingPt = 0, no padding at all).
export function alignX(align: "left" | "center" | "right", boxWidth: number, textWidth: number, paddingPt: number): number {
  if (align === "center") return Math.max(0, (boxWidth - textWidth) / 2);
  if (align === "right") return Math.max(0, boxWidth - textWidth - paddingPt);
  return paddingPt;
}

// The offset (not the absolute position) of the text's Y inside a box, from
// its bottom edge — the same formula used by render/renderTable.ts (drawRow)
// for a cell's vertical alignment.
export function alignY(vAlign: "top" | "middle" | "bottom", boxHeight: number, fontSizePt: number, paddingPt: number): number {
  if (vAlign === "top") return boxHeight - paddingPt - fontSizePt;
  if (vAlign === "bottom") return paddingPt;
  return boxHeight / 2 - fontSizePt / 2.8;
}

// Cuts `text` until it fits in `maxWidth` (in that font/size), appending "…"
// at the end.
//
// It is also the funnel through which ALL text coming from the data that goes
// onto the paper passes — a table cell, a KPI's title/value/subtitle, a chart
// label. That is why the control character sanitization lives here: a `\n` in
// the data (a textarea, an address with a line break, a CSV import) brought
// the whole document down with `WinAnsi cannot encode "\n"`, and a control
// character has no glyph in any font. A text field does not pass through here
// and sanitizes on its own (see renderText.ts).
export function truncateToWidth(rawText: string, font: PDFFont, size: number, maxWidth: number): string {
  const text = sanitizeText(rawText);
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let truncated = text;
  while (truncated.length > 1 && font.widthOfTextAtSize(`${truncated}…`, size) > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}
