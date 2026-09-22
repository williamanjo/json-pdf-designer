import type { TableColumn } from "../types";
import { splitDelimited } from "./splitDelimited";

// Column syntax: "column" (raw key) or "Label=FORMULA" (calculated,
// evaluated per row — e.g. "Total (R$)=CURRENCY(total_amount, \"R$\")").
export function parseColumnsInput(raw: string): TableColumn[] {
  return splitDelimited(raw).map((part): TableColumn => {
    const eq = part.indexOf("=");
    if (eq === -1) return part;
    return { label: part.slice(0, eq).trim(), formula: part.slice(eq + 1).trim() };
  });
}

export function stringifyColumns(columns: TableColumn[]): string {
  return columns.map((c) => (typeof c === "string" ? c : `${c.label}=${c.formula}`)).join(", ");
}
