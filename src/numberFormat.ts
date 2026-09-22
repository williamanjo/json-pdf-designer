// Shared pt-BR formatting — each consumer used to reimplement its own
// `toLocaleString("pt-BR", ...)` (CURRENCY inside a template, see bindings.ts;
// the KPI, see kpi/format.ts; the chart, see pdf/render/renderChart.ts).
// Only 2 axes really vary between them: fixed decimal places (currency, always
// ".00") or a ceiling only (a KPI/loose number, an integer keeps no places),
// and the thousands separator on or off.
export function formatPtBrNumber(
  value: number,
  opts: { decimals?: number; forceDecimals?: boolean; grouping?: boolean } = {}
): string {
  const { decimals = 2, forceDecimals = true, grouping = true } = opts;
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: forceDecimals ? decimals : undefined,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  });
}
