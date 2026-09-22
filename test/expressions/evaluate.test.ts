import { describe, expect, it } from "vitest";
import { evaluate, evaluateToString, isTruthy } from "../../src/expressions/engine/evaluate";
import { FUNCTION_NAMES } from "../../src/expressions/engine/functions";
import { parse } from "../../src/expressions/engine/parse";
import { CUSTOM_FIELD_FUNCTIONS } from "../../src/bindings/bindings";

const data = {
  a: 2,
  b: 3,
  c: 4,
  zero: 0,
  txt: "x",
  vazio: "",
  pago: "true",
  itens: [{ t: 5 }, { t: 7 }],
};

const run = (src: string, d: unknown = data) => evaluateToString(parse(src), d);

describe("os quatro defeitos do motor anterior, como regressão", () => {
  // These four are the reason the AST exists. Each produced a wrong number
  // or an exception in a plausible report template.

  it("precedência de operador: `a + b * c` é 14, não 20", () => {
    // The previous engine folded left to right, like a pocket calculator:
    // (2 + 3) * 4 = 20. A wrong number, with no error at all.
    expect(run("a + b * c")).toBe("14");
  });

  it("agrupamento por parêntese: `(a + b) * c` é 20, não 0", () => {
    // The previous engine did not recognize a leading `(`: the function call
    // regex did not match, the arithmetic did not know how to group, and the
    // result silently became 0.
    expect(run("(a + b) * c")).toBe("20");
  });

  it('texto em conta aritmética dá vazio, não exceção: `"x" + 1`', () => {
    // The previous engine went into infinite recursion and blew up on the
    // depth limit, with a message about "nesting" that had nothing to do with
    // the problem.
    expect(run('"x" + 1')).toBe("");
  });

  it("divisão por zero dá vazio, não exceção: `a / zero`", () => {
    // The same infinite recursion as the case above — and this one is a
    // perfectly plausible input (a denominator that hits zero on some row).
    expect(run("a / zero")).toBe("");
  });
});

describe("aritmética", () => {
  it("divisão tem a mesma precedência da multiplicação", () => {
    expect(run("c / a + b")).toBe("5"); // (4/2) + 3
  });

  it("subtração associa à esquerda", () => {
    expect(run("a - b - c")).toBe("-5"); // (2-3)-4
  });

  it("parênteses aninhados", () => {
    expect(run("a * (b + (c - 1))")).toBe("12"); // 2 * (3 + 3)
  });

  it("path ausente entra na conta como 0 (comportamento de sempre)", () => {
    expect(run("naoexiste + a")).toBe("2");
    expect(run("a + naoexiste")).toBe("2");
  });

  it("arredonda ruído de ponto flutuante sem cortar precisão real", () => {
    expect(run("12 * 22.9")).toBe("274.8"); // not 274.79999999999995
    expect(run("1 / 3")).toBe("0.333333");
  });
});

describe("comparação e verdade/falsidade", () => {
  it("comparação numérica, não lexicográfica", () => {
    expect(run("10 > 9")).toBe("true");
  });

  it("comparação de texto é case-insensitive", () => {
    expect(run('txt == "X"', { txt: "x" })).toBe("true");
  });

  it("gt/lt exigem os dois lados numéricos — não bate em vez de bater por engano", () => {
    expect(run('txt > "1"')).toBe("false");
  });

  it("isTruthy: vazio, 0 e false são falsos; o resto é verdadeiro", () => {
    for (const v of ["", "0", "false", "FALSE", "  ", " 0 "]) expect(isTruthy(v), JSON.stringify(v)).toBe(false);
    for (const v of ["x", "1", "true", "-1", 42]) expect(isTruthy(v), JSON.stringify(v)).toBe(true);
  });
});

