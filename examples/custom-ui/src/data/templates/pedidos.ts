import type { Template, Binding } from "json-pdf-designer";
import pedidosSample from "../samples/pedidosSample.json";
import type { ExampleDefinition } from "./types";

// Exemplo: "Pedidos com Itens" — seção (data band) repetindo por pedido,
// com uma tabela ANINHADA de verdade dentro dela (vínculo "array" relativo
// ao item, path "itens") — mestre-detalhe. A coluna "Subtotal" usa
// aritmética por linha com casas decimais controladas
// ({NUMBER(qtd * preco, 2)}); o total geral soma um campo de verdade do
// item (SUM(pedidos.valorTotal)) formatado como moeda.
const template: Template = {
  version: 1,
  page: { width: 210, height: 297 },
  schemas: [
    {
      id: "pedidos-empresa",
      name: "pedidos_empresa",
      type: "text",
      x: 10,
      y: 8,
      width: 190,
      height: 6,
      content: "{empresa.nome} — CNPJ: {empresa.cnpj}",
      fontSize: 10,
      fontColor: "#0f172a",
      alignment: "left",
    },
    {
      id: "pedidos-titulo",
      name: "pedidos_titulo",
      type: "text",
      x: 10,
      y: 16,
      width: 190,
      height: 8,
      content: "Pedidos do Período",
      fontSize: 12,
      fontColor: "#1e1b4b",
      alignment: "center",
      backgroundColor: "#e0e7ff",
      borderColor: "#4338ca",
      borderWidth: 0.2,
    },
    {
      id: "pedidos-secao",
      name: "pedidos_secao",
      type: "section",
      x: 10,
      y: 28,
      width: 190,
      height: 30,
    },
    {
      id: "pedidos-item-info",
      name: "pedidos_item_info",
      type: "text",
      x: 10,
      y: 28,
      width: 190,
      height: 6,
      content: 'Pedido {numero} — Cliente: {cliente} — {DATE(data, "DD/MM/YYYY")}',
      fontSize: 9,
      fontColor: "#111111",
      alignment: "left",
      sectionId: "pedidos-secao",
    },
    {
      id: "pedidos-itens-tabela",
      name: "pedidos_itens_tabela",
      type: "table",
      x: 10,
      y: 35,
      width: 190,
      height: 14,
      head: ["Produto", "Qtd", "Preço Unit.", "Subtotal"],
      content: [["{produto}", "{qtd}", "{CURRENCY(preco)}", "{NUMBER(qtd * preco, 2)}"]],
      sectionId: "pedidos-secao",
    },
    {
      id: "pedidos-valor-total",
      name: "pedidos_valor_total",
      type: "text",
      x: 10,
      y: 51,
      width: 190,
      height: 6,
      content: "Valor total do pedido: {CURRENCY(valorTotal)}",
      fontSize: 9,
      fontColor: "#065f46",
      alignment: "left",
      sectionId: "pedidos-secao",
    },
    {
      id: "pedidos-total-geral",
      name: "pedidos_total_geral",
      type: "text",
      x: 10,
      y: 64,
      width: 190,
      height: 8,
      content: 'Total geral de pedidos: {CURRENCY(SUM(pedidos.valorTotal), "R$")}',
      fontSize: 11,
      fontColor: "#111111",
      alignment: "right",
    },
  ],
};

const bindings: Binding[] = [
  { schemaName: "pedidos_secao", type: "section", path: "pedidos" },
  {
    schemaName: "pedidos_itens_tabela",
    type: "array",
    path: "itens",
    columns: ["produto", "qtd", { label: "Preço Unit.", formula: "{CURRENCY(preco)}" }, { label: "Subtotal", formula: "{NUMBER(qtd * preco, 2)}" }],
  },
];

export const pedidosExample: ExampleDefinition = {
  label: "Pedidos com Itens (seção + tabela aninhada)",
  template,
  bindings,
  sample: pedidosSample,
  sourceName: "pedidos",
};
