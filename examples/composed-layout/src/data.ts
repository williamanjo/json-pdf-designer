import type { Binding, Template } from "json-pdf-designer";

// Template e dado de exemplo, inline e pequenos DE PROPÓSITO: o assunto
// deste example é LAYOUT, não dado. (O report-builder tem um sample de
// 111KB, que aqui só serviria pra deixar o bundle grande — os 6 exemplos
// prontos do dropdown, em data/templates/, já trazem sample próprio cada.)
//
// Ele cresceu de 2 chaves pra esta forma quando o explorador de campos
// entrou: com um objeto raso a árvore de `lib/jsonExplorer.ts` fica plana e
// não mostra nada. Agora tem objeto aninhado (`empresa`, `periodo`) e DOIS
// arrays de objetos (`rows`, `metas`) — que é o que faz aparecer grupo
// colapsável, coluna individual arrastável e dois "Data Source" no dropdown
// do editor de vínculo.

export const sample = {
  empresa: {
    nome: "Voetur Turismo",
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

// O dropdown "Data Source" do editor de vínculo era alimentado por uma
// constante escrita à mão aqui. Agora ele vem do EXPLORADOR DE CAMPOS: cada
// array de objetos que o `extractFields` acha no JSON carregado vira uma
// opção (ver App.tsx). Trocar de fonte de dados passa a mudar o dropdown
// junto, o que a constante nunca fazia.
