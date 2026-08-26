import type { Template, Binding } from "json-pdf-designer";

// Template fixo (não tem explorador de campos nem múltiplas fontes JSON
// neste example — propositalmente enxuto, só pra provar que a casca do
// editor dá pra montar sem NENHUM componente pronto do pacote). O usuário
// ainda edita/arrasta os campos dentro do <Designer> normalmente.
export const reciboTemplate: Template = {
  page: { width: 210, height: 297 },
  // >= (297 - footerHeight) mm classifica um campo como rodapé (ver
  // classifyZone) — precisa cobrir o "rodape" (y: 285) abaixo, senão ele
  // conta como corpo por acidente e passa a virar "chão" pra novos campos.
  footerHeight: 15,
  schemas: [
    {
      id: "titulo",
      name: "titulo",
      type: "text",
      x: 10,
      y: 10,
      width: 190,
      height: 8,
      content: "Recibo de Pagamento",
      fontSize: 14,
      fontColor: "#111111",
      alignment: "left",
    },
    {
      id: "cliente-info",
      name: "cliente_info",
      type: "text",
      x: 10,
      y: 20,
      width: 190,
      height: 6,
      content: 'Cliente: {cliente.nome} — Data: {DATE(data, "DD/MM/YYYY")}',
      fontSize: 10,
      fontColor: "#333333",
      alignment: "left",
    },
    {
      id: "itens-tabela",
      name: "itens_tabela",
      type: "table",
      x: 10,
      y: 32,
      width: 190,
      height: 25,
      head: ["Item", "Qtd", "Valor"],
      content: [["{descricao}", "{quantidade}", "{CURRENCY(valor)}"]],
      footer: ["", "Total", "{SUM(itens.valor)}"],
      headBackgroundColor: "#1e293b",
      headTextColor: "#ffffff",
    },
    {
      id: "rodape",
      name: "rodape",
      type: "text",
      x: 10,
      y: 285,
      width: 190,
      height: 6,
      content: "Obrigado pela preferência.",
      fontSize: 9,
      fontColor: "#666666",
      alignment: "left",
    },
  ],
};

export const reciboBindings: Binding[] = [
  { schemaName: "itens_tabela", type: "array", path: "itens", columns: ["descricao", "quantidade", "valor"] },
];

// Dados fabricados (sem nome/empresa real nenhum) — o textarea de dados
// no App já vem preenchido com isso, editável antes de gerar.
export const reciboSampleData = {
  cliente: { nome: "Cliente Exemplo" },
  data: "2026-07-31",
  itens: [
    { descricao: "Serviço de exemplo A", quantidade: 2, valor: 150.0 },
    { descricao: "Serviço de exemplo B", quantidade: 1, valor: 89.9 },
  ],
};
