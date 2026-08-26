import type { ReactNode } from "react";
import type { ChartSchema } from "../../types";
import { CHART_COLORS } from "../../chartColors";
import { pieSlicePath, pointOnCircle } from "../../pieGeometry";

// Preview de design só — 4 fatias/barras fixas de exemplo, só pra mostrar
// que o campo é um gráfico e qual tipo. O dado (e a agregação em cima do
// vínculo real) só entra na hora de gerar o PDF (ver pdf/drawChart.ts).
const CHART_PREVIEW = [
  { value: 40, color: CHART_COLORS[0] },
  { value: 25, color: CHART_COLORS[1] },
  { value: 20, color: CHART_COLORS[2] },
  { value: 15, color: CHART_COLORS[3] },
];

function PiePreview({ pieStyle, withSliceLabels }: { pieStyle: ChartSchema["pieStyle"]; withSliceLabels: boolean }) {
  const total = CHART_PREVIEW.reduce((s, p) => s + p.value, 0);
  const r = 26;
  const cx = 32;
  const cy = 32;
  const innerR = (pieStyle ?? "donut") === "donut" ? r * 0.55 : 0;
  let cumulativeDeg = 0;

  return (
    <svg width="56" height="56" viewBox="0 0 64 64" className="flex-shrink-0">
      {CHART_PREVIEW.map((p, i) => {
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
function LegendPreview() {
  return (
    <ul className="flex flex-col gap-1 text-[7px] leading-none text-slate-600">
      {CHART_PREVIEW.map((p, i) => (
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
  if (schema.chartType === "bar") {
    return (
      <div className="flex h-full w-full flex-col justify-center gap-1.5 rounded-md border border-slate-200 bg-white p-2">
        {CHART_PREVIEW.map((p, i) => (
          <div key={i} className="h-2 rounded-sm" style={{ width: `${p.value * 2}%`, backgroundColor: p.color }} />
        ))}
      </div>
    );
  }

  const legendPosition = schema.legendPosition ?? "right";
  const donut = <PiePreview pieStyle={schema.pieStyle} withSliceLabels={legendPosition === "slices"} />;
  const layout = pieLayout(legendPosition, donut, <LegendPreview />);

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white p-1.5">
      {layout}
    </div>
  );
}
