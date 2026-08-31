import { describe, expect, it } from "vitest";
import {
  buildChartBinding,
  buildKpiBinding,
  buildSectionBinding,
  buildTableBinding,
  buildTemplateBinding,
} from "../../src/bindings/builders";
import type { Binding } from "../../src/types";

describe("buildSectionBinding", () => {
  it("draft vazio (ou só espaço) não produz binding", () => {
    expect(buildSectionBinding("s1", "")).toBeUndefined();
    expect(buildSectionBinding("s1", "   ")).toBeUndefined();
  });

  it("draft preenchido produz binding de section com path aparado", () => {
    expect(buildSectionBinding("s1", "  itens  ")).toEqual({
      schemaName: "s1",
      type: "section",
      path: "itens",
    });
  });
});

describe("buildChartBinding", () => {
  it("sem label não produz binding", () => {
    expect(buildChartBinding("c1", "itens", "", "valor", undefined)).toBeUndefined();
  });

  it("sem value não produz binding", () => {
    expect(buildChartBinding("c1", "itens", "categoria", "", undefined)).toBeUndefined();
  });

  it("sem draft (path) não produz binding mesmo com label e value", () => {
    expect(buildChartBinding("c1", "  ", "categoria", "valor", undefined)).toBeUndefined();
  });

  it("com draft, label e value produz binding de chart correto", () => {
    expect(buildChartBinding("c1", " itens ", "categoria", "valor", undefined)).toEqual({
      schemaName: "c1",
      type: "chart",
      path: "itens",
      labelColumn: "categoria",
      valueColumn: "valor",
      filters: undefined,
    });
  });

  it("preserva filters do binding existente quando o tipo já era chart", () => {
    const existing: Binding = {
      schemaName: "c1",
      type: "chart",
      path: "itens",
      labelColumn: "categoria",
      valueColumn: "valor",
      filters: [[{ column: "categoria", op: "eq", value: "A" }]],
    };
    expect(buildChartBinding("c1", "itens", "categoria", "valor", existing)).toEqual({
      schemaName: "c1",
      type: "chart",
      path: "itens",
      labelColumn: "categoria",
      valueColumn: "valor",
      filters: [[{ column: "categoria", op: "eq", value: "A" }]],
    });
  });

  it("não herda filters de um binding existente de outro tipo", () => {
    const existing: Binding = { schemaName: "c1", type: "section", path: "itens" };
    expect(buildChartBinding("c1", "itens", "categoria", "valor", existing)).toEqual({
      schemaName: "c1",
      type: "chart",
      path: "itens",
      labelColumn: "categoria",
      valueColumn: "valor",
      filters: undefined,
    });
  });
});

describe("buildTableBinding", () => {
  it("sem path (draft vazio) cai em keyvalue, usando cols como paths", () => {
    expect(buildTableBinding("t1", "", "nome, email", undefined)).toEqual({
      schemaName: "t1",
      type: "keyvalue",
      paths: ["nome", "email"],
    });
  });

  it("sem path e sem cols não produz binding", () => {
    expect(buildTableBinding("t1", "", "", undefined)).toBeUndefined();
    expect(buildTableBinding("t1", "   ", "   ", undefined)).toBeUndefined();
  });

  it("com path mas sem colunas parseáveis não produz binding", () => {
    expect(buildTableBinding("t1", "itens", "", undefined)).toBeUndefined();
  });

  it("com path e colunas produz binding de array com colunas parseadas", () => {
    expect(buildTableBinding("t1", " itens ", "produto, qtd", undefined)).toEqual({
      schemaName: "t1",
      type: "array",
      path: "itens",
      columns: ["produto", "qtd"],
      filters: undefined,
    });
  });

  it("preserva filters do binding existente quando o tipo já era array", () => {
    const existing: Binding = {
      schemaName: "t1",
      type: "array",
      path: "itens",
      columns: ["produto"],
      filters: [[{ column: "produto", op: "contains", value: "x" }]],
    };
    expect(buildTableBinding("t1", "itens", "produto", existing)).toEqual({
      schemaName: "t1",
      type: "array",
      path: "itens",
      columns: ["produto"],
      filters: [[{ column: "produto", op: "contains", value: "x" }]],
    });
  });
});

describe("buildKpiBinding", () => {
  it("aggregation 'count' sem value ainda produz binding válido", () => {
    expect(buildKpiBinding("k1", "itens", "", "count", undefined)).toEqual({
      schemaName: "k1",
      type: "kpi",
      path: "itens",
      valueColumn: undefined,
      aggregation: "count",
      filters: undefined,
    });
  });

  it("aggregation não-count sem value não produz binding", () => {
    expect(buildKpiBinding("k1", "itens", "", "sum", undefined)).toBeUndefined();
    expect(buildKpiBinding("k1", "itens", "", "avg", undefined)).toBeUndefined();
    expect(buildKpiBinding("k1", "itens", "", "min", undefined)).toBeUndefined();
    expect(buildKpiBinding("k1", "itens", "", "max", undefined)).toBeUndefined();
  });

  it("aggregation não-count com value produz binding, ignorando value quando count", () => {
    expect(buildKpiBinding("k1", "itens", "valor", "sum", undefined)).toEqual({
      schemaName: "k1",
      type: "kpi",
      path: "itens",
      valueColumn: "valor",
      aggregation: "sum",
      filters: undefined,
    });
    // count sempre zera valueColumn, mesmo se `value` estiver preenchido
    expect(buildKpiBinding("k1", "itens", "valor", "count", undefined)).toEqual({
      schemaName: "k1",
      type: "kpi",
      path: "itens",
      valueColumn: undefined,
      aggregation: "count",
      filters: undefined,
    });
  });

  it("draft vazio nunca produz binding, mesmo com count", () => {
    expect(buildKpiBinding("k1", "", "", "count", undefined)).toBeUndefined();
    expect(buildKpiBinding("k1", "   ", "", "count", undefined)).toBeUndefined();
  });

  it("preserva filters do binding existente quando o tipo já era kpi", () => {
    const existing: Binding = {
      schemaName: "k1",
      type: "kpi",
      path: "itens",
      aggregation: "count",
      filters: [[{ column: "status", op: "eq", value: "ok" }]],
    };
    expect(buildKpiBinding("k1", "itens", "", "count", existing)).toEqual({
      schemaName: "k1",
      type: "kpi",
      path: "itens",
      valueColumn: undefined,
      aggregation: "count",
      filters: [[{ column: "status", op: "eq", value: "ok" }]],
    });
  });
});

describe("buildTemplateBinding", () => {
  it("draft vazio (ou só espaço) não produz binding", () => {
    expect(buildTemplateBinding("x1", "")).toBeUndefined();
    expect(buildTemplateBinding("x1", "   ")).toBeUndefined();
  });

  it("draft preenchido produz binding de template, preservando espaços internos sem aparar", () => {
    expect(buildTemplateBinding("x1", " {nome} ")).toEqual({
      schemaName: "x1",
      type: "template",
      template: " {nome} ",
    });
  });
});
