import { describe, expect, it } from "vitest";
import {
  resolveArrayRows,
  resolveFooterRow,
  resolveNestedTableRows,
  resolveRowFromItem,
  resolveTableRows,
  resolveTextValue,
  resolveTopLevelTableRows,
} from "../../src/pdf/resolvers";
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

describe("resolveTableRows", () => {
  it("value undefined -> retorna schema.content (preview de design)", () => {
    const schema = makeTable({ content: [["preview1", "preview2"]] });
    expect(resolveTableRows(schema, undefined)).toEqual([["preview1", "preview2"]]);
  });

  it("value é um array JSON válido -> retorna o array parseado", () => {
    const schema = makeTable({ content: [["preview1", "preview2"]] });
    const rows = resolveTableRows(schema, JSON.stringify([["a", "1"], ["b", "2"]]));
    expect(rows).toEqual([["a", "1"], ["b", "2"]]);
  });

  it("value é JSON inválido -> cai pro schema.content", () => {
    const schema = makeTable({ content: [["preview1", "preview2"]] });
    expect(resolveTableRows(schema, "{not valid json")).toEqual([["preview1", "preview2"]]);
  });

  it("value é JSON válido mas não é array -> cai pro schema.content", () => {
    const schema = makeTable({ content: [["preview1", "preview2"]] });
    expect(resolveTableRows(schema, JSON.stringify({ a: 1 }))).toEqual([["preview1", "preview2"]]);
  });
});

describe("resolveRowFromItem — precedência célula a célula", () => {
  it("token de design ({...} em content[0][i]) vence, ignora binding.columns pra essa célula", () => {
    const tableSchema = makeTable({
      head: ["produto", "qtd"],
      content: [["{nome}", "5"]],
    });
    const binding: Extract<Binding, { type: "array" }> = {
      schemaName: "tabela",
      type: "array",
      path: "rows",
      columns: ["outro", "qtd"],
    };
    const item = { nome: "Caneta Azul", qtd: 2, outro: "não deveria aparecer" };
    const row = resolveRowFromItem(tableSchema, item, binding);
    // col0: content[0][0] = "{nome}" tem token -> renderiza contra o item,
    // NÃO usa binding.columns[0] ("outro"), mesmo com binding presente.
    expect(row[0]).toBe("Caneta Azul");
  });

  it("sem token de design, binding.columns (string) vence sobre o rótulo do cabeçalho", () => {
    const tableSchema = makeTable({
      head: ["produto", "qtd"],
      content: [["", ""]],
    });
    const binding: Extract<Binding, { type: "array" }> = {
      schemaName: "tabela",
      type: "array",
      path: "rows",
      columns: ["nomeProduto", "quantidade"],
    };
    const item = { nomeProduto: "Caneta", quantidade: 7, produto: "ERRADO", qtd: 99 };
    const row = resolveRowFromItem(tableSchema, item, binding);
    expect(row).toEqual(["Caneta", "7"]);
  });

  it("sem token de design, binding.columns com {label,formula} vence sobre o rótulo do cabeçalho", () => {
    const tableSchema = makeTable({
      head: ["produto", "total"],
      content: [["", ""]],
    });
    const binding: Extract<Binding, { type: "array" }> = {
      schemaName: "tabela",
      type: "array",
      path: "rows",
      columns: ["produto", { label: "Total", formula: "{qtd} un" }],
    };
    const item = { produto: "Caneta", qtd: 3 };
    const row = resolveRowFromItem(tableSchema, item, binding);
    expect(row).toEqual(["Caneta", "3 un"]);
  });

  it("sem token de design e sem binding.columns pra essa célula -> cai pro rótulo do cabeçalho como path direto no item", () => {
    const tableSchema = makeTable({
      head: ["produto", "qtd"],
      content: [["", ""]],
    });
    const item = { produto: "Lápis", qtd: 10 };
    const row = resolveRowFromItem(tableSchema, item, undefined);
    expect(row).toEqual(["Lápis", "10"]);
  });

  it("valor ausente/null vira string vazia", () => {
    const tableSchema = makeTable({
      head: ["produto", "qtd"],
      content: [["", ""]],
    });
    const row = resolveRowFromItem(tableSchema, { produto: "X" }, undefined);
    expect(row).toEqual(["X", ""]);
  });
});

describe("resolveArrayRows", () => {
  it("mapeia cada item do array via resolveRowFromItem", () => {
    const tableSchema = makeTable({
      head: ["produto", "qtd"],
      content: [["", ""]],
    });
    const arr = [
      { produto: "A", qtd: 1 },
      { produto: "B", qtd: 2 },
    ];
    const rows = resolveArrayRows(tableSchema, arr, undefined);
    expect(rows).toEqual([["A", "1"], ["B", "2"]]);
  });
});

describe("resolveFooterRow", () => {
  it("footer undefined -> undefined", () => {
    const tableSchema = makeTable({ footer: undefined });
    expect(resolveFooterRow(tableSchema, {})).toBeUndefined();
  });

  it("footer vazio -> undefined", () => {
    const tableSchema = makeTable({ footer: [] });
    expect(resolveFooterRow(tableSchema, {})).toBeUndefined();
  });

  it("footer com {token} em cada célula, renderizado via renderTemplate contra o dado resolvido", () => {
    const tableSchema = makeTable({ footer: ["Total: {SUM(rows.total)}", "Fixo"] });
    const resolveData = { rows: [{ total: 10 }, { total: 15 }] };
    expect(resolveFooterRow(tableSchema, resolveData)).toEqual(["Total: 25", "Fixo"]);
  });
});

describe("resolveTextValue", () => {
  it("binding type 'template' usa binding.template como o texto a renderizar", () => {
    const binding: Binding = { schemaName: "campo", type: "template", template: "Olá {nome}" };
    const result = resolveTextValue("conteúdo ignorado", binding, { nome: "Maria" });
    expect(result).toBe("Olá Maria");
  });

  it("binding type 'scalar' envolve binding.path em {} e resolve contra o dado", () => {
    const binding: Binding = { schemaName: "campo", type: "scalar", path: "cliente.nome" };
    const result = resolveTextValue("conteúdo ignorado", binding, { cliente: { nome: "João" } });
    expect(result).toBe("João");
  });

  it("sem binding (undefined) -> usa o próprio content como template", () => {
    const result = resolveTextValue("Olá {nome}", undefined, { nome: "Ana" });
    expect(result).toBe("Olá Ana");
  });

  it("binding de outro tipo (ex: 'keyvalue') -> também cai pro content como template", () => {
    const binding: Binding = { schemaName: "campo", type: "keyvalue", paths: ["a", "b"] };
    const result = resolveTextValue("Olá {nome}", binding, { nome: "Pedro" });
    expect(result).toBe("Olá Pedro");
  });
});
