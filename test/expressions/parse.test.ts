import { describe, expect, it } from "vitest";
import { parse } from "../../src/expressions/engine/parse";
import { ExpressionSyntaxError, tokenize } from "../../src/expressions/engine/tokenize";

describe("tokenize — a regra lexical do formato", () => {
  // A regra central: um operador só é operador quando tem espaço em branco
  // dos DOIS lados. Fora disso pertence ao identificador. Template salvo em
  // produção depende disso — chave JSON com hífen ou espaço é comum.
  it("operador cercado de espaço é operador", () => {
    expect(tokenize("a - b").map((t) => t.kind)).toEqual(["ident", "op", "ident"]);
  });

  it("hífen encostado no texto faz parte do identificador", () => {
    expect(tokenize("my-key")).toEqual([{ kind: "ident", value: "my-key", source: "my-key", start: 0 }]);
  });

  it("espaço dentro do identificador é preservado (chave JSON com espaço)", () => {
    expect(tokenize("my key")).toEqual([{ kind: "ident", value: "my key", source: "my key", start: 0 }]);
  });

  it("operador com espaço de um lado só NÃO é operador", () => {
    for (const src of ["a -b", "a- b"]) {
      expect(tokenize(src).map((t) => t.kind), src).toEqual(["ident"]);
    }
  });

  it("comparação de 2 caracteres vem antes da de 1 (>= não é > seguido de =)", () => {
    const tokens = tokenize("a >= b");
    expect(tokens[1]).toEqual({ kind: "compare", value: ">=", source: ">=", start: 2 });
  });

  it("literal numérico puro vira number, não path", () => {
    expect(tokenize("2")).toEqual([{ kind: "number", value: 2, source: "2", start: 0 }]);
    expect(tokenize("-3.5")).toEqual([{ kind: "number", value: -3.5, source: "-3.5", start: 0 }]);
  });

  it("string entre aspas preserva vírgula, parêntese e operador dentro", () => {
    expect(tokenize('"a, (b) - c"')).toEqual([{ kind: "string", value: "a, (b) - c", source: '"a, (b) - c"', start: 0 }]);
  });

  it("aspas não fechadas dão erro apontando a posição", () => {
    expect(() => tokenize('CONCAT("abc)')).toThrow(ExpressionSyntaxError);
    expect(() => tokenize('CONCAT("abc)')).toThrow(/position 7/);
  });
});

describe("parse — AST", () => {
  it("path simples", () => {
    expect(parse("cliente.nome")).toEqual({ kind: "path", segments: ["cliente", "nome"] });
  });

  it("chamada de função com argumentos", () => {
    expect(parse('CONCAT(nome, " ", 2)')).toEqual({
      kind: "call",
      name: "CONCAT",
      args: [
        { kind: "path", segments: ["nome"] },
        { kind: "text", value: " " },
        { kind: "number", value: 2, text: "2" },
      ],
      argSources: ["nome", '" "', "2"],
    });
  });

  it("nome de função é normalizado pra maiúscula", () => {
    expect(parse("sum(itens.t)")).toMatchObject({ kind: "call", name: "SUM" });
  });

  it("chamada sem argumento nenhum", () => {
    expect(parse("COUNT()")).toEqual({ kind: "call", name: "COUNT", args: [], argSources: [] });
  });

  it("`*` liga mais forte que `+` — a AST reflete a precedência", () => {
    // a + (b * c), não (a + b) * c
    expect(parse("a + b * c")).toEqual({
      kind: "binary",
      op: "+",
      left: { kind: "path", segments: ["a"] },
      right: { kind: "binary", op: "*", left: { kind: "path", segments: ["b"] }, right: { kind: "path", segments: ["c"] } },
    });
  });

  it("mesma precedência associa à esquerda", () => {
    // (a - b) - c
    expect(parse("a - b - c")).toEqual({
      kind: "binary",
      op: "-",
      left: { kind: "binary", op: "-", left: { kind: "path", segments: ["a"] }, right: { kind: "path", segments: ["b"] } },
      right: { kind: "path", segments: ["c"] },
    });
  });

  it("parêntese agrupa de verdade, invertendo a precedência", () => {
    expect(parse("(a + b) * c")).toEqual({
      kind: "binary",
      op: "*",
      left: { kind: "binary", op: "+", left: { kind: "path", segments: ["a"] }, right: { kind: "path", segments: ["b"] } },
      right: { kind: "path", segments: ["c"] },
    });
  });

  it("comparação é o nível de menor precedência", () => {
    expect(parse("a + 1 == b")).toEqual({
      kind: "compare",
      op: "==",
      left: { kind: "binary", op: "+", left: { kind: "path", segments: ["a"] }, right: { kind: "number", value: 1, text: "1" } },
      right: { kind: "path", segments: ["b"] },
    });
  });

  it("nó de número guarda o texto do autor junto do valor", () => {
    // Dois campos em vez de um opcional: "número sempre carrega o texto que
    // foi escrito" passa a ser garantia do tipo, não convenção. É o que faz
    // {2.50} renderizar "2.50" e ainda valer 2.5 numa conta.
    expect(parse("2.50")).toEqual({ kind: "number", value: 2.5, text: "2.50" });
    expect(parse("007")).toEqual({ kind: "number", value: 7, text: "007" });
  });

  it("argSources guarda o texto cru — SUM precisa do path do array, não do valor", () => {
    // `itens.total` não é "o valor em itens.total", é "a coluna total do
    // array itens". Sem o texto cru o agregador perderia essa distinção.
    expect(parse("SUM(itens.total)")).toMatchObject({ argSources: ["itens.total"] });
  });

  it("token vazio vira texto vazio em vez de erro", () => {
    expect(parse("")).toEqual({ kind: "text", value: "" });
    expect(parse("   ")).toEqual({ kind: "text", value: "" });
  });

  it("parêntese não fechado dá erro de sintaxe, não resultado silencioso", () => {
    expect(() => parse("(a + b")).toThrow(ExpressionSyntaxError);
    expect(() => parse("CONCAT(a, b")).toThrow(/Unclosed parenthesis/);
  });

  it("aninhamento absurdo estoura no limite de profundidade, sem derrubar a stack do V8", () => {
    const deep = "CURRENCY(".repeat(60) + "valor" + ")".repeat(60);
    expect(() => parse(deep)).toThrow(/nesting too deep/i);
  });
});
