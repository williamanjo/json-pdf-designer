// Defaults compartilhados entre o preview no canvas (components/FieldBox/KpiField.tsx)
// e o desenho real no PDF (pdf/drawKpi.ts) — mesmo valor nos dois lugares
// pra preview bater com o PDF gerado quando o schema não define um tamanho.
export const DEFAULT_KPI_TITLE_FONT_SIZE = 8;
export const DEFAULT_KPI_VALUE_FONT_SIZE = 20;
export const DEFAULT_KPI_SUBTITLE_FONT_SIZE = 8;
export const DEFAULT_KPI_ICON_SIZE = 14;
// Aproxima o raio fixo de 8pt que o cartão sempre teve, no tamanho padrão
// de um KPI novo (ver makeKpiSchema em schemaFactory.ts, 55x35mm).
export const DEFAULT_KPI_BORDER_RADIUS_PERCENT = 16;

// Raio de canto (mesma unidade de width/height, mm no canvas ou pt no PDF)
// a partir de uma porcentagem — 0% = canto reto, 100% = "pílula" (metade
// do lado menor do cartão). Percentual em vez de valor fixo pra escalar
// com o tamanho do cartão em vez de ficar sempre o mesmo tanto de mm/pt.
export function kpiBorderRadius(percent: number, width: number, height: number): number {
  return (percent / 100) * (Math.min(width, height) / 2);
}

// Só o separador de milhar (ponto) — não força casas decimais (10000 vira
// "10000"/"10.000", não "10000,00"); se o número já tinha decimais, limita
// em 2 casas sem preencher com zero. Só quando `format` não é "none"/ausente
// E o valor resolvido é um número puro — texto com prefixo/sufixo (ex: "R$
// 42", "42 unid.") não é numérico depois do Number(...) e passa direto,
// sem tocar (evita quebrar KPIs que não são um número solto).
export function formatKpiValue(value: string, format?: "none" | "plain" | "grouped"): string {
  if (!format || format === "none") return value;
  const trimmed = value.trim();
  if (trimmed === "") return value;
  const n = Number(trimmed);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2, useGrouping: format === "grouped" });
}
