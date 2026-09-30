import { describe, expect, it } from "vitest";
import { ExpressionSyntaxError } from "../../src/expressions/errors";
import { parse } from "../../src/expressions/engine/parse";
import { renderTemplate } from "../../src/bindings/bindings";
import { tokenize } from "../../src/expressions/engine/tokenize";

// BRACKETED PATH.
//
// The bare form (`{a.b}`) resolves almost every JSON key, but not all: a key
// with a LITERAL dot in its name had no form at all (the dot always separated
// segments), nor did a key with `(`/`)`/`,`/`"`, nor one with an operator
// surrounded by spaces. `{[...]}` names all of them.
//
// The case that separates the dot's two semantics — and the reason the AST's
// `path` node carries `segments: string[]` instead of a string — is the pair
// `{[cliente].[nome]}` (it walks) against `{[cliente.nome]}` (a literal key).
// A dotted string cannot represent both.

const item = {
  id: "A1",
  cliente: { nome: "ANINHADO" },
  "cliente.nome": "LITERAL",
  "token name": "COM ESPACO",
  total: 10,
  'a"b': "QUOTE DUPLA",
  "[a]": "COM BRACKET",
  "my-key": "HIFEN",
  "my key": "NU COM ESPACO",
};

describe("path entre brackets — a forma nova", () => {
  const casos: [string, string][] = [
    ["{[id]}", "A1"],
    ["{[cliente].[nome]}", "ANINHADO"],
    // THE PAIR THAT MATTERS: the dot INSIDE the bracket does not separate.
    ["{[cliente.nome]}", "LITERAL"],
    ['{["token name"]}', "COM ESPACO"],
    // A single quote for a key containing a double quote — swap the quote
    // instead of escaping.
    ["{['a\"b']}", "QUOTE DUPLA"],
    // The key whose NAME has a bracket, which is the only compat case that changed.
    ['{["[a]"]}', "COM BRACKET"],
    // An operator OUTSIDE the bracket is an operator.
    ["{[total] + 1}", "11"],
    // A bare tail after a bracketed segment.
    ["{[cliente].nome}", "ANINHADO"],
  ];

  for (const [template, esperado] of casos) {
    it(`${template} -> ${esperado}`, () => {
      expect(renderTemplate(template, item)).toBe(esperado);
    });
  }

  it("path bracketado como argumento de função", () => {
    expect(renderTemplate('{CURRENCY([total], "R$", 2)}', item)).toBe("R$ 10,00");
  });

  it("o nó da AST carrega os segmentos, não uma string com pontos", () => {
    // É a diferença observável entre os dois casos acima. Se um dia alguém
    // trocar `segments` de volta por `path: string`, estes dois viram o mesmo
    // objeto e o teste cai.
    expect(parse("[cliente].[nome]")).toEqual({ kind: "path", segments: ["cliente", "nome"] });
    expect(parse("[cliente.nome]")).toEqual({ kind: "path", segments: ["cliente.nome"] });
  });
});

describe("path entre brackets — compat da forma nua", () => {
  // O contrato antigo, inteiro. Se qualquer um destes mudar, template salvo em
  // produção passa a renderizar diferente — é o que impede a sintaxe nova de
  // ser uma quebra silenciosa.
  const casos: [string, string][] = [
    ["{id}", "A1"],
    ["{cliente.nome}", "ANINHADO"],
    ["{my-key}", "HIFEN"],
    ["{my key}", "NU COM ESPACO"],
  ];

  for (const [template, esperado] of casos) {
    it(`${template} continua sendo o path de sempre`, () => {
      expect(renderTemplate(template, item)).toBe(esperado);
    });
  }

  it("a forma nua com ponto continua caminhando, e não vira chave literal", () => {
    // O contrário do `{[cliente.nome]}` — o mesmo texto, sem brackets, tem o
    // significado oposto. É a razão de os dois testes existirem em par.
    expect(renderTemplate("{cliente.nome}", item)).toBe("ANINHADO");
    expect(renderTemplate("{[cliente.nome]}", item)).toBe("LITERAL");
  });
});

describe("path entre brackets — o que é recusado, e por quê", () => {
  function erroDe(source: string): string {
    try {
      tokenize(source);
    } catch (err) {
      if (err instanceof ExpressionSyntaxError) return err.code;
      throw err;
    }
    return "(não lançou)";
  }

  it("espaço sem quotes é recusado em vez de adivinhado", () => {
    // `[a + b]` é ambíguo entre a chave "a + b" e uma conta dentro do
    // bracket. Escolher um dos dois em silêncio é pior que recusar.
    expect(erroDe("[a b]")).toBe("spaceInSegment");
    expect(erroDe("[a + b]")).toBe("spaceInSegment");
  });

  it("bracket sem fechar e segmento vazio têm código próprio", () => {
    expect(erroDe("[a")).toBe("unclosedBracket");
    expect(erroDe("[]")).toBe("emptySegment");
    expect(erroDe('["a"')).toBe("unclosedBracket");
  });

  it("quote sem fechar dentro do bracket", () => {
    expect(erroDe('["a b')).toBe("unclosedQuote");
  });

  it("controle: a forma válida NÃO lança", () => {
    // Anti-vacuidade — sem isto, um `tokenize` que lançasse em tudo deixaria
    // os casos acima verdes.
    expect(erroDe("[a]")).toBe("(não lançou)");
    expect(erroDe('["a b"]')).toBe("(não lançou)");
  });
});
