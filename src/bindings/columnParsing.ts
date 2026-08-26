import type { TableColumn } from "../types";
import { splitDelimited } from "./splitDelimited";

// Sintaxe de coluna: "coluna" (chave crua) ou "Rótulo=FÓRMULA" (calculada,
// avaliada por linha — ex: "Total (R$)=CURRENCY(total_amount, \"R$\")").
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
