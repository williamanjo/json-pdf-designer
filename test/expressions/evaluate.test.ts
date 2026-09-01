import { describe, expect, it } from "vitest";
import { evaluate, evaluateToString, isTruthy } from "../../src/expressions/evaluate";
import { FUNCTION_NAMES } from "../../src/expressions/functions";
import { parse } from "../../src/expressions/parse";
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
  // Estes quatro são o motivo de a AST existir. Cada um produzia número
  // errado ou exceção num template plausível de relatório.

  it("precedência de operador: `a + b * c` é 14, não 20", () => {
    // O motor anterior dobrava da esquerda pra direita, como calculadora de
    // bolso: (2 + 3) * 4 = 20. Número errado, sem erro nenhum.
    expect(run("a + b * c")).toBe("14");
  });

  it("agrupamento por parêntese: `(a + b) * c` é 20, não 0", () => {
    // O motor anterior não reconhecia `(` no início: o regex de chamada de
    // função não casava, a aritmética não sabia agrupar, e o resultado virava
    // 0 em silêncio.
    expect(run("(a + b) * c")).toBe("20");
  });

  it('texto em conta aritmética dá vazio, não exceção: `"x" + 1`', () => {
    // O motor anterior entrava em recursão infinita e estourava no limite de
    // profundidade, com uma mensagem sobre "aninhamento" que não tinha nada a
    // ver com o problema.
    expect(run('"x" + 1')).toBe("");
  });

  it("divisão por zero dá vazio, não exceção: `a / zero`", () => {
    // Mesma recursão infinita do caso acima — e este é uma entrada
    // perfeitamente plausível (denominador que zera numa linha).
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
    expect(run("12 * 22.9")).toBe("274.8"); // não 274.79999999999995
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
    // Sem o formato de entrada, o new Date() do JS leria 10/04 como outubro.
    expect(run('DATE("10/04/2025", "DD/MM/YYYY", "DD/MM/YYYY")')).toBe("10/04/2025");
    expect(run('DATE("10/04/2025", "MM-YYYY", "DD/MM/YYYY")')).toBe("04-2025");
  });

  it("IF é preguiçoso — o ramo não escolhido não é avaliado", () => {
    // Se o ramo `senão` fosse avaliado, um path que não resolve traria vazio
    // ou pior; o teste garante que o `então` é o único caminho percorrido.
    expect(run("IF(a > 1, a, nada.profundo.demais)")).toBe("2");
    expect(run("IF(a > 5, nada.profundo.demais, b)")).toBe("3");
  });

  it("IF sem operador de comparação usa verdade/falsidade do valor", () => {
    expect(run('IF(pago, "S", "N")')).toBe("S");
    expect(run('IF(vazio, "S", "N")')).toBe("N");
    expect(run('IF(zero, "S", "N")')).toBe("N");
  });

  it("função desconhecida dá vazio, não erro (degrada em campo em branco)", () => {
    // Template escrito para uma versão mais nova do pacote não derruba a
    // geração inteira.
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
    // O motor anterior devolvia string em todo nível e reconvertia; é daí que
    // vinham os bugs de conta.
    expect(evaluate(parse("a + b"), data)).toBe(5);
    expect(typeof evaluate(parse("SUM(itens.t)"), data)).toBe("number");
  });
});

describe("registry de funções", () => {
  it("cobre exatamente os nomes que a UI oferece em CUSTOM_FIELD_FUNCTIONS", () => {
    // A lista alimenta os botões de "inserir função" do painel. Adicionar
    // função lá sem implementar aqui (ou o contrário) falha no CI em vez de
    // virar um botão que produz campo vazio.
    expect(FUNCTION_NAMES.slice().sort()).toEqual(CUSTOM_FIELD_FUNCTIONS.map((f) => f.name).sort());
  });
});
