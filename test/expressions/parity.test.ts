import { describe, expect, it } from "vitest";
import { renderTemplate } from "../../src/bindings/bindings";

// Paridade com o motor anterior (o reescritor string-para-string que a AST
// substituiu). Cada caso aqui foi SONDADO contra o build 2.0.0 antes da troca,
// e o valor esperado é o que aquele motor produzia — não o que parece certo
// hoje. É a prova de que a substituição não regrediu nada.
//
// Os casos que o motor anterior ERRAVA (precedência, agrupamento) e os que ele
// derrubava com exceção (texto em conta, divisão por zero) ficam em
// evaluate.test.ts, sob "os quatro defeitos", justamente porque ali o
// comportamento MUDOU de propósito.

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

// [descrição, template, saída do motor anterior]
const CASES: [string, string, string][] = [
  // A regra lexical: operador só é operador cercado de espaço.
  ["path com hífen", "{my-key}", "ok-hifen"],
  ["path com espaço", "{my key}", "ok-espaco"],
  ["path que parece subtração", "{a-b}", "literal"],
  ["subtração de verdade", "{a - b}", "-1"],
  ["operador com espaço só antes", "{a -b}", ""],
  ["operador com espaço só depois", "{a- b}", ""],

  // splitDelimited: aspas e parênteses aninhados.
  ["literal com vírgula dentro", '{CONCAT("a, b", nome)}', "a, bAna"],
  ["literal com parêntese dentro", '{CONCAT("a (b)", nome)}', "a (b)Ana"],
  ["função aninhada em função", '{CONCAT("tot: ", NUMBER(valor, 2))}', "tot: 10.00"],
  ["path cujo valor tem parêntese", "{texto}", "Lucro (bruto)"],
  ["UPPER de valor com parêntese", "{UPPER(texto)}", "LUCRO (BRUTO)"],

  // Agregador seguido de operador — o caso que motivou o guarda de
  // parênteses balanceados no motor anterior (antes dele, dava "0").
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

  // Aritmética e resolução de path.
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
