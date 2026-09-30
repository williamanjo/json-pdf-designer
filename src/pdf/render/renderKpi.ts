import type { Color, PDFFont, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";
import type { KpiElementOffset, KpiSchema } from "../../types";
import { MATERIAL_ICON_GRID, MATERIAL_ICON_PATHS } from "../../materialIcons";
import { DEFAULT_KPI_BORDER_RADIUS_PERCENT, DEFAULT_KPI_ICON_SIZE, DEFAULT_KPI_SUBTITLE_FONT_SIZE, DEFAULT_KPI_TITLE_FONT_SIZE, DEFAULT_KPI_VALUE_FONT_SIZE, kpiBorderRadius } from "../../fields/kpi/card";
import { formatKpiValue } from "../../fields/kpi/format";
import { colorOrDefault } from "../color";
import { truncateToWidth } from "../textLayout";
import { roundedRectPath } from "../svgShapes";
import { mmToPt } from "../../page/units";

const PADDING_PT = 8;

// A Material Symbols icon (the same path as the canvas preview, see
// components/FieldBox/KpiField.tsx) — a path authored on the standard 960
// grid (viewBox "0 -960 960 960"), drawn through drawSvgPath. scale = size/960
// makes the icon take exactly `size` pt; the anchor (x,y) is the icon's
// bottom-left corner because the Material grid has y going from 0 (the
// baseline) to -960 (the top) — which makes drawSvgPath (which expects y to
// grow downward from the anchor) land exactly on the icon's base.
function drawIcon(page: PDFPage, icon: string, cx: number, cy: number, size: number, color: Color): void {
  const path = MATERIAL_ICON_PATHS[icon as keyof typeof MATERIAL_ICON_PATHS];
  if (!path) return;
  const scale = size / MATERIAL_ICON_GRID;
  page.drawSvgPath(path, { x: cx - size / 2, y: cy - size / 2, scale, color });
}

// Converts a custom offset (mm, the sub-element's top-left corner relative to
// the card — see KpiElementOffset) into the point (pt, page space) `drawText`
// expects: the box loses `fontSizePt` of height, and the baseline sits below
// it.
function offsetToBaselinePoint(
  offset: KpiElementOffset,
  xPt: number,
  yPt: number,
  heightPt: number,
  fontSizePt: number
): { x: number; y: number } {
  const boxX = xPt + mmToPt(offset.x);
  const boxTopY = yPt + heightPt - mmToPt(offset.y);
  return { x: boxX, y: boxTopY - fontSizePt };
}

// Converts a custom offset (mm, the sub-element's top-left corner relative to
// the card — see KpiElementOffset) into the point (pt, page space) `drawIcon`
// expects (`drawIcon` already expects the center).
function offsetToCenterPoint(
  offset: KpiElementOffset,
  xPt: number,
  yPt: number,
  heightPt: number,
  iconSizePt: number
): { x: number; y: number } {
  const boxX = xPt + mmToPt(offset.x);
  const boxTopY = yPt + heightPt - mmToPt(offset.y);
  return { x: boxX + iconSizePt / 2, y: boxTopY - iconSizePt / 2 };
}

// A KPI card: a solid background with rounded corners, an icon + title at the
// top, a large value in the middle, a subtitle at the bottom (the default
// position) — each of them may have a position of its own (schema.<el>Offset)
// and an absent title/value/subtitle (undefined) simply does not draw (a
// removed sub-element, see FieldList.tsx). title/value/subtitle already arrive
// resolved (renderTemplate against the document, see generate.ts) — this
// function only draws.
export function drawKpi(
  page: PDFPage,
  font: PDFFont,
  schema: KpiSchema,
  title: string | undefined,
  value: string | undefined,
  subtitle: string | undefined,
  xPt: number,
  yPt: number,
  widthPt: number,
  heightPt: number
): void {
  const titleSize = schema.titleFontSize ?? DEFAULT_KPI_TITLE_FONT_SIZE;
  const valueSize = schema.valueFontSize ?? DEFAULT_KPI_VALUE_FONT_SIZE;
  const subtitleSize = schema.subtitleFontSize ?? DEFAULT_KPI_SUBTITLE_FONT_SIZE;
  const iconSize = schema.iconSize ?? DEFAULT_KPI_ICON_SIZE;
  const radiusPt = kpiBorderRadius(schema.borderRadius ?? DEFAULT_KPI_BORDER_RADIUS_PERCENT, widthPt, heightPt);

  const bg = colorOrDefault(schema.backgroundColor, rgb(0.15, 0.39, 0.92));
  const fg = colorOrDefault(schema.textColor, rgb(1, 1, 1));
  page.drawSvgPath(roundedRectPath(widthPt, heightPt, radiusPt), { x: xPt, y: yPt + heightPt, color: bg });

  const hasIcon = Boolean(MATERIAL_ICON_PATHS[schema.icon as keyof typeof MATERIAL_ICON_PATHS]);
  const innerWidth = widthPt - PADDING_PT * 2 - (hasIcon ? iconSize + 4 : 0);
  const topY = yPt + heightPt - PADDING_PT;

  if (title !== undefined) {
    const p = schema.titleOffset
      ? offsetToBaselinePoint(schema.titleOffset, xPt, yPt, heightPt, titleSize)
      : { x: xPt + PADDING_PT, y: topY - titleSize };
    page.drawText(truncateToWidth(title.toUpperCase(), font, titleSize, Math.max(innerWidth, 10)), {
      x: p.x,
      y: p.y,
      size: titleSize,
      font,
      color: fg,
    });
  }

  if (hasIcon) {
    const p = schema.iconOffset
      ? offsetToCenterPoint(schema.iconOffset, xPt, yPt, heightPt, iconSize)
      : { x: xPt + widthPt - PADDING_PT - iconSize / 2, y: topY - titleSize / 2 };
    drawIcon(page, schema.icon, p.x, p.y, iconSize, fg);
  }

  if (value !== undefined) {
    const displayValue = formatKpiValue(value, schema.numberFormat);
    const p = schema.valueOffset
      ? offsetToBaselinePoint(schema.valueOffset, xPt, yPt, heightPt, valueSize)
      : { x: xPt + PADDING_PT, y: yPt + heightPt / 2 - valueSize / 3 };
    page.drawText(truncateToWidth(displayValue, font, valueSize, widthPt - PADDING_PT * 2), {
      x: p.x,
      y: p.y,
      size: valueSize,
      font,
      color: fg,
    });
  }

  if (subtitle !== undefined) {
    const p = schema.subtitleOffset
      ? offsetToBaselinePoint(schema.subtitleOffset, xPt, yPt, heightPt, subtitleSize)
      : { x: xPt + PADDING_PT, y: yPt + PADDING_PT };
    page.drawText(truncateToWidth(subtitle, font, subtitleSize, widthPt - PADDING_PT * 2), {
      x: p.x,
      y: p.y,
      size: subtitleSize,
      font,
      color: fg,
    });
  }
}
