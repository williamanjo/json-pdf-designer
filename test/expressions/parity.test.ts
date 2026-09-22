import { describe, expect, it } from "vitest";
import { renderTemplate } from "../../src/bindings/bindings";

// Parity with the previous engine (the string-to-string rewriter the AST
// replaced). Each case here was PROBED against the 2.0.0 build before the
// swap, and the expected value is what that engine produced — not what looks
// right today. It is the proof that the replacement regressed nothing.
//
// The cases the previous engine GOT WRONG (precedence, grouping) and the ones
// it brought down with an exception (text in arithmetic, division by zero)
// live in evaluate.test.ts, under "the four defects", precisely because there
// the behavior CHANGED on purpose.

const data = {
  a: 2,
  b: 3,
  c: 4,
  nome: "Ana",
  valor: 10,
  custo: 4,
  texto: "Lucro (bruto)",
  itens: [{ t: 5 }, { t: 7 }],
  "my-key": "ok-hifen",
  "my key": "ok-espaco",
  "a-b": "literal",
  txt: "x",
  pago: "true",
  zero: 0,
  vazio: "",
  s: "x>y",
};

// [description, template, the previous engine's output]
const CASES: [string, string, string][] = [
  // The lexical rule: an operator is only an operator surrounded by whitespace.
  ["path com hífen", "{my-key}", "ok-hifen"],
  ["path com espaço", "{my key}", "ok-espaco"],
  ["path que parece subtração", "{a-b}", "literal"],
  ["subtração de verdade", "{a - b}", "-1"],
  ["operador com espaço só antes", "{a -b}", ""],
  ["operador com espaço só depois", "{a- b}", ""],

  // splitDelimited: quotes and nested parentheses.
  ["literal com vírgula dentro", '{CONCAT("a, b", nome)}', "a, bAna"],
  ["literal com parêntese dentro", '{CONCAT("a (b)", nome)}', "a (b)Ana"],
  ["função aninhada em função", '{CONCAT("tot: ", NUMBER(valor, 2))}', "tot: 10.00"],
  ["path cujo valor tem parêntese", "{texto}", "Lucro (bruto)"],
  ["UPPER de valor com parêntese", "{UPPER(texto)}", "LUCRO (BRUTO)"],

  // An aggregator followed by an operator — the case that motivated the
  // balanced-parentheses guard in the previous engine (before it, this gave "0").
  ["SUM menos path", "{SUM(itens.t) - custo}", "8"],
  ["SUM menos literal", "{SUM(itens.t) - 2}", "10"],
  ["SUM simples", "{SUM(itens.t)}", "12"],
  ["COUNT", "{COUNT(itens)}", "2"],
  ["SUM de array inexistente", "{SUM(nada.x)}", "0"],
  ["AVG de array inexistente", "{AVG(nada.x)}", "0"],

  // IF.
  ["IF com comparação", '{IF(valor > 5, "alto", "baixo")}', "alto"],
  ["IF com parêntese no ramo", '{IF(valor > 5, "a (b)", "c")}', "a (b)"],
  ["IF comparando com > dentro da string", '{IF(s == "x>y", "sim", "nao")}', "sim"],
  ["IF sem espaço no == não é comparação", '{IF(a==2, "S", "N")}', "N"],
  ["IF por verdade/falsidade", '{IF(pago, "S", "N")}', "S"],
  ["IF falso por vazio", '{IF(vazio, "S", "N")}', "N"],
  ["IF falso por zero", '{IF(zero, "S", "N")}', "N"],
  ["IF preguiçoso", "{IF(a > 1, a, naoexiste.profundo.demais)}", "2"],
  ["IF aninhado", '{IF(a > 1, IF(b > 2, "aa", "ab"), "b")}', "aa"],

  // Formatadores e defaults.
  ["NUMBER sem casas", "{NUMBER(a)}", "2.00"],
  ["NUMBER de não-número", "{NUMBER(txt, 2)}", ""],
  ["CURRENCY default", "{CURRENCY(a)}", "2,00"],
  ["DATE default", '{DATE("2026-07-01")}', "01/07/2026"],

  // Arithmetic and path resolution.
  ["ruído de float arredondado", "{12 * 22.9}", "274.8"],
  ["path ausente vale 0 na conta", "{naoexiste + a}", "2"],
  ["função desconhecida", "{FOO(a)}", ""],
  ["texto fixo em volta do token", "Olá {nome}!", "Olá Ana!"],
  ["dois tokens no mesmo texto", "{nome} tem {COUNT(itens)}", "Ana tem 2"],
  ["chave sem token", "sem token nenhum", "sem token nenhum"],
];

describe("paridade com o motor de expressões anterior", () => {
  for (const [label, template, expected] of CASES) {
    it(`${label}: ${template}`, () => {
      expect(renderTemplate(template, data)).toBe(expected);
    });
  }
});
