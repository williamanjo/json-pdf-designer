import { describe, expect, it } from "vitest";
import { buildInputs, renderTemplate, resolveToken, rowsFromArrayBinding } from "../../src/bindings/bindings";
import type { Binding } from "../../src/types";

describe("resolveToken — funções", () => {
  const rows = { rows: [{ total: 10 }, { total: 20 }, { total: 30 }] };

  it("SUM soma uma coluna de um array", () => {
    expect(resolveToken("SUM(rows.total)", rows)).toBe("60");
  });

  it("COUNT conta itens de um array", () => {
    expect(resolveToken("COUNT(rows)", rows)).toBe("3");
  });

  it("AVG calcula a média de uma coluna", () => {
    expect(resolveToken("AVG(rows.total)", rows)).toBe("20");
  });

  it("CONCAT junta campos e texto fixo, respeitando vírgula entre aspas", () => {
    expect(resolveToken('CONCAT(a, ", ", b)', { a: "x", b: "y" })).toBe("x, y");
  });

  it("UPPER/LOWER trocam caixa", () => {
    expect(resolveToken("UPPER(name)", { name: "abc" })).toBe("ABC");
    expect(resolveToken("LOWER(name)", { name: "ABC" })).toBe("abc");
  });

  it("TRIM tira espaço do início/fim", () => {
    expect(resolveToken("TRIM(name)", { name: "  abc  " })).toBe("abc");
  });

  it("DATE sem formato de entrada lê ISO e formata DD/MM/YYYY", () => {
    expect(resolveToken("DATE(d)", { d: "2025-04-10" })).toBe("10/04/2025");
  });

  it("DATE com formato de entrada DD/MM/YYYY não inverte dia/mês (bug de fuso americano)", () => {
    expect(resolveToken('DATE(d, "DD/MM/YYYY", "DD/MM/YYYY")', { d: "10/04/2025" })).toBe("10/04/2025");
  });

  it("CURRENCY formata em pt-BR com símbolo e casas decimais", () => {
    expect(resolveToken('CURRENCY(v, "R$", 2)', { v: 1234.5 })).toBe("R$ 1.234,50");
  });

  it("NUMBER controla casas decimais sem separador de milhar", () => {
    expect(resolveToken("NUMBER(v, 2)", { v: 12 })).toBe("12.00");
  });
});

describe("resolveToken — aritmética e aninhamento", () => {
  it("resolve expressão aritmética simples entre paths", () => {
    expect(resolveToken("a + b", { a: 2, b: 3 })).toBe("5");
    expect(resolveToken("a * b", { a: 3, b: 4 })).toBe("12");
  });

  it("resolve função aninhada como argumento de outra função", () => {
    const data = { rows: [{ total: 100 }, { total: 50 }] };
    expect(resolveToken('CURRENCY(SUM(rows.total), "R$", 2)', data)).toBe("R$ 150,00");
  });

  it("path sem correspondência no dado vira string vazia", () => {
    expect(resolveToken("nao.existe", { a: 1 })).toBe("");
  });
});

describe("renderTemplate", () => {
  it("troca {token} pelo valor resolvido, preservando texto fixo ao redor", () => {
    const data = { rows: [{ total: 10 }, { total: 20 }], nome: "Cliente" };
    expect(renderTemplate("Total: {SUM(rows.total)} — Cliente: {nome}", data)).toBe("Total: 30 — Cliente: Cliente");
  });
});

describe("buildInputs", () => {
  const data = {
    cliente: "Ana",
    total: 42,
    rows: [
      { produto: "A", qtd: 1 },
      { produto: "B", qtd: 2 },
    ],
  };

  it("scalar resolve o path direto", () => {
    const bindings: Binding[] = [{ schemaName: "campo_total", type: "scalar", path: "total" }];
    expect(buildInputs(data, bindings)).toEqual({ campo_total: "42" });
  });

  it("template resolve {token}s dentro de uma string livre", () => {
    const bindings: Binding[] = [{ schemaName: "saudacao", type: "template", template: "Olá, {cliente}!" }];
    expect(buildInputs(data, bindings)).toEqual({ saudacao: "Olá, Ana!" });
  });

  it("keyvalue monta pares path/valor, cada um uma linha", () => {
    const bindings: Binding[] = [{ schemaName: "resumo", type: "keyvalue", paths: ["cliente", "total"] }];
    expect(JSON.parse(buildInputs(data, bindings).resumo)).toEqual([
      ["cliente", "Ana"],
      ["total", "42"],
    ]);
  });

  it("array vira uma linha por item, uma coluna por chave", () => {
    const bindings: Binding[] = [{ schemaName: "tabela", type: "array", path: "rows", columns: ["produto", "qtd"] }];
    expect(JSON.parse(buildInputs(data, bindings).tabela)).toEqual([
      ["A", "1"],
      ["B", "2"],
    ]);
  });

  it("section não gera entrada em inputs (resolvida à parte na paginação)", () => {
    const bindings: Binding[] = [{ schemaName: "secao", type: "section", path: "rows" }];
    expect(buildInputs(data, bindings)).toEqual({});
  });
});

describe("rowsFromArrayBinding", () => {
  it("resolve coluna crua e coluna calculada (formula) por linha", () => {
    const list = [
      { produto: "A", preco: 10 },
      { produto: "B", preco: 20 },
    ];
    const rows = rowsFromArrayBinding(list, ["produto", { label: "Total", formula: "{CURRENCY(preco, \"R$\", 2)}" }]);
    expect(rows).toEqual([
      ["A", "R$ 10,00"],
      ["B", "R$ 20,00"],
    ]);
  });
});
