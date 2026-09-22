import type { Color } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";
import type { TableCornerRadii, TableSchema } from "../../types";
import { resolveColumnWidthsMm } from "../../fields/table/layout";
import { mmToPt, ptToMm } from "../../page/units";
import { colorOrDefault, parseHex } from "../color";
import { roundedRectPath } from "../svgShapes";
import { alignX, alignY, truncateToWidth } from "../textLayout";
import { TABLE_ROW_HEIGHT_MM } from "../tableMetrics";
import { withGlyphContext } from "../textSafety";

const CELL_PADDING_PT = mmToPt(1.5);
const BORDER_COLOR = rgb(0.6, 0.6, 0.6);
const DEFAULT_HEAD_BG = rgb(0.16, 0.5, 0.73);
const DEFAULT_HEAD_COLOR = rgb(1, 1, 1);
const DEFAULT_FOOTER_BG = rgb(0.9, 0.9, 0.92);
const DEFAULT_FOOTER_COLOR = rgb(0, 0, 0);
const BODY_FONT_SIZE = 9;
const HEAD_FONT_SIZE = 9;

// The metrics live in ../tableMetrics.ts (no pdf-lib, so the layout can use
// them). Re-exported from here because some code already imports this path.
export { TABLE_ROW_HEIGHT_MM, tableRowsPerSlice } from "../tableMetrics";

type HAlign = "left" | "center" | "right";
type VAlign = "top" | "middle" | "bottom";

// "#rrggbb"/"#rgb" -> a pdf-lib Color — undefined (outside the try) falls
// back to the caller's default, so old templates without those colors stay
// exactly the same.
function hexToColor(hex: string | undefined): Color | undefined {
  const c = parseHex(hex);
  return c ? rgb(c.r, c.g, c.b) : undefined;
}

// Resolves the colors/sizes/alignments of the header/body/footer — the
// schema's override (schema.headBackgroundColor and so on) with a fallback to
// each block's built-in default. Extracted from drawTableSlice into a pure
// function (depending on nothing but the schema), reusable/testable on its
// own.
function resolveTableStyles(schema: TableSchema): {
  headBg: Color;
  headColor: Color;
  headSize: number;
  headAlign: HAlign;
  headVAlign: VAlign;
  bodyBg: Color | undefined;
  bodyBandBg: Color | undefined;
  bodyColor: Color;
  bodySize: number;
  bodyAlign: HAlign;
  bodyVAlign: VAlign;
  footerBg: Color;
  footerColor: Color;
  footerSize: number;
  footerAlign: HAlign;
  footerVAlign: VAlign;
  borderColor: Color;
} {
  return {
    headBg: colorOrDefault(schema.headBackgroundColor, DEFAULT_HEAD_BG),
    headColor: colorOrDefault(schema.headTextColor, DEFAULT_HEAD_COLOR),
    headSize: schema.headFontSize ?? HEAD_FONT_SIZE,
    headAlign: schema.headAlign ?? "left",
    headVAlign: schema.headVerticalAlign ?? "middle",
    bodyBg: hexToColor(schema.bodyBackgroundColor),
    bodyBandBg: hexToColor(schema.bodyBandColor),
    bodyColor: colorOrDefault(schema.bodyTextColor, rgb(0, 0, 0)),
    bodySize: schema.bodyFontSize ?? BODY_FONT_SIZE,
    bodyAlign: schema.bodyAlign ?? "left",
    bodyVAlign: schema.bodyVerticalAlign ?? "middle",
    footerBg: colorOrDefault(schema.footerBackgroundColor, DEFAULT_FOOTER_BG),
    footerColor: colorOrDefault(schema.footerTextColor, DEFAULT_FOOTER_COLOR),
    footerSize: schema.footerFontSize ?? BODY_FONT_SIZE,
    footerAlign: schema.footerAlign ?? "left",
    footerVAlign: schema.footerVerticalAlign ?? "middle",
    borderColor: colorOrDefault(schema.borderColor, BORDER_COLOR),
  };
}

