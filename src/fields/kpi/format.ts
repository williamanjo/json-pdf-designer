import { formatPtBrNumber } from "../../numberFormat";

// Formatting of a KPI card's VALUE. A file of its own to mirror
// `chart/format.ts` — and because it was the only one of the old
// `kpiFormat.ts`'s thirteen exports that formatted anything, which made the
// file name describe 1/13 of its content.

// Only the thousands separator (a dot) — it does not force decimal places
// (10000 becomes "10000"/"10.000", not "10000,00"); if the number already had
// decimals, it caps them at 2 places without padding with zeros. Only when
// `format` is not "none"/absent AND the resolved value is a plain number —
// text with a prefix/suffix (e.g. "R$ 42", "42 units") is not numeric after
// Number(...) and passes through untouched (it avoids breaking non-numeric KPIs).
export function formatKpiValue(value: string, format?: "none" | "plain" | "grouped"): string {
  if (!format || format === "none") return value;
  const trimmed = value.trim();
  if (trimmed === "") return value;
  const n = Number(trimmed);
  if (Number.isNaN(n)) return value;
  return formatPtBrNumber(n, { decimals: 2, forceDecimals: false, grouping: format === "grouped" });
}
