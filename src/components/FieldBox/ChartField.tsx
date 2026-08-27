import type { ReactNode } from "react";
import type { ChartSchema } from "../../types";
import { resolveChartColors } from "../../chartColors";
import { pieSlicePath, pointOnCircle } from "../../pieGeometry";
import { DEFAULT_CHART_LEGEND_FONT_SIZE } from "../../chartFormat";

// Preview em miniatura (ícone fixo, não em escala real do PDF, ver
// PiePreview) — escala o tamanho de fonte da legenda PROPORCIONALMENTE ao
// default (8pt -> 7px, o tamanho fixo de sempre), em vez de converter
// pt->px de verdade (que estouraria a caixinha pequena do preview).
const LEGEND_PREVIEW_BASE_PX = 7;
function legendPreviewFontSizePx(legendFontSize: number | undefined): number {
  return ((legendFontSize ?? DEFAULT_CHART_LEGEND_FONT_SIZE) / DEFAULT_CHART_LEGEND_FONT_SIZE) * LEGEND_PREVIEW_BASE_PX;
}

// Preview de design só — 4 fatias/barras fixas de exemplo, só pra mostrar
// que o campo é um gráfico, qual tipo e (agora) qual paleta de cor foi
// escolhida (pronta ou personalizada). O dado (e a agregação em cima do
// vínculo real) só entra na hora de gerar o PDF (ver pdf/drawChart.ts).
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
    <svg width="56" height="56" viewBox="0 0 64 64" className="flex-shrink-0">
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

// Exemplo de legenda (rótulo + cor) — só pra mostrar ONDE ela vai ficar
// (right/left/top/bottom); "slices" não tem legenda separada, o rótulo
// já vai escrito em cima de cada fatia (ver PiePreview).
function LegendPreview({ preview, fontSizePx }: { preview: { value: number; color: string }[]; fontSizePx: number }) {
  return (
    <ul className="flex flex-col gap-1 leading-none text-slate-600" style={{ fontSize: fontSizePx }}>
      {preview.map((p, i) => (
        <li key={i} className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
          <span>Fatia {i + 1}</span>
        </li>
      ))}
    </ul>
  );
}

// Arranjo donut+legenda por posição escolhida no painel — mesmas 5 opções
// de ChartSchema.legendPosition, só que aqui é um exemplo fixo (não lê o
// vínculo real) pra dar pra ver o efeito sem gerar PDF.
function pieLayout(legendPosition: NonNullable<ChartSchema["legendPosition"]>, donut: ReactNode, legend: ReactNode): ReactNode {
  if (legendPosition === "slices") return donut;
  if (legendPosition === "top") {
    return (
      <div className="flex flex-col items-center gap-1">
        {legend}
        {donut}
      </div>
    );
  }
  if (legendPosition === "bottom") {
    return (
      <div className="flex flex-col items-center gap-1">
        {donut}
        {legend}
      </div>
    );
  }
  if (legendPosition === "left") {
    return (
      <div className="flex items-center gap-2">
        {legend}
        {donut}
      </div>
    );
  }
  // "right" (default)
  return (
    <div className="flex items-center gap-2">
      {donut}
      {legend}
    </div>
  );
}

export function ChartField({ schema }: { schema: ChartSchema }) {
  const preview = chartPreview(schema.colorPalette, schema.customPaletteColors);

  if (schema.chartType === "bar") {
    return (
      <div className="flex h-full w-full flex-col justify-center gap-1.5 rounded-md border border-slate-200 bg-white p-2">
        {preview.map((p, i) => (
          <div key={i} className="h-2 rounded-sm" style={{ width: `${p.value * 2}%`, backgroundColor: p.color }} />
        ))}
      </div>
    );
  }

  const legendPosition = schema.legendPosition ?? "right";
  const donut = <PiePreview pieStyle={schema.pieStyle} withSliceLabels={legendPosition === "slices"} preview={preview} />;
  const legend = <LegendPreview preview={preview} fontSizePx={legendPreviewFontSizePx(schema.legendFontSize)} />;
  const layout = pieLayout(legendPosition, donut, legend);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white p-1.5">
      {layout}
    </div>
  );
}
