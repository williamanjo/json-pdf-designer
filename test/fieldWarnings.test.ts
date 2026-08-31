import { describe, expect, it } from "vitest";
import { fieldWarning, filterIncomplete } from "../src/fieldWarnings";
import { en } from "../src/i18n/en";
import type { Binding, ChartSchema, SectionSchema, TextSchema } from "../src/types";

function makeSection(overrides: Partial<SectionSchema> = {}): SectionSchema {
  return {
    id: "s1",
    name: "secao",
    type: "section",
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    ...overrides,
  };
}

function makeChart(overrides: Partial<ChartSchema> = {}): ChartSchema {
  return {
    id: "c1",
    name: "grafico",
    type: "chart",
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    chartType: "bar",
    displayMode: "number",
    ...overrides,
  };
}

function makeText(overrides: Partial<TextSchema> = {}): TextSchema {
  return {
    id: "t1",
    name: "texto",
    type: "text",
    x: 0,
    y: 0,
    width: 100,
    height: 10,
    content: "oi",
    fontSize: 10,
    fontColor: "#000000",
    alignment: "left",
    ...overrides,
  };
}

function makeArrayBinding(overrides: Partial<Extract<Binding, { type: "array" }>> = {}): Extract<Binding, { type: "array" }> {
  return {
    schemaName: "tabela",
    type: "array",
    path: "rows",
    columns: ["a"],
    ...overrides,
  };
}

function makeChartBinding(overrides: Partial<Extract<Binding, { type: "chart" }>> = {}): Extract<Binding, { type: "chart" }> {
  return {
    schemaName: "grafico",
    type: "chart",
    path: "rows",
    labelColumn: "nome",
    valueColumn: "valor",
    ...overrides,
  };
}

function makeKpiBinding(overrides: Partial<Extract<Binding, { type: "kpi" }>> = {}): Extract<Binding, { type: "kpi" }> {
  return {
    schemaName: "kpi",
    type: "kpi",
    path: "rows",
    aggregation: "sum",
    ...overrides,
  };
}

describe("filterIncomplete", () => {
  it("binding undefined retorna false", () => {
    expect(filterIncomplete(undefined)).toBe(false);
  });

  it("binding de tipo não chart/array/kpi (ex: scalar) retorna false", () => {
    const scalar: Binding = { schemaName: "t", type: "scalar", path: "algo" };
    expect(filterIncomplete(scalar)).toBe(false);
  });

  it("grupo de filtro com coluna escolhida e valor vazio retorna true", () => {
    const binding = makeArrayBinding({ filters: [[{ column: "nome", op: "eq", value: "" }]] });
    expect(filterIncomplete(binding)).toBe(true);
  });

  it("grupo de filtro com coluna escolhida e valor só de espaços em branco retorna true", () => {
    const binding = makeChartBinding({ filters: [[{ column: "nome", op: "eq", value: "   " }]] });
    expect(filterIncomplete(binding)).toBe(true);
  });

  it("coluna escolhida com valor preenchido (não em branco) retorna false", () => {
    const binding = makeKpiBinding({ filters: [[{ column: "nome", op: "eq", value: "abc" }]] });
    expect(filterIncomplete(binding)).toBe(false);
  });

  it("sem filtros nenhum retorna false", () => {
    const binding = makeArrayBinding({ filters: undefined });
    expect(filterIncomplete(binding)).toBe(false);
    const bindingEmpty = makeArrayBinding({ filters: [] });
    expect(filterIncomplete(bindingEmpty)).toBe(false);
  });
});

describe("fieldWarning", () => {
  it("section sem binding retorna a mensagem de missingBinding", () => {
    expect(fieldWarning(makeSection(), undefined, en)).toBe(en.warnings.missingBinding);
  });

  it("chart sem binding retorna a mensagem de missingBinding", () => {
    expect(fieldWarning(makeChart(), undefined, en)).toBe(en.warnings.missingBinding);
  });

  it("outros tipos de schema (ex: text) sem binding retornam null", () => {
    expect(fieldWarning(makeText(), undefined, en)).toBeNull();
  });

  it("binding presente mas com filtro incompleto retorna a mensagem de incompleteFilter", () => {
    const binding = makeChartBinding({ filters: [[{ column: "nome", op: "eq", value: "" }]] });
    expect(fieldWarning(makeChart(), binding, en)).toBe(en.warnings.incompleteFilter);
  });

  it("configuração totalmente válida retorna null", () => {
    const binding = makeChartBinding();
    expect(fieldWarning(makeChart(), binding, en)).toBeNull();
  });
});
