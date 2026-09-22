// Splits on commas at the "outer" level only — neither inside quotes (e.g.
// CONCAT(a, ", ", b) must not break on the literal comma) nor inside nested
// parentheses (e.g. the calculated column
// "Total (R$)=CURRENCY(SUM(rows.total), \"R$\")" must not break on the
// comma of the inner SUM(...)). Replaces the old splitArgs/splitTopLevel/
// splitFormulaArgs (each covered only half the case) with a single
// implementation that respects both at once.
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
