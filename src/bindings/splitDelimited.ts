// Separa por vírgula só no nível "de fora" — nem dentro de aspas (ex:
// CONCAT(a, ", ", b) não deve quebrar na vírgula literal do separador) nem
// dentro de parênteses aninhados (ex: coluna calculada
// "Total (R$)=CURRENCY(SUM(rows.total), \"R$\")" não deve quebrar na
// vírgula do SUM(...) por fora). Substitui as antigas splitArgs/
// splitTopLevel/splitFormulaArgs (cada uma só cobria metade do caso) por
// uma única implementação que respeita os dois ao mesmo tempo.
export function splitDelimited(raw: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inQuotes = false;
  for (const ch of raw) {
    if (ch === '"') inQuotes = !inQuotes;
    if (!inQuotes) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
    }
    if (ch === "," && depth === 0 && !inQuotes) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