describe("funções", () => {
  it("SUM/COUNT/AVG operam sobre o PATH do array, não sobre um valor", () => {
    expect(run("SUM(itens.t)")).toBe("12");
    expect(run("COUNT(itens)")).toBe("2");
    expect(run("AVG(itens.t)")).toBe("6");
  });

  it("agregador sobre array inexistente dá 0, não vazio nem erro", () => {
    expect(run("SUM(nada.x)")).toBe("0");
    expect(run("COUNT(nada)")).toBe("0");
    expect(run("AVG(nada.x)")).toBe("0");
  });

  it("NUMBER: 2 casas por default, vazio quando não é número", () => {
    expect(run("NUMBER(a)")).toBe("2.00");
    expect(run("NUMBER(a, 3)")).toBe("2.000");
    expect(run("NUMBER(txt, 2)")).toBe("");
  });

  it("NUMBER: 2º argumento que resolve pra vazio cai no default, não em 0 casas", () => {
    expect(run("NUMBER(a, naoexiste)")).toBe("2.00");
  });

  it("CURRENCY: formata em pt-BR, símbolo opcional", () => {
    expect(run("CURRENCY(a)")).toBe("2,00");
    expect(run('CURRENCY(a, "R$")')).toBe("R$ 2,00");
    expect(run('CURRENCY(a, "R$", 0)')).toBe("R$ 2");
  });

  it("DATE: default DD/MM/YYYY, e o 3º argumento evita a leitura americana", () => {
    expect(run('DATE("2026-07-01")')).toBe("01/07/2026");
    // Without the input format, JS's new Date() would read 10/04 as October.
    expect(run('DATE("10/04/2025", "DD/MM/YYYY", "DD/MM/YYYY")')).toBe("10/04/2025");
    expect(run('DATE("10/04/2025", "MM-YYYY", "DD/MM/YYYY")')).toBe("04-2025");
  });

  it("IF é preguiçoso — o ramo não escolhido não é avaliado", () => {
    // If the `else` branch were evaluated, a path that does not resolve would
    // bring back empty or worse; the test guarantees the `then` is the only
    // path walked.
    expect(run("IF(a > 1, a, nada.profundo.demais)")).toBe("2");
    expect(run("IF(a > 5, nada.profundo.demais, b)")).toBe("3");
  });

  it("IF sem operador de comparação usa verdade/falsidade do valor", () => {
    expect(run('IF(pago, "S", "N")')).toBe("S");
    expect(run('IF(vazio, "S", "N")')).toBe("N");
    expect(run('IF(zero, "S", "N")')).toBe("N");
  });

  it("função desconhecida dá vazio, não erro (degrada em campo em branco)", () => {
    // A template written for a newer version of the package does not bring the
    // whole generation down.
    expect(run("FOO(a)")).toBe("");
  });

  it("TRIM/UPPER/LOWER", () => {
    expect(run("TRIM(esp)", { esp: "  01156189  " })).toBe("01156189");
    expect(run("UPPER(txt)")).toBe("X");
    expect(run("LOWER(txt)", { txt: "ABC" })).toBe("abc");
  });
});

describe("path", () => {
  it("resolve ignorando maiúsculas/minúsculas", () => {
    expect(run("CLIENTE.NOME", { cliente: { nome: "Ana" } })).toBe("Ana");
  });

  it("path que não resolve dá vazio", () => {
    expect(run("nada.de.nada")).toBe("");
  });

  it("preserva o valor exatamente como veio (sem trim implícito)", () => {
    expect(run("fatura", { fatura: " 01156189" })).toBe(" 01156189");
  });
});

describe("tipos intermediários", () => {
  it("evaluate preserva número como número (a base da precedência correta)", () => {
    // The previous engine returned a string at every level and reconverted;
    // that is where the arithmetic bugs came from.
    expect(evaluate(parse("a + b"), data)).toBe(5);
    expect(typeof evaluate(parse("SUM(itens.t)"), data)).toBe("number");
  });
});

describe("registry de funções", () => {
  it("cobre exatamente os nomes que a UI oferece em CUSTOM_FIELD_FUNCTIONS", () => {
    // The list feeds the panel's "insert function" buttons. Adding a function
    // there without implementing it here (or the other way around) fails in CI
    // instead of becoming a button that produces an empty field.
    expect(FUNCTION_NAMES.slice().sort()).toEqual(CUSTOM_FIELD_FUNCTIONS.map((f) => f.name).sort());
  });
});
