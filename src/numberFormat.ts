// Formatação pt-BR compartilhada — antes cada consumidor (CURRENCY dentro
// de template, ver bindings.ts; KPI, ver kpiFormat.ts; gráfico, ver
// pdf/drawChart.ts) reimplementava seu próprio `toLocaleString("pt-BR", ...)`.
// Só 2 eixos variam de verdade entre eles: casas decimais fixas (moeda,
// sempre ".00") ou só-teto (KPI/número solto, inteiro fica sem casa), e
// separador de milhar ligado/desligado.
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
