import type { Color, PDFFont, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";
import type { KpiElementOffset, KpiSchema } from "../types";
import { MATERIAL_ICON_GRID, MATERIAL_ICON_PATHS } from "../materialIcons";
import {
  DEFAULT_KPI_BORDER_RADIUS_PERCENT,
  DEFAULT_KPI_ICON_SIZE,
  DEFAULT_KPI_SUBTITLE_FONT_SIZE,
  DEFAULT_KPI_TITLE_FONT_SIZE,
  DEFAULT_KPI_VALUE_FONT_SIZE,
  formatKpiValue,
  kpiBorderRadius,
} from "../kpiFormat";
import { colorOrDefault } from "./color";
import { truncateToWidth } from "./drawTable";
import { mmToPt } from "../units";

const PADDING_PT = 8;

// Retângulo com cantos arredondados — pdf-lib não tem essa forma pronta
// (drawRectangle só faz cantos retos), então desenha via drawSvgPath.
// Coordenadas locais (0,0) = canto superior-esquerdo, y cresce pra baixo
// (convenção SVG) — ver pieGeometry.ts pra mesma lógica de ancoragem.
function roundedRectPath(width: number, height: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  return `M ${r},0 H ${width - r} A ${r},${r} 0 0 1 ${width},${r} V ${height - r} A ${r},${r} 0 0 1 ${width - r},${height} H ${r} A ${r},${r} 0 0 1 0,${height - r} V ${r} A ${r},${r} 0 0 1 ${r},0 Z`;
}

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
// espaço da página) que `drawText`/`drawIcon` esperam. `anchor` decide a
// conta: "baseline" (texto — a caixa some `sizePt` de altura, a baseline
// fica embaixo dela) ou "center" (ícone — `drawIcon` já espera o centro).
function offsetToPoint(
  offset: KpiElementOffset,
  xPt: number,
  yPt: number,
  heightPt: number,
  sizePt: number,
  anchor: "baseline" | "center"
): { x: number; y: number } {
  const boxX = xPt + mmToPt(offset.x);
  const boxTopY = yPt + heightPt - mmToPt(offset.y);
  if (anchor === "center") {
    return { x: boxX + sizePt / 2, y: boxTopY - sizePt / 2 };
  }
  return { x: boxX, y: boxTopY - sizePt };
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
      ? offsetToPoint(schema.titleOffset, xPt, yPt, heightPt, titleSize, "baseline")
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
      ? offsetToPoint(schema.iconOffset, xPt, yPt, heightPt, iconSize, "center")
      : { x: xPt + widthPt - PADDING_PT - iconSize / 2, y: topY - titleSize / 2 };
    drawIcon(page, schema.icon, p.x, p.y, iconSize, fg);
  }

  if (value !== undefined) {
    const displayValue = formatKpiValue(value, schema.numberFormat);
    const p = schema.valueOffset
      ? offsetToPoint(schema.valueOffset, xPt, yPt, heightPt, valueSize, "baseline")
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
      ? offsetToPoint(schema.subtitleOffset, xPt, yPt, heightPt, subtitleSize, "baseline")
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
