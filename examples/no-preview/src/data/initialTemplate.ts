import type { Binding, Template } from "json-pdf-designer";

// Estado inicial do app — o que aparece antes de escolher qualquer exemplo
// do dropdown (esses moram em ./templates/). Não faz parte do EXAMPLES.
//
// O sample fica INLINE, como objeto TypeScript, de propósito: o
// report-builder carrega um `samples/initialSample.json` de 111KB e este
// example não copia esse arquivo. O JSON inicial daqui tem de caber na
// leitura de quem abre o repo — mas grande o bastante pra o explorador de
// campos ter o que mostrar: dois níveis de objeto aninhado (`empresa`,
// `periodo`) e DOIS arrays (`vendas`, `metas`), que é o mínimo pra provar
// que a árvore agrupa por DataSource e que uma coluna avulsa é arrastável
// separada do grupo.

export const initialSample = {
  empresa: {
    nome: "Voetur Turismo",
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

// Template mínimo: um título com {token} vindo de objeto ANINHADO
// (`{periodo.mes}` — texto sem vínculo cai no template livre, resolvido
// contra o documento inteiro), uma tabela vinculada a `vendas` e um rodapé
// com a numeração nativa. Suficiente pra provar que a geração completa
// (texto + tabela + paginação) funciona sem pdf.js.
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
      // {pageNumber}/{pageCount} são tokens NATIVOS do motor: resolvem por
      // página na hora de gerar, sem vínculo, e só valem em campo que caia
      // no cabeçalho/rodapé/margem (este cai no rodapé, footerHeight=15).
      content: "Página {pageNumber} de {pageCount}",
      fontSize: 9,
      fontColor: "#64748b",
      alignment: "right",
    },
  ],
};

// A tabela puxa de `vendas`; o título e o rodapé não precisam de vínculo.
export const initialBindings: Binding[] = [
  { schemaName: "tabela", type: "array", path: "vendas", columns: ["regiao", "bilhetes", "total"] },
];
