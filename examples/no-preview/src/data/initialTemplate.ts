import type { Binding, Template } from "json-pdf-designer";

// The app's initial state — what appears before choosing any example from the
// dropdown (those live in ./templates/). It is not part of EXAMPLES.
//
// The sample stays INLINE, as a TypeScript object, on purpose: report-builder
// loads a 111KB `samples/initialSample.json` and this example does not copy
// that file. The initial JSON here has to fit in the reading of whoever opens
// the repo — but be large enough for the field explorer to have something to
// show: two levels of nested object (`empresa`, `periodo`) and TWO arrays
// (`vendas`, `metas`), which is the minimum to prove that the tree groups by
// DataSource and that a lone column is draggable apart from its group.

export const initialSample = {
  empresa: {
    nome: "Acme Turismo",
    cnpj: "00.000.000/0001-00",
    contato: { email: "relatorios@exemplo.com.br", telefone: "(61) 0000-0000" },
  },
  periodo: { mes: "Agosto/2026", inicio: "2026-08-01", fim: "2026-08-31" },
  vendas: [
    { regiao: "Sudeste", bilhetes: 412, total: 128400 },
    { regiao: "Sul", bilhetes: 238, total: 74200 },
    { regiao: "Nordeste", bilhetes: 197, total: 61900 },
    { regiao: "Centro-Oeste", bilhetes: 106, total: 33500 },
    { regiao: "Norte", bilhetes: 71, total: 21800 },
  ],
  metas: [
    { regiao: "Sudeste", meta: 120000, atingido: true },
    { regiao: "Sul", meta: 80000, atingido: false },
    { regiao: "Nordeste", meta: 55000, atingido: true },
    { regiao: "Centro-Oeste", meta: 40000, atingido: false },
    { regiao: "Norte", meta: 25000, atingido: false },
  ],
};

// A minimal template: a title with a {token} coming from a NESTED object
// (`{periodo.mes}` — text with no binding falls back to the free template,
// resolved against the whole document), a table bound to `vendas` and a footer
// with the native numbering. Enough to prove that full generation (text +
// table + pagination) works without pdf.js.
export const initialTemplate: Template = {
  version: 1,
  page: { width: 210, height: 297 }, // A4 em mm
  headerHeight: 15,
  footerHeight: 15,
  schemas: [
    {
      id: "titulo",
      name: "titulo",
      type: "text",
      x: 15,
      y: 4,
      width: 180,
      height: 8,
      content: "Vendas — {periodo.mes}",
      fontSize: 14,
      fontColor: "#0f172a",
      alignment: "left",
    },
    {
      id: "tabela",
      name: "tabela",
      type: "table",
      x: 15,
      y: 25,
      width: 180,
      height: 60,
      head: ["Região", "Bilhetes", "Total"],
      content: [["—", "—", "—"]],
    },
    {
      id: "rodape",
      name: "numeracao_pagina",
      type: "text",
      x: 15,
      y: 285,
      width: 180,
      height: 8,
      // {pageNumber}/{pageCount} are the engine's NATIVE tokens: they resolve
      // per page at generation time, with no binding, and only count in a field
      // that falls in the header/footer/margin (this one falls in the footer,
      // footerHeight=15).
      content: "Página {pageNumber} de {pageCount}",
      fontSize: 9,
      fontColor: "#64748b",
      alignment: "right",
    },
  ],
};

// The table pulls from `vendas`; the title and the footer need no binding.
export const initialBindings: Binding[] = [
  { schemaName: "tabela", type: "array", path: "vendas", columns: ["regiao", "bilhetes", "total"] },
];
