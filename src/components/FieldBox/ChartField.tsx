import type { ReactNode } from "react";
import type { ChartSchema } from "../../types";
import { resolveChartColors } from "../../fields/chart/colors";
import { pieSlicePath, pointOnCircle } from "../../fields/chart/pieGeometry";
import { DEFAULT_CHART_LEGEND_FONT_SIZE } from "../../fields/chart/format";

// Thumbnail preview (fixed icon, not at the real PDF scale, see
// PiePreview) — it scales the legend font size PROPORTIONALLY to the
// default (8pt -> 7px, the fixed size it always had), instead of doing a
// real pt->px conversion (which would overflow the small preview box).
const LEGEND_PREVIEW_BASE_PX = 7;
function legendPreviewFontSizePx(legendFontSize: number | undefined): number {
  return ((legendFontSize ?? DEFAULT_CHART_LEGEND_FONT_SIZE) / DEFAULT_CHART_LEGEND_FONT_SIZE) * LEGEND_PREVIEW_BASE_PX;
}

// Design preview only — 4 fixed sample slices/bars, just to show that the
// field is a chart, which type it is and (now) which color palette was
// chosen (preset or custom). The data (and the aggregation over the real
// binding) only enters when the PDF is generated (see pdf/render/renderChart.ts).
function chartPreview(colorPalette: string | undefined, customPaletteColors: string[] | undefined) {
  const palette = resolveChartColors(colorPalette, customPaletteColors);
  const values = [40, 25, 20, 15];
  return values.map((value, i) => ({ value, color: palette[i % palette.length] }));
}

function PiePreview({ pieStyle, withSliceLabels, preview }: { pieStyle: ChartSchema["pieStyle"]; withSliceLabels: boolean; preview: { value: number; color: string }[] }) {
  const total = preview.reduce((s, p) => s + p.value, 0);
  const r = 26;
  const cx = 32;
  const cy = 32;
  const innerR = (pieStyle ?? "donut") === "donut" ? r * 0.55 : 0;
  let cumulativeDeg = 0;

  return (
    <svg width="56" height="56" viewBox="0 0 64 64" className="jpd-chart__svg">
      {preview.map((p, i) => {
        const sweepDeg = (p.value / total) * 360;
        const path = pieSlicePath(cx, cy, r, innerR, cumulativeDeg, sweepDeg - 1.5);
        const midDeg = cumulativeDeg + sweepDeg / 2;
        cumulativeDeg += sweepDeg;
        if (!withSliceLabels) return <path key={i} d={path} fill={p.color} />;
        const labelR = innerR > 0 ? (innerR + r) / 2 : r * 0.62;
        const point = pointOnCircle(cx, cy, labelR, midDeg);
        return (
          <g key={i}>
            <path d={path} fill={p.color} />
            <text x={point.x} y={point.y + 2} fontSize="6" fill="#ffffff" textAnchor="middle">
              {Math.round((p.value / total) * 100)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Sample legend (label + color) — only to show WHERE it will sit
// (right/left/top/bottom); "slices" has no separate legend, the label is
// already written on top of each slice (see PiePreview).
function LegendPreview({ preview, fontSizePx }: { preview: { value: number; color: string }[]; fontSizePx: number }) {
  return (
    // `jpd-list` carries the <ul> reset (marker/margin/padding) that used to
    // come from Preflight; the font size stays inline because it derives
    // from the schema's legendFontSize.
    <ul className="jpd-list jpd-chart__legend" style={{ fontSize: fontSizePx }}>
      {preview.map((p, i) => (
        <li key={i} className="jpd-row jpd-row--tight">
          <span className="jpd-chart__dot" style={{ backgroundColor: p.color }} />
          <span>Fatia {i + 1}</span>
        </li>
      ))}
    </ul>
  );
}

// Donut+legend arrangement by the position chosen in the panel — the same 5
// options as ChartSchema.legendPosition, except that here it is a fixed
// sample (not the real binding) so the effect shows without generating a PDF.
function pieLayout(legendPosition: NonNullable<ChartSchema["legendPosition"]>, donut: ReactNode, legend: ReactNode): ReactNode {
  if (legendPosition === "slices") return donut;
  // The four arms below were two repeated class strings (top==bottom,
  // left==right): the difference between the pairs is only the ORDER of the
  // children, and between the groups only the axis. One class + data-legend.
  if (legendPosition === "top") {
    return (
      <div className="jpd-chart__layout" data-legend="top">
        {legend}
        {donut}
      </div>
    );
  }
  if (legendPosition === "bottom") {
    return (
      <div className="jpd-chart__layout" data-legend="bottom">
        {donut}
        {legend}
      </div>
    );
  }
  if (legendPosition === "left") {
    return (
      <div className="jpd-chart__layout" data-legend="left">
        {legend}
        {donut}
      </div>
    );
  }
  // "right" (default)
  return (
    <div className="jpd-chart__layout" data-legend="right">
      {donut}
      {legend}
    </div>
  );
}

export function ChartField({ schema }: { schema: ChartSchema }) {
  const preview = chartPreview(schema.colorPalette, schema.customPaletteColors);

  if (schema.chartType === "bar") {
    return (
      <div className="jpd-chart__bars">
        {preview.map((p, i) => (
          <div key={i} className="jpd-chart__bar" style={{ width: `${p.value * 2}%`, backgroundColor: p.color }} />
        ))}
      </div>
    );
  }

  const legendPosition = schema.legendPosition ?? "right";
  const donut = <PiePreview pieStyle={schema.pieStyle} withSliceLabels={legendPosition === "slices"} preview={preview} />;
  const legend = <LegendPreview preview={preview} fontSizePx={legendPreviewFontSizePx(schema.legendFontSize)} />;
  const layout = pieLayout(legendPosition, donut, legend);

  return (
    <div className="jpd-chart__frame">{layout}</div>
  );
}
