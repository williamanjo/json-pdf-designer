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

// Ícone do Material Symbols (mesmo path do preview no canvas, ver
// components/FieldBox/KpiField.tsx) — path autorado no grid 960 padrão
// (viewBox "0 -960 960 960"), desenhado via drawSvgPath. scale = size/960
// faz o ícone ocupar exatamente `size` pt; a âncora (x,y) é o canto
// inferior-esquerdo do ícone porque o grid do Material tem y de 0 (base)
// a -960 (topo) — dá zero pro drawSvgPath (que espera y crescendo pra
// baixo a partir da âncora) cair exatamente na base do ícone.
function drawIcon(page: PDFPage, icon: string, cx: number, cy: number, size: number, color: Color): void {
  const path = MATERIAL_ICON_PATHS[icon as keyof typeof MATERIAL_ICON_PATHS];
  if (!path) return;
  const scale = size / MATERIAL_ICON_GRID;
  page.drawSvgPath(path, { x: cx - size / 2, y: cy - size / 2, scale, color });
}

// Converte um offset customizado (mm, canto superior-esquerdo do
// sub-elemento relativo ao cartão — ver KpiElementOffset) pro ponto (pt,
// espaço da página) que `drawText` espera: a caixa some `fontSizePt` de
// altura, a baseline fica embaixo dela.
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

// Converte um offset customizado (mm, canto superior-esquerdo do
// sub-elemento relativo ao cartão — ver KpiElementOffset) pro ponto (pt,
// espaço da página) que `drawIcon` espera (`drawIcon` já espera o centro).
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

// Cartão de indicador: fundo sólido com cantos arredondados, ícone + título
// no topo, valor grande no meio, legenda embaixo (posição padrão) — cada
// um pode ter posição própria (schema.<el>Offset) e title/value/subtitle
// ausente (undefined) simplesmente não desenha (sub-elemento removido, ver
// FieldList.tsx). title/value/subtitle já vêm resolvidos (renderTemplate
// contra o documento, ver generate.ts) — esta função só desenha.
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
