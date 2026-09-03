import type { Binding, Template } from "json-pdf-designer/server";

// JSON de amostra do estado inicial, INLINE (não um .json à parte).
//
// De propósito pequeno mas com forma de verdade: dois níveis de objeto
// aninhado (`company.address.city`), DOIS arrays de objetos (`sales` e
// `refunds` — dá pra ver o explorador de campos oferecer duas fontes, e o
// vínculo de tabela/gráfico escolher entre elas) e um array de valores
// simples (`tags`), que é o caso em que o explorador mostra a fonte sem
// nenhuma coluna pra oferecer (ver lib/jsonExplorer.ts).
export const initialSample = {
  company: {
    name: "Voetur Turismo",
    taxId: "12.345.678/0001-90",
    address: { city: "Brasília", state: "DF" },
  },
  report: {
    title: "Monthly sales",
    period: { from: "2026-08-01", to: "2026-08-31" },
  },
  sales: [
    { region: "North", agent: "Ana", tickets: 41, total: 4200.5 },
    { region: "South", agent: "Bruno", tickets: 33, total: 3100.0 },
    { region: "East", agent: "Carla", tickets: 26, total: 2600.75 },
    { region: "West", agent: "Diego", tickets: 18, total: 1800.25 },
    { region: "Center", agent: "Elisa", tickets: 22, total: 2210.0 },
  ],
  refunds: [
    { region: "North", reason: "Schedule change", amount: 320.0 },
    { region: "West", reason: "No-show", amount: 180.5 },
  ],
  tags: ["monthly", "internal"],
};

// Estado inicial do editor — DUAS páginas de saída, pra as abas de página
// (PageTabs) já terem o que mostrar ao abrir, e pra deixar visível que
// `pages` é a fonte da verdade quando presente (os campos flat `page`/
// `schemas` abaixo continuam lá só como fallback pra quem lê este Template
// sem olhar `pages`).
//
// Página 1: cabeçalho + tabela vinculada a `sales` + rodapé com
// {pageNumber}/{pageCount} (tokens sintéticos, resolvidos por página na
// hora de gerar — sem vínculo nenhum).
// Página 2: um indicador (KPI) com agregação escrita como expressão livre e
// um gráfico de pizza sobre o MESMO array `sales`.
const page1Schemas: Template["schemas"] = [
  {
    id: "init-title",
    name: "report_title",
    type: "text",
    x: 10,
    y: 4,
    width: 190,
    height: 8,
    content: "{report.title} — {company.name} ({company.address.city}/{company.address.state})",
    fontSize: 12,
    fontColor: "#0f172a",
    alignment: "left",
  },
  {
    id: "init-table",
    name: "sales_table",
    type: "table",
    x: 10,
    y: 22,
    width: 190,
    height: 30,
    head: ["Region", "Agent", "Tickets", "Total"],
    content: [["North", "Ana", "41", "4200.50"]],
  },
  {
    id: "init-footer",
    name: "page_numbering",
    type: "text",
    x: 10,
    y: 285,
    width: 190,
    height: 8,
    content: "Page {pageNumber} of {pageCount}",
    fontSize: 9,
    fontColor: "#64748b",
    alignment: "right",
  },
];

const page2Schemas: Template["schemas"] = [
  {
    id: "init-kpi",
    name: "sales_kpi",
    type: "kpi",
    x: 10,
    y: 20,
    width: 60,
    height: 35,
    icon: "payments",
    title: "Total sold",
    value: "{CURRENCY(SUM(sales.total))}",
    subtitle: "{report.period.from} → {report.period.to}",
    backgroundColor: "#0284c7",
    textColor: "#ffffff",
  },
  {
    id: "init-chart",
    name: "sales_chart",
    type: "chart",
    x: 10,
    y: 65,
    width: 120,
    height: 80,
    chartType: "pie",
    displayMode: "percent",
  },
];

export const initialTemplate: Template = {
  version: 1,
  page: { width: 210, height: 297 }, // A4 em mm
  headerHeight: 15,
  footerHeight: 15,
  schemas: page1Schemas,
  pages: [
    {
      id: "init-page-1",
      page: { width: 210, height: 297 },
      headerHeight: 15,
      footerHeight: 15,
      schemas: page1Schemas,
    },
    {
      id: "init-page-2",
      page: { width: 210, height: 297 },
      schemas: page2Schemas,
    },
  ],
};

// O gráfico PRECISA de vínculo pra desenhar alguma coisa (texto/KPI aceitam
// {token} direto); a tabela renderiza sem vínculo também (usaria head/content
// literal), mas vinculada é o caso interessante — cada item de `sales` vira
// uma linha. Sem o vínculo do gráfico, o painel "Template problems" aponta
// "Missing JSON binding" na hora, que é o recurso #8 em ação.
export const initialBindings: Binding[] = [
  {
    schemaName: "sales_table",
    type: "array",
    path: "sales",
    columns: ["region", "agent", "tickets", "total"],
  },
  {
    schemaName: "sales_chart",
    type: "chart",
    path: "sales",
    labelColumn: "region",
    valueColumn: "total",
  },
];
