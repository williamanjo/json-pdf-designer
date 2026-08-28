import { describe, expect, it } from "vitest";
import { resolveNestedTableRows, resolveTopLevelTableRows } from "../../src/pdf/resolvers";
import type { Binding, TableSchema } from "../../src/types";

function makeTable(overrides: Partial<TableSchema> = {}): TableSchema {
  return {
    id: "t1",
    name: "tabela",
    type: "table",
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    head: ["produto", "qtd"],
    content: [["produto", "qtd"]],
    ...overrides,
  };
}

describe("resolveTopLevelTableRows — filtro (binding.filters)", () => {
  const data = {
    rows: [
      { produto: "A", qtd: 1 },
      { produto: "B", qtd: 2 },
      { produto: "B", qtd: 5 },
    ],
  };

  it("sem filters, inclui todas as linhas", () => {
    const binding: Binding = { schemaName: "tabela", type: "array", path: "rows", columns: ["produto", "qtd"] };
    const rows = resolveTopLevelTableRows(makeTable(), [binding], data, {});
    expect(rows).toEqual([["A", "1"], ["B", "2"], ["B", "5"]]);
  });

  it("com filters, só inclui linhas que batem", () => {
    const binding: Binding = {
      schemaName: "tabela",
      type: "array",
      path: "rows",
      columns: ["produto", "qtd"],
      filters: [[{ column: "produto", op: "eq", value: "B" }]],
    };
    const rows = resolveTopLevelTableRows(makeTable(), [binding], data, {});
    expect(rows).toEqual([["B", "2"], ["B", "5"]]);
  });

  it("path do binding é case-insensitive, igual chart/kpi (regressão do bug lodash.get vs ciGet)", () => {
    const casedData = { Rows: data.rows };
    const binding: Binding = { schemaName: "tabela", type: "array", path: "rows", columns: ["produto", "qtd"] };
    const rows = resolveTopLevelTableRows(makeTable(), [binding], casedData, {});
    expect(rows).toEqual([["A", "1"], ["B", "2"], ["B", "5"]]);
  });
});

describe("resolveNestedTableRows — filtro em tabela membro de seção (mestre-detalhe)", () => {
  const item = {
    itens: [
      { produto: "X", qtd: 10 },
      { produto: "Y", qtd: 20 },
    ],
  };

  it("com filters, filtra o array aninhado (relativo ao item da seção)", () => {
    const binding: Binding = {
      schemaName: "tabela_membro",
      type: "array",
      path: "itens",
      columns: ["produto", "qtd"],
      filters: [[{ column: "produto", op: "eq", value: "Y" }]],
    };
    const rows = resolveNestedTableRows(makeTable({ name: "tabela_membro" }), item, [binding]);
    expect(rows).toEqual([["Y", "20"]]);
  });
});
