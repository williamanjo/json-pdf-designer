import type { Template, Binding } from "json-pdf-designer";
import financeiroSample from "../samples/financeiroSample.json";
import type { ExampleDefinition } from "./types";

// Exemplo: "Relatório Financeiro" — duas tabelas soltas (sem seção),
// empilhadas em sequência (cada uma com sua linha de totais própria via
// {CURRENCY(SUM(...))}), e um saldo calculado por aritmética sobre dois
// valores já resolvidos, formatado como moeda de verdade
// ({CURRENCY(totalReceitas - totalDespesas)}). Sem título de texto solto
// ENTRE as duas tabelas — texto/imagem posicionado entre dois blocos
// (tabela/seção) não fica entre eles no PDF final, sempre vai parar depois
// de todos (limitação documentada em generate.ts); a categoria de cada
// tabela aqui é o próprio cabeçalho colorido, não um texto à parte.
const template: Template = {
  version: 1,
  page: { width: 210, height: 297 },
  schemas: [
    {
      id: "financeiro-titulo",
      name: "financeiro_titulo",
      type: "text",
      x: 10,
      y: 12,
      width: 190,
      height: 8,
      content: "Relatório Financeiro — {periodo.mes}/{periodo.ano}",
      fontSize: 13,
      fontColor: "#111111",
      alignment: "center",
      backgroundColor: "#dbeafe",
      borderColor: "#2563eb",
      borderWidth: 0.2,
    },
    {
      id: "financeiro-receitas-tabela",
      name: "financeiro_receitas_tabela",
      type: "table",
      x: 10,
      y: 24,
      width: 190,
      height: 35,
      head: ["Receitas", "Valor"],
      content: [["{descricao}", "{CURRENCY(valor)}"]],
      footer: ["Total", '{CURRENCY(SUM(receitas.valor), "R$")}'],
      headBackgroundColor: "#065f46",
      headTextColor: "#ffffff",
    },
    {
      id: "financeiro-despesas-tabela",
      name: "financeiro_despesas_tabela",
      type: "table",
      x: 10,
      y: 64,
      width: 190,
      height: 42,
      head: ["Despesas", "Valor"],
      content: [["{descricao}", "{CURRENCY(valor)}"]],
      footer: ["Total", '{CURRENCY(SUM(despesas.valor), "R$")}'],
      headBackgroundColor: "#991b1b",
      headTextColor: "#ffffff",
    },
    {
      id: "financeiro-saldo",
      name: "financeiro_saldo",
      type: "text",
      x: 10,
      y: 112,
      width: 190,
      height: 8,
      content: 'Saldo do período: {CURRENCY(resumoFinanceiro.totalReceitas - resumoFinanceiro.totalDespesas, "R$")}',
      fontSize: 11,
      fontColor: "#111111",
      alignment: "right",
    },
  ],
};

const bindings: Binding[] = [
  { schemaName: "financeiro_receitas_tabela", type: "array", path: "receitas", columns: ["descricao", { label: "Valor", formula: "{CURRENCY(valor)}" }] },
  { schemaName: "financeiro_despesas_tabela", type: "array", path: "despesas", columns: ["descricao", { label: "Valor", formula: "{CURRENCY(valor)}" }] },
];

export const financeiroExample: ExampleDefinition = {
  label: "Relatório Financeiro (duas tabelas)",
  template,
  bindings,
  sample: financeiroSample,
  sourceName: "financeiro",
};
