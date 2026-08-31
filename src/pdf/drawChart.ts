import type { PDFFont, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";
import type { ChartItem } from "../bindings/bindings";
import type { ChartSchema } from "../types";
import { pieSlicePath, pointOnCircle } from "../chart/pieGeometry";
import { DEFAULT_CHART_LEGEND_FONT_SIZE } from "../chart/format";
import { formatPtBrNumber } from "../numberFormat";
import { colorOrDefault } from "./color";
import { truncateToWidth } from "./textLayout";

const SLICE_LABEL_TEXT = rgb(1, 1, 1);
const SLICE_LABEL_FONT_SIZE = 7;
// Fatia menor que isso (graus) não recebe rótulo em cima — não cabe texto
// legível, só polui.
const SLICE_LABEL_MIN_SWEEP_DEG = 14;

// Fração do raio externo que vira o furo da rosca — mesma proporção usada
// no preview do canvas (ver components/FieldBox/ChartField.tsx), pra pizza/rosca terem a mesma
// cara no editor e no PDF gerado.
const DONUT_HOLE_RATIO = 0.55;

const LEGEND_SWATCH_PT = 7;
const LEGEND_GAP_PT = 4;
// Altura de linha some no mesmo passo do tamanho de fonte (+4pt de folga,
// mesma proporção do default 8pt/12pt de sempre) — sem isso, legenda com
// fonte maior sobrepõe as linhas.
const LEGEND_ROW_GAP_PT = 4;
const BAR_FONT_SIZE = 8;
const BAR_TRACK_HEIGHT = 7;
const NEUTRAL_TEXT = rgb(0.1, 0.1, 0.1);
const TRACK_BG = rgb(0.9, 0.9, 0.9);

const CHART_ITEM_FALLBACK_COLOR = rgb(0.6, 0.6, 0.6);

function formatChartValue(value: number, schema: ChartSchema): string {
  const decimals = schema.decimals ?? 2;
  // true/ausente (default) = "10.000,00" (comportamento de sempre); false =
  // "10000,00" (só vírgula decimal, sem pontuar milhar).
  const useGrouping = schema.thousandsSeparator ?? true;
  // "currency" sempre fixa as casas (padrão de dinheiro); "number" (default,
  // sem valueFormat) mantém o comportamento de sempre — só limita casas
  // quando existem, sem forçar ".00" num valor inteiro.
  if (schema.valueFormat === "currency") {
    const formatted = formatPtBrNumber(value, { decimals, forceDecimals: true, grouping: useGrouping });
    return `${schema.currencySymbol ?? "R$"} ${formatted}`;
  }
  return formatPtBrNumber(value, { decimals, forceDecimals: false, grouping: useGrouping });
}

function formatValue(item: ChartItem, total: number, schema: ChartSchema): string {
  const raw = formatChartValue(item.value, schema);
  if (schema.displayMode === "number") return raw;
  const pct = `${(total > 0 ? (item.value / total) * 100 : 0).toFixed(1).replace(".", ",")}%`;
  if (schema.displayMode === "percent") return pct;
  return `${raw} (${pct})`; // "both"
}

// Só as fatias (sem legenda nenhuma) — pizza/rosca, opcionalmente com o
// valor/porcentagem escrito em cima de cada fatia (legendPosition
// "slices"). page.drawSvgPath usa coordenada estilo SVG (y cresce pra
// baixo, origem = canto superior-esquerdo do path) ancorada em (x, y) —
// por isso o y passado é o TOPO da caixa em pt do pdf-lib (que cresce pra
// cima). pieSlicePath (src/pieGeometry.ts) é a mesma função usada no
// preview do canvas, então as duas batem.
function drawPieSlices(
  page: PDFPage,
  font: PDFFont,
  schema: ChartSchema,
  items: ChartItem[],
  total: number,
  xPt: number,
  topYPt: number,
  areaWidthPt: number,
  heightPt: number,
  directLabels: boolean
) {
  const size = Math.max(0, Math.min(areaWidthPt, heightPt) - 8);
  const r = size / 2;
  const innerR = (schema.pieStyle ?? "donut") === "donut" ? r * DONUT_HOLE_RATIO : 0;
  const originX = xPt + (areaWidthPt - size) / 2;
  const originTopY = topYPt - (heightPt - size) / 2;
  const cx = r;
  const cy = r;
  // Local (SVG, y pra baixo) -> página (pdf-lib, y pra cima): mesma âncora
  // usada pro drawSvgPath acima, só que aplicada a um PONTO em vez de um path.
  const toPage = (local: { x: number; y: number }) => ({ x: originX + local.x, y: originTopY - local.y });

  // -1° de folga entre fatias (não muda o ângulo acumulado, só encolhe
  // cada fatia desenhada) — separador visual sem precisar de borda.
  let cumulativeDeg = 0;
  for (const item of items) {
    const sweepDeg = total > 0 ? (item.value / total) * 360 : 0;
    if (sweepDeg <= 0) continue;
    const path = pieSlicePath(cx, cy, r, innerR, cumulativeDeg, Math.max(sweepDeg - 1, 0));
    page.drawSvgPath(path, { x: originX, y: originTopY, color: colorOrDefault(item.color, CHART_ITEM_FALLBACK_COLOR) });

    if (directLabels && sweepDeg >= SLICE_LABEL_MIN_SWEEP_DEG) {
      const midDeg = cumulativeDeg + sweepDeg / 2;
      const labelR = innerR > 0 ? (innerR + r) / 2 : r * 0.65;
      const text = formatValue(item, total, schema);
      const textWidth = font.widthOfTextAtSize(text, SLICE_LABEL_FONT_SIZE);
      const point = toPage(pointOnCircle(cx, cy, labelR, midDeg));
      page.drawText(text, {
        x: point.x - textWidth / 2,
        y: point.y - SLICE_LABEL_FONT_SIZE / 3,
        size: SLICE_LABEL_FONT_SIZE,
        font,
        color: SLICE_LABEL_TEXT,
      });
    }

    cumulativeDeg += sweepDeg;
  }
}

// Tamanho de fonte + altura de linha da legenda — ausente cai no default
// de sempre (8pt fonte / 12pt linha). Altura de linha some no mesmo passo
// do tamanho de fonte (mesma folga de +4pt) pra fonte maior não sobrepor
// as linhas.
function legendMetrics(schema: ChartSchema): { fontSize: number; rowHeight: number } {
  const fontSize = schema.legendFontSize ?? DEFAULT_CHART_LEGEND_FONT_SIZE;
  return { fontSize, rowHeight: fontSize + LEGEND_ROW_GAP_PT };
}

// Legenda em lista (swatch + rótulo + valor), centralizada verticalmente
// na caixa que recebeu — usada tanto na coluna à direita quanto na faixa
// de cima/embaixo (só muda largura/altura de quem chama).
function drawLegend(
  page: PDFPage,
  font: PDFFont,
  items: ChartItem[],
  total: number,
  schema: ChartSchema,
  xPt: number,
  topYPt: number,
  widthPt: number,
  heightPt: number
) {
  const { fontSize, rowHeight } = legendMetrics(schema);
  const rowsHeight = items.length * rowHeight;
  const maxLabelWidth = Math.max(widthPt - LEGEND_SWATCH_PT - LEGEND_GAP_PT - 4, 20);
  let y = topYPt - Math.max(0, (heightPt - rowsHeight) / 2) - rowHeight / 2 - LEGEND_SWATCH_PT / 2;
  for (const item of items) {
    page.drawRectangle({ x: xPt, y, width: LEGEND_SWATCH_PT, height: LEGEND_SWATCH_PT, color: colorOrDefault(item.color, CHART_ITEM_FALLBACK_COLOR) });
    const label = `${item.label}  ${formatValue(item, total, schema)}`;
    page.drawText(truncateToWidth(label, font, fontSize, maxLabelWidth), {
      x: xPt + LEGEND_SWATCH_PT + LEGEND_GAP_PT,
      y: y + 0.5,
      size: fontSize,
      font,
      color: NEUTRAL_TEXT,
    });
    y -= rowHeight;
  }
}

function drawBars(page: PDFPage, font: PDFFont, schema: ChartSchema, items: ChartItem[], total: number, xPt: number, topYPt: number, widthPt: number, heightPt: number) {
  const rowHeight = heightPt / items.length;
  const max = items.reduce((m, it) => Math.max(m, it.value), 0);
  const labelLineHeight = Math.min(rowHeight * 0.5, BAR_FONT_SIZE + 3);

  items.forEach((item, i) => {
    const rowTopY = topYPt - i * rowHeight;
    const labelY = rowTopY - labelLineHeight + 2;
    const trackY = rowTopY - rowHeight + Math.max(1, (rowHeight - labelLineHeight - BAR_TRACK_HEIGHT) / 2);
    const valueText = formatValue(item, total, schema);
    const valueWidth = font.widthOfTextAtSize(valueText, BAR_FONT_SIZE);
    const trackWidth = Math.max(0, widthPt - valueWidth - 6);
    const fillWidth = max > 0 ? (item.value / max) * trackWidth : 0;

    page.drawText(truncateToWidth(item.label, font, BAR_FONT_SIZE, widthPt), {
      x: xPt,
      y: labelY,
      size: BAR_FONT_SIZE,
      font,
      color: NEUTRAL_TEXT,
    });
    page.drawRectangle({ x: xPt, y: trackY, width: trackWidth, height: BAR_TRACK_HEIGHT, color: TRACK_BG });
    if (fillWidth > 0) {
      page.drawRectangle({ x: xPt, y: trackY, width: fillWidth, height: BAR_TRACK_HEIGHT, color: colorOrDefault(item.color, CHART_ITEM_FALLBACK_COLOR) });
    }
    page.drawText(valueText, {
      x: xPt + trackWidth + 6,
      y: trackY + BAR_TRACK_HEIGHT / 2 - BAR_FONT_SIZE / 2.8,
      size: BAR_FONT_SIZE,
      font,
      color: NEUTRAL_TEXT,
    });
  });
}

// Retângulo de destino (x, topY = topo da caixa em pt, width, height) —
// mesma convenção "topo pra baixo" usada em todo drawChart.ts.
type Box = { x: number; topY: number; width: number; height: number };

// Calcula onde entram a pizza e a legenda dentro da caixa disponível, pra
// cada valor de `legendPosition` — geometria idêntica à que cada branch
// calculava separadamente antes deste refactor (só a ordem de chamada de
// drawPieSlices/drawLegend mudava por branch). `legendBox` null = sem
// legenda nenhuma ("slices": rótulo vai em cima da própria fatia, ver
// `directLabels`).
function computePieLayout(
  schema: ChartSchema,
  legendPosition: NonNullable<ChartSchema["legendPosition"]>,
  items: ChartItem[],
  xPt: number,
  topYPt: number,
  widthPt: number,
  heightPt: number
): { pieBox: Box; legendBox: Box | null; directLabels: boolean } {
  if (legendPosition === "slices") {
    return { pieBox: { x: xPt, topY: topYPt, width: widthPt, height: heightPt }, legendBox: null, directLabels: true };
  }

  if (legendPosition === "top" || legendPosition === "bottom") {
    const legendHeightPt = Math.min(items.length * legendMetrics(schema).rowHeight, heightPt * 0.5);
    const pieHeightPt = heightPt - legendHeightPt;
    if (legendPosition === "top") {
      return {
        legendBox: { x: xPt, topY: topYPt, width: widthPt, height: legendHeightPt },
        pieBox: { x: xPt, topY: topYPt - legendHeightPt, width: widthPt, height: pieHeightPt },
        directLabels: false,
      };
    }
    return {
      pieBox: { x: xPt, topY: topYPt, width: widthPt, height: pieHeightPt },
      legendBox: { x: xPt, topY: topYPt - pieHeightPt, width: widthPt, height: legendHeightPt },
      directLabels: false,
    };
  }

  const legendWidthPt = Math.min(Math.max(widthPt * 0.4, 60), 160);
  const pieAreaWidthPt = Math.max(0, widthPt - legendWidthPt);

  if (legendPosition === "left") {
    return {
      legendBox: { x: xPt, topY: topYPt, width: legendWidthPt, height: heightPt },
      pieBox: { x: xPt + legendWidthPt, topY: topYPt, width: pieAreaWidthPt, height: heightPt },
      directLabels: false,
    };
  }

  // "right" (default)
  return {
    pieBox: { x: xPt, topY: topYPt, width: pieAreaWidthPt, height: heightPt },
    legendBox: { x: xPt + pieAreaWidthPt, topY: topYPt, width: legendWidthPt, height: heightPt },
    directLabels: false,
  };
}

// Desenha o gráfico dentro da caixa (xPt, topYPt = topo da caixa em pt,
// widthPt, heightPt) — pizza (legenda à direita/em cima/embaixo/em cada
// fatia, ver ChartSchema.legendPosition) ou barras horizontais com rótulo
// + valor por linha. `items` já vem agregado (ver aggregateChartItems em
// bindings/bindings.ts) — esta função só desenha.
export function drawChart(page: PDFPage, font: PDFFont, schema: ChartSchema, items: ChartItem[], total: number, xPt: number, topYPt: number, widthPt: number, heightPt: number): void {
  if (items.length === 0) return;
  if (schema.chartType === "bar") {
    drawBars(page, font, schema, items, total, xPt, topYPt, widthPt, heightPt);
    return;
  }

  const legendPosition = schema.legendPosition ?? "right";
  const { pieBox, legendBox, directLabels } = computePieLayout(schema, legendPosition, items, xPt, topYPt, widthPt, heightPt);

  drawPieSlices(page, font, schema, items, total, pieBox.x, pieBox.topY, pieBox.width, pieBox.height, directLabels);
  if (legendBox) {
    drawLegend(page, font, items, total, schema, legendBox.x, legendBox.topY, legendBox.width, legendBox.height);
  }
}