// Truncates the cell's text, measures the resulting width and computes the
// final position (absolute x, y) already aligned inside the cell — extracted
// from drawRow into a function of its own (used both for the cell text and,
// in future, by any other block of text aligned in a box).
function cellTextPosition(
  cellX: number,
  cursorY: number,
  colWidth: number,
  rowHeightPt: number,
  align: HAlign,
  vAlign: VAlign,
  text: string,
  font: PDFFont,
  fontSize: number,
  paddingPt: number
): { x: number; y: number; truncated: string } {
  const truncated = truncateToWidth(text, font, fontSize, colWidth - paddingPt * 2);
  const textWidth = font.widthOfTextAtSize(truncated, fontSize);
  const x = cellX + alignX(align, colWidth, textWidth, paddingPt);
  const y = cursorY + alignY(vAlign, rowHeightPt, fontSize, paddingPt);
  return { x, y, truncated };
}

// Draws (optionally) the header + a block of rows starting at the top (topYPt,
// pdf-lib's coordinate system with the origin at the bottom left) going
// downward. Used both for a single-page table and per slice, when it paginates
// across several pages. It returns the Y (pt) of the base of the last row
// drawn, so the caller knows where the slice ended.
//
// `isLastSlice` (default true — safe for the call sites that never paginate, a
// loose table in a header/footer/margin) says whether THIS call is really the
// table's last slice — used only to decide where the BOTTOM rounded corners
// (bodyBorderRadius/footerBorderRadius) apply: the body/footer only round
// their background on the REALLY final slice (otherwise a 3-page table would
// have "rounded corners" in its middle). The header rounds the TOP every time
// it IS drawn (repeating on every page, if `repeatHeader`, is expected to
// repeat the rounding too) — it does not depend on `isLastSlice`.
export function drawTableSlice(
  page: PDFPage,
  font: PDFFont,
  schema: TableSchema,
  rows: string[][],
  xPt: number,
  topYPt: number,
  widthPt: number,
  includeHead = true,
  // The totals row — it only draws if it was given (the caller decides WHEN,
  // e.g. only on the last slice of a table that paginates — see generate.ts).
  footerRow?: string[],
  isLastSlice = true
): number {
  // It wraps the ENTIRE function: the three table paths (body, repeated band,
  // nested in a section) all go through here, so one place covers them all.
  // The text provider is lazy — it only runs if there has already been an error.
  return withGlyphContext(
    schema.name,
    () => [...schema.head, ...rows.flat(), ...(footerRow ?? [])],
    font,
    schema.bodyFontSize ?? 9,
    () => drawTableSliceInner(page, font, schema, rows, xPt, topYPt, widthPt, includeHead, footerRow, isLastSlice)
  );
}

