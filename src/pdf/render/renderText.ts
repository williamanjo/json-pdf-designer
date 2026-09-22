import { rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import type { TextSchema } from "../../types";
import { mmToPt } from "../../page/units";
import { colorOrDefault } from "../color";
import { alignX } from "../textLayout";
import { finiteOr, sanitizeText } from "../textSafety";

// A fallback for an absent/NaN `fontSize` — see finiteOr in textSafety.ts.
const DEFAULT_FONT_SIZE = 10;

export function drawTextField(
  page: PDFPage,
  font: PDFFont,
  schema: TextSchema,
  value: string | undefined,
  xPt: number,
  yPt: number,
  widthPt: number,
  heightPt: number
): void {
  if (schema.backgroundColor) {
    const bg = colorOrDefault(schema.backgroundColor, rgb(0, 0, 0));
    page.drawRectangle({ x: xPt, y: yPt, width: widthPt, height: heightPt, color: bg });
  }
  if (schema.borderColor && schema.borderWidth) {
    const bc = colorOrDefault(schema.borderColor, rgb(0, 0, 0));
    page.drawRectangle({
      x: xPt,
      y: yPt,
      width: widthPt,
      height: heightPt,
      borderColor: bc,
      borderWidth: mmToPt(schema.borderWidth),
    });
  }
  const textColor = colorOrDefault(schema.fontColor || "#000000", rgb(0, 0, 0));
  // It sanitizes here because this is the only text path that does not go
  // through truncateToWidth (a text field does not truncate, the excess simply
  // overflows the box).
  const text = sanitizeText(value ?? schema.content);
  const fontSize = finiteOr(schema.fontSize, DEFAULT_FONT_SIZE);
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  // The same formula as alignX (render/renderTable.ts uses the same one), here
  // with no padding at all (paddingPt = 0) — like the ternary this replaced.
  const alignOffset = alignX(schema.alignment, widthPt, textWidth, 0);
  page.drawText(text, {
    x: xPt + alignOffset,
    y: yPt + heightPt - fontSize,
    size: fontSize,
    font,
    color: textColor,
  });
}
