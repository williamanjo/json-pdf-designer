import type { Binding, Template } from "json-pdf-designer/server";

// The initial state's sample JSON, INLINE (not a separate .json).
//
// Deliberately small but with a real shape: two levels of nested object
// (`company.address.city`), TWO arrays of objects (`sales` and `refunds` — so
// the field explorer can be seen offering two sources, and the table/chart
// binding choosing between them) and an array of simple values (`tags`), which
// is the case where the explorer shows the source with no column at all to
// offer (see lib/jsonExplorer.ts).
export const initialSample = {
  company: {
    name: "Acme Travel",
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

// The editor's initial state — TWO output pages, so the page tabs
// (PageTabs) already have something to show on open, and to make visible that
// `pages` is the source of truth when present (the flat `page`/`schemas`
// fields below are still there only as a fallback for whoever reads this
// Template without looking at `pages`).
//
// Page 1: a header + a table bound to `sales` + a footer with
// {pageNumber}/{pageCount} (synthetic tokens, resolved per page at generation
// time — with no binding at all).
// Page 2: a KPI with its aggregation written as a free expression and a pie
// chart over the SAME `sales` array.
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

// The chart NEEDS a binding to draw anything (text/KPI accept a {token}
// directly); the table renders without a binding too (it would use the literal
// head/content), but bound is the interesting case — each item of `sales`
// becomes a row. Without the chart's binding, the "Template problems" panel
// points at it.
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
