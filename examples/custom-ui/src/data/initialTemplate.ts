import type { Template, Binding } from "json-pdf-designer";
import initialSample from "./samples/initialSample.json";

// A ready-made example: a fixed header, a table bound to "rows" (large
// enough to paginate across 2 pages) and a footer with "Page X of Y"
// numbering — the {pageNumber}/{pageCount} tokens are resolved per page at
// generation time, with no binding needed (they work directly in the field's
// text). It is the app's initial state (before any example from the dropdown
// is chosen) — it is not part of data/templates/ (those are the dropdown's).
export { initialSample };

export const initialTemplate: Template = {
  version: 1,
  page: { width: 210, height: 297 }, // A4 em mm
  headerHeight: 15,
  footerHeight: 15,
  schemas: [
    {
      id: "exemplo-header",
      name: "titulo_relatorio",
      type: "text",
      x: 10,
      y: 4,
      width: 190,
      height: 8,
      content: "Relatório de Vendas — Passagens e Hospedagem",
      fontSize: 12,
      fontColor: "#0f172a",
      alignment: "left",
    },
    {
      id: "exemplo-tabela",
      name: "tabela_vendas",
      type: "table",
      x: 10,
      y: 20,
      width: 190,
      height: 30,
      head: ["PNR", "Passageiro", "Tarifa", "Taxa", "Total"],
      content: [["PNR0000", "Nome do Passageiro", "100.00", "10.00", "110.00"]],
    },
    {
      id: "exemplo-footer",
      name: "numeracao_pagina",
      type: "text",
      x: 10,
      y: 285,
      width: 190,
      height: 8,
      content: "Página {pageNumber} de {pageCount}",
      fontSize: 9,
      fontColor: "#64748b",
      alignment: "right",
    },
  ],
};

export const initialBindings: Binding[] = [
  {
    schemaName: "tabela_vendas",
    type: "array",
    path: "rows",
    columns: ["pnr_locator", "traveler_name", "fare_amount", "tax_amount", "total_amount"],
  },
];
