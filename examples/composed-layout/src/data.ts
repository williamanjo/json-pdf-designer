import type { Binding, Template } from "json-pdf-designer";

// A sample template and data, inline and small ON PURPOSE: this example's
// subject is LAYOUT, not data. (report-builder has a 111KB sample, which here
// would only make the bundle large — the 6 ready-made examples of the
// dropdown, in data/templates/, each bring their own sample.)
//
// It grew from 2 keys into this shape when the field explorer landed: with a
// flat object the `lib/jsonExplorer.ts` tree is flat and shows nothing. Now it
// has a nested object (`empresa`, `periodo`) and TWO arrays of objects
// (`rows`, `metas`) — which is what makes a collapsible group, an individually
// draggable column and two "Data Source" entries appear in the binding

export const sample = {
  empresa: {
    nome: "Acme Turismo",
    cnpj: "00.000.000/0001-00",
    cidade: "Brasília/DF",
  },
  periodo: {
    mes: "Setembro",
    ano: 2026,
  },
  responsavel: {
    nome: "Ana Ribeiro",
    email: "ana@example.com",
  },
  rows: [
    { pnr: "ABC123", passageiro: "Ana Ribeiro", trecho: "BSB / GRU", tarifa: 1150.0, taxa: 134.5, total: 1284.5 },
    { pnr: "DEF456", passageiro: "Bruno Lima", trecho: "GRU / REC", tarifa: 660.0, taxa: 82.0, total: 742.0 },
    { pnr: "GHI789", passageiro: "Carla Souza", trecho: "REC / BSB", tarifa: 548.9, taxa: 71.0, total: 619.9 },
    { pnr: "JKL012", passageiro: "Diego Alves", trecho: "BSB / POA", tarifa: 890.3, taxa: 108.0, total: 998.3 },
  ],
  metas: [
    { canal: "Balcão", meta: 2000, realizado: 2026.5 },
    { canal: "Online", meta: 1800, realizado: 1618.2 },
    { canal: "Corporativo", meta: 1200, realizado: 0 },
  ],
};

export const template: Template = {
  version: 1,
  page: { width: 210, height: 297 }, // A4 em mm
  headerHeight: 18,
  footerHeight: 14,
  schemas: [
    {
      id: "cabecalho",
      name: "titulo",
      type: "text",
      x: 10,
      y: 5,
      width: 190,
      height: 8,
      content: "{empresa.nome} — vendas de {periodo.mes}/{periodo.ano}",
      fontSize: 13,
      fontColor: "#0f172a",
      alignment: "left",
    },
    {
      id: "tabela",
      name: "vendas",
      type: "table",
      x: 10,
      y: 25,
      width: 190,
      height: 40,
      head: ["PNR", "Passageiro", "Trecho", "Total"],
      content: [["ABC123", "Ana Ribeiro", "BSB / GRU", "1284.50"]],
    },
    {
      id: "rodape",
      name: "paginacao",
      type: "text",
      x: 10,
      y: 286,
      width: 190,
      height: 6,
      content: "Página {pageNumber} de {pageCount}",
      fontSize: 9,
      fontColor: "#64748b",
      alignment: "right",
    },
  ],
};

export const bindings: Binding[] = [
  {
    schemaName: "vendas",
    type: "array",
    path: "rows",
    columns: ["pnr", "passageiro", "trecho", "total"],
  },
];

// The binding editor's "Data Source" dropdown used to be fed by a constant
// written by hand here. Now it comes from the FIELD EXPLORER: each array of
// objects that `extractFields` finds in the loaded JSON becomes an option (see
// App.tsx). Switching data source now changes the dropdown along with it,
// which the constant never did.
