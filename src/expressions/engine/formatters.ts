import { formatPtBrNumber } from "../../numberFormat";

// DATE/CURRENCY formatters — moved out of bindings.ts with no behavior change
// (see dataAccess.ts for the reason for the move). The comments document
// decisions that have already cost a bug in the past; they stand in full.

// It reads "raw" according to a GIVEN format (the same tokens as the output
// format) instead of letting JS's `new Date(raw)` guess — that one guesses
// the "/" separator as MM/DD/YYYY (American), so a Brazilian date like
// "10/04/2025" (10 April) became 10 October, wrong and silent (no error at
// all, just the date swapped). It only comes into play if DATE(...)'s 3rd arg
// is given; without it, the usual `new Date(raw)` stands (compatible with ISO
// "YYYY-MM-DD" input, which IS unambiguous and does not need this).
function parseDateWithFormat(raw: string, format: string): Date | null {
  const order: string[] = [];
  const escaped = format.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replace(/YYYY|MM|DD|HH|mm|ss/g, (tok) => {
    order.push(tok);
    return "(\\d+)";
  });
  const match = raw.match(new RegExp(`^${pattern}$`));
  if (!match) return null;
  const parts: Record<string, number> = {};
  order.forEach((tok, i) => {
    parts[tok] = Number(match[i + 1]);
  });
  // Construído em UTC (não no fuso local) — combina com a leitura em
  // formatDate abaixo, senão essa data (sempre "meia-noite exata" do dia
  // escrito) sofreria o MESMO deslocamento que essa função existe pra evitar.
  const d = new Date(
    Date.UTC(
      parts.YYYY ?? new Date().getUTCFullYear(),
      (parts.MM ?? 1) - 1,
      parts.DD ?? 1,
      parts.HH ?? 0,
      parts.mm ?? 0,
      parts.ss ?? 0
    )
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(raw: string, outputFormat: string, inputFormat?: string): string {
  if (!raw) return "";
  const d = inputFormat ? parseDateWithFormat(raw, inputFormat) : new Date(raw);
  if (!d || Number.isNaN(d.getTime())) return raw;
  // Getters UTC, não locais — "YYYY-MM-DD" (sem hora) é lido pelo motor JS
  // como meia-noite UTC; getFullYear()/getDate() locais then aplicam o fuso
  // do NAVEGADOR/SERVIDOR em cima disso, e em qualquer fuso atrás de UTC
  // (Brasil, EUA...) meia-noite UTC vira o dia ANTERIOR local — "2026-07-01"
  // saía "30/06/2026", errado e silencioso. UTC aqui elimina isso: a data sai
  // igual ao que foi escrito, não importa o fuso de quem gera.
  const pad = (n: number) => String(n).padStart(2, "0");
  const tokens: Record<string, string> = {
    YYYY: String(d.getUTCFullYear()),
    MM: pad(d.getUTCMonth() + 1),
    DD: pad(d.getUTCDate()),
    HH: pad(d.getUTCHours()),
    mm: pad(d.getUTCMinutes()),
    ss: pad(d.getUTCSeconds()),
  };
  return outputFormat.replace(/YYYY|MM|DD|HH|mm|ss/g, (m) => tokens[m]);
}

export function formatCurrency(raw: string, symbol: string, decimals: number): string {
  const n = Number(raw);
  if (Number.isNaN(n)) return raw;
  const d = Number.isNaN(decimals) ? 2 : decimals;
  const formatted = formatPtBrNumber(n, { decimals: d, forceDecimals: true });
  return symbol ? `${symbol} ${formatted}` : formatted;
}
