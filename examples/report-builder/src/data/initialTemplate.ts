import type { Template, Binding } from "json-pdf-designer";
import initialSample from "./samples/initialSample.json";

// Exemplo pronto: cabeçalho fixo, tabela vinculada a "rows" (grande o
// bastante pra paginar em 2 páginas) e rodapé com numeração "Página X de Y"
// — os tokens {pageNumber}/{pageCount} são resolvidos por página na hora
// de gerar, sem precisar de vínculo (funcionam direto no texto do campo).
// É o estado inicial do app (antes de qualquer exemplo do dropdown ser
// escolhido) — não faz parte de data/templates/ (esses são os do dropdown).
export { initialSample };

export const initialTemplate: Template = {
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