function drawTableSliceInner(
  page: PDFPage,
  font: PDFFont,
  schema: TableSchema,
  rows: string[][],
  xPt: number,
  topYPt: number,
  widthPt: number,
  includeHead: boolean,
  footerRow: string[] | undefined,
  isLastSlice: boolean
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

  const {
    headBg,
    headColor,
    headSize,
    headAlign,
    headVAlign,
    bodyBg,
    bodyBandBg,
    bodyColor,
    bodySize,
    bodyAlign,
    bodyVAlign,
    footerBg,
    footerColor,
    footerSize,
    footerAlign,
    footerVAlign,
    borderColor,
  } = resolveTableStyles(schema);

  // The table HAS a footer (in some slice, not necessarily this one) — the
  // body never rounds its own bottom corner when that is true (what closes the
  // bottom corner is the footer, see headBorderRadius/bodyBorderRadius/
  // footerBorderRadius in types/schema.ts).
  const tableHasFooter = Boolean(schema.footer && schema.footer.length > 0);

  function radiiOrZero(r: TableCornerRadii | undefined): { tl: number; tr: number; bl: number; br: number } {
    return { tl: mmToPt(r?.topLeft ?? 0), tr: mmToPt(r?.topRight ?? 0), bl: mmToPt(r?.bottomLeft ?? 0), br: mmToPt(r?.bottomRight ?? 0) };
  }

  // The background (if any) + the row's frame — when some corner is
  // rounded, it draws BOTH (the fill and the outline) in a single
  // `drawSvgPath`, otherwise each cell's straight outline (drawn separately,
  // in the column loop below) would "peek" square out from under the rounded
  // fill (a real reported bug: corners looked straight even with borderRadius
  // set). With NO rounded corner at all, it stays the usual straight
  // `drawRectangle` (or nothing, if there is no background color) — the
  // regression is intact. It returns whether it drew the rounded frame, so the
  // column loop knows whether it still has to draw each cell's outer border
  // (it does not — only the internal dividers between columns).
  function drawRowFrame(
    y: number,
    width: number,
    fillColor: Color | undefined,
    corners: { tl: number; tr: number; bl: number; br: number } | null
  ): boolean {
    const rounded = Boolean(corners && (corners.tl || corners.tr || corners.bl || corners.br));
    if (rounded) {
      page.drawSvgPath(roundedRectPath(width, rowHeightPt, corners!), {
        x: xPt,
        y: y + rowHeightPt,
        color: fillColor,
        borderColor,
        borderWidth: 0.5,
      });
      return true;
    }
    if (fillColor) {
      page.drawRectangle({ x: xPt, y, width, height: rowHeightPt, color: fillColor });
    }
    return false;
  }

  // Background/color/size: a per-column override (more specific) > the whole
  // row's style (header/value/footer, the table fields above) > the built-in
  // default. The footer has no per-column override, only the whole row.
  function drawRow(
    cells: string[],
    variant: "head" | "body" | "footer",
    allowTopRadius: boolean,
    allowBottomRadius: boolean,
    banded: boolean
  ) {
    cursorY -= rowHeightPt;
    const rowWidthPt = colOffsetsPt[colCount - 1] + colWidthsPt[colCount - 1];
    // Each block only rounds the corner(s) that make sense for IT — the
    // header is always the top (never its own bottom, the body draws right
    // below it); the footer is always the base (never its own top); the body
    // only rounds the base, and only on the REALLY final row
    // (allowBottomRadius), never the top (the header already covers that). See
    // the TableCornerRadii comment in types/schema.ts.
    const corners =
      allowTopRadius || allowBottomRadius
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
      // A per-column override is the only thing that still draws a rectangle
      // PER CELL — the "whole row" color (the header/body default) already
      // comes out in the row's own background (drawRowBackground above), so as
      // not to draw the same color twice AND not to "re-square" a rounded
      // corner over it with N straight rectangles, one per column.
      const cellBg =
        variant === "head" ? hexToColor(colStyle?.headBackgroundColor) : variant === "body" ? hexToColor(colStyle?.cellBackgroundColor) : undefined;
      if (cellBg) {
        page.drawRectangle({ x: cellX, y: cursorY, width: colWidth, height: rowHeightPt, color: cellBg });
      }
      const text = cells[c] ?? "";
      const { x, y, truncated } = cellTextPosition(cellX, cursorY, colWidth, rowHeightPt, align, vAlign, text, font, fontSize, CELL_PADDING_PT);
      page.drawText(truncated, { x, y, size: fontSize, font, color: textColor });
      // When the row already had its outer outline drawn rounded (drawRowFrame
      // above), it does NOT redraw a straight 4-sided rectangle over it (that
      // was exactly what left the corner looking square even with a rounded
      // fill) — only the internal divider between columns, straight as it
      // should be (it is not part of the outer outline). With no rounding at
      // all, the behavior is identical to before: the usual straight
      // rectangle, cell by cell.
      if (roundedFrame) {
        if (c < colCount - 1) {
          page.drawLine({
            start: { x: cellX + colWidth, y: cursorY },
            end: { x: cellX + colWidth, y: cursorY + rowHeightPt },
            thickness: 0.5,
            color: borderColor,
          });
        }
      } else {
        page.drawRectangle({
          x: cellX,
          y: cursorY,
          width: colWidth,
          height: rowHeightPt,
          borderColor,
          borderWidth: 0.5,
        });
      }
    }
  }

  if (includeHead) drawRow(head, "head", true, false, false);
  rows.forEach((row, i) => {
    const isFinalBodyRow = isLastSlice && i === rows.length - 1 && !footerRow;
    drawRow(row, "body", false, isFinalBodyRow && !tableHasFooter, i % 2 === 1);
  });
  if (footerRow) drawRow(footerRow, "footer", false, true, false);
  return cursorY;
}
