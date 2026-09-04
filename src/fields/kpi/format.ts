import { formatPtBrNumber } from "../../numberFormat";

// Formatação do VALOR de um cartão de KPI. Arquivo próprio pra espelhar
// `chart/format.ts` — e porque era o único de treze exports do antigo
// `kpiFormat.ts` que formatava algo, o que fazia o nome do arquivo descrever
// 1/13 do conteúdo.

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
  return formatPtBrNumber(n, { decimals: 2, forceDecimals: false, grouping: format === "grouped" });
}
