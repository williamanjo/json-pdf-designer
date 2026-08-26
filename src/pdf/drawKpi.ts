import type { Color, PDFFont, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";
import type { KpiSchema } from "../types";
import { MATERIAL_ICON_GRID, MATERIAL_ICON_PATHS } from "../materialIcons";
import { parseHex } from "./color";
import { truncateToWidth } from "./drawTable";

const PADDING_PT = 8;
const TITLE_SIZE = 8;
const VALUE_SIZE = 20;
const SUBTITLE_SIZE = 8;
const ICON_SIZE_PT = 14;
// Mesmo raio visual do "rounded-lg" do preview no canvas (ver components/FieldBox/KpiField.tsx)
// — cantos arredondados de verdade no PDF, não só na tela.
const CARD_RADIUS_PT = 8;

function colorOf(hex: string, fallback: Color): Color {
  const c = parseHex(hex);
  return c ? rgb(c.r, c.g, c.b) : fallback;
}

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

// Cartão de indicador: fundo sólido com cantos arredondados, ícone + título
// no topo, valor grande no meio, legenda embaixo. title/value/subtitle já
// vêm resolvidos (renderTemplate contra o documento, ver generate.ts) —
// esta função só desenha.
export function drawKpi(
  page: PDFPage,
  font: PDFFont,
  schema: KpiSchema,
  title: string,
  value: string,
  subtitle: string,
  xPt: number,
  yPt: number,
  widthPt: number,
  heightPt: number
): void {
  const bg = colorOf(schema.backgroundColor, rgb(0.15, 0.39, 0.92));
  const fg = colorOf(schema.textColor, rgb(1, 1, 1));
  page.drawSvgPath(roundedRectPath(widthPt, heightPt, CARD_RADIUS_PT), { x: xPt, y: yPt + heightPt, color: bg });

  const hasIcon = Boolean(MATERIAL_ICON_PATHS[schema.icon as keyof typeof MATERIAL_ICON_PATHS]);
  const innerWidth = widthPt - PADDING_PT * 2 - (hasIcon ? ICON_SIZE_PT + 4 : 0);
  const topY = yPt + heightPt - PADDING_PT;

  page.drawText(truncateToWidth(title.toUpperCase(), font, TITLE_SIZE, Math.max(innerWidth, 10)), {
    x: xPt + PADDING_PT,
    y: topY - TITLE_SIZE,
    size: TITLE_SIZE,
    font,
    color: fg,
  });

  if (hasIcon) {
    drawIcon(page, schema.icon, xPt + widthPt - PADDING_PT - ICON_SIZE_PT / 2, topY - TITLE_SIZE / 2, ICON_SIZE_PT, fg);
  }

  page.drawText(truncateToWidth(value, font, VALUE_SIZE, widthPt - PADDING_PT * 2), {
    x: xPt + PADDING_PT,
    y: yPt + heightPt / 2 - VALUE_SIZE / 3,
    size: VALUE_SIZE,
    font,
    color: fg,
  });

  page.drawText(truncateToWidth(subtitle, font, SUBTITLE_SIZE, widthPt - PADDING_PT * 2), {
    x: xPt + PADDING_PT,
    y: yPt + PADDING_PT,
    size: SUBTITLE_SIZE,
    font,
    color: fg,
  });
}
