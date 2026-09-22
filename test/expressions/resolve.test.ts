import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generatePdf } from "../../src/pdf/generate";
import {
  evaluateConditionLenient,
  expressionError,
  renderTemplateLenient,
  templateExpressionErrors,
} from "../../src/expressions/resolve";
import { renderTemplate } from "../../src/bindings/bindings";
import { fieldWarning, expressionErrors } from "../../src/fieldWarnings";
import { en } from "../../src/i18n/locales/en";
import { ptBR } from "../../src/i18n/locales/pt-BR";
import { parse } from "../../src/expressions/engine/parse";
import { ExpressionSyntaxError } from "../../src/expressions/errors";
import { suspiciousOperator } from "../../src/expressions/suspicious";
import type { Binding, Schema } from "../../src/types";

const data = { a: 2, b: 3, pago: "true", cancelado: "", total: 1500, tipo: "empresa" };

describe("tolerância na geração", () => {
  // The parser is strict on purpose, but GENERATION cannot be: before the
  // AST, a forgotten `{CONCAT(a,)}` left THAT field empty. If the parse blew
  // up at generation time, the same mistake would bring the whole PDF down —
  // trading "one blank field" for "no report" would be a step backwards.

  it("expressão inválida resolve pra vazio em vez de estourar", () => {
    for (const src of ["{a == b == c}", "{a) b}", "{SUM(a) SUM(b)}", "{(a + b}", '{CONCAT("x}']) {
      expect(renderTemplate(src, data), src).toBe("");
    }
  });

  it("um token ruim não contamina os outros tokens do mesmo texto", () => {
    // The blast radius is the token, not the whole field nor the document.
    expect(renderTemplate("ok={a} ruim={a) b} depois={b}", data)).toBe("ok=2 ruim= depois=3");
  });

  it("vírgula sobrando antes do `)` continua tolerada", () => {
    // The previous engine accepted it (splitDelimited discarded the empty
    // part). Blowing up here would break a template that renders today.
    expect(renderTemplate("{CONCAT(a,)}", data)).toBe("2");
    expect(renderTemplate("{CONCAT(a, b,)}", data)).toBe("23");
  });

  it("renderTemplateLenient e renderTemplate se comportam igual", () => {
    expect(renderTemplateLenient("{a} {a) b}", data)).toBe(renderTemplate("{a} {a) b}", data));
  });
});

describe("literal numérico preserva o texto escrito", () => {
  // The previous engine returned the literal's raw text; passing it through
  // Number would eat the decimal places the author wrote.
  it("mantém casas decimais e zeros à esquerda", () => {
    expect(renderTemplate("{2.50}", data)).toBe("2.50");
    expect(renderTemplate("{1.10}", data)).toBe("1.10");
    expect(renderTemplate("{0.0}", data)).toBe("0.0");
    expect(renderTemplate("{007}", data)).toBe("007");
  });

  it("mas numa conta o valor é coagido normalmente", () => {
    expect(renderTemplate("{2.50 + 0}", data)).toBe("2.5");
    expect(renderTemplate("{2.50 * 2}", data)).toBe("5");
  });
});

describe("AND / OR / NOT", () => {
  it("combina condições", () => {
    expect(renderTemplate("{a > 1 AND b > 2}", data)).toBe("true");
    expect(renderTemplate("{a > 1 AND b > 5}", data)).toBe("false");
    expect(renderTemplate("{a > 5 OR b > 2}", data)).toBe("true");
    expect(renderTemplate("{a > 5 OR b > 5}", data)).toBe("false");
  });

  it("NOT nega, no começo da expressão ou depois de um operador", () => {
    expect(renderTemplate("{NOT cancelado}", data)).toBe("true");
    expect(renderTemplate("{NOT pago}", data)).toBe("false");
    expect(renderTemplate("{pago AND NOT cancelado}", data)).toBe("true");
  });

  it("AND liga mais forte que OR", () => {
    // false OR (true AND true) = true. If OR bound tighter it would give
    // (false OR true) AND true = true as well, so the decisive case is this
    // one: true OR (false AND false) = true, vs (true OR false) AND false = false.
    expect(renderTemplate("{a > 1 OR a > 5 AND b > 5}", data)).toBe("true");
  });

  it("parêntese muda o agrupamento lógico", () => {
    expect(renderTemplate("{(a > 1 OR a > 5) AND b > 5}", data)).toBe("false");
  });

  it("é case-insensitive, igual nome de função", () => {
    expect(renderTemplate("{a > 1 and b > 2}", data)).toBe("true");
    expect(renderTemplate("{not cancelado}", data)).toBe("true");
  });

  it("sem espaço dos dois lados NÃO é operador — continua sendo path", () => {
    // The format's lexical rule holds for word operators too: a JSON key
    // called "AND" has to stay reachable.
    expect(renderTemplate("{AND}", { AND: "chave" })).toBe("chave");
    expect(renderTemplate("{a AND b}", { "a AND b": "chave-com-and" })).toBe("false");
  });

  it("curto-circuita — o lado direito não é avaliado quando já decidiu", () => {
    expect(renderTemplate("{cancelado AND naoexiste.profundo.demais}", data)).toBe("false");
    expect(renderTemplate("{pago OR naoexiste.profundo.demais}", data)).toBe("true");
  });
});

describe("evaluateConditionLenient", () => {
  it("avalia a condição como verdade/falsidade", () => {
    expect(evaluateConditionLenient('tipo == "empresa"', data)).toBe(true);
    expect(evaluateConditionLenient("total > 5000", data)).toBe(false);
    expect(evaluateConditionLenient("pago", data)).toBe(true);
    expect(evaluateConditionLenient("cancelado", data)).toBe(false);
  });

  it("condição inválida cai no fallback (visível), não em invisível", () => {
    // A typo must not make a field silently disappear from the report.
    expect(evaluateConditionLenient("a) b", data)).toBe(true);
    expect(evaluateConditionLenient("a) b", data, false)).toBe(false);
  });
});

describe("detecção de erro pro aviso do editor", () => {
  it("expressionError devolve null pra expressão válida", () => {
    expect(expressionError("total > 1000")).toBeNull();
    expect(expressionError('CONCAT(a, " ", b)')).toBeNull();
  });

  it("expressionError descreve o problema e a posição", () => {
    // With no dictionary, English — it is the library message convention, and
    // what a backend logs. With a dictionary, see the language test below.
    expect(expressionError("a) b")).toMatch(/Leftover content.*position/);
    expect(expressionError("(a + b")).toMatch(/Unclosed parenthesis.*position/);
  });

  it("templateExpressionErrors aponta cada token ruim de um texto", () => {
    const errors = templateExpressionErrors("ok={a} ruim={a) b} outro={(x}");
    expect(errors.map((e) => e.token)).toEqual(["{a) b}", "{(x}"]);
    expect(errors[0].message).toMatch(/position/);
  });

  it("posição do erro é o offset EXATO, com espaço no meio e token repetido", () => {
    // Two wrong ways to do this: indexOf points at the first occurrence of the
    // token's text; summing the tokens' lengths ignores the whitespace between
    // them. Each token keeps its own offset (see `start` in tokenize.ts).
    //
    //  "a + b) c"  -> the leftover ")" is at index 5
    //   012345
    expect(expressionError("a + b) c")).toMatch(/position 5 /);
    // A repeated token: the second ")" is the leftover one, at index 1 (the
    // first already ended the expression).
    expect(expressionError("a) + a)")).toMatch(/position 1 /);
  });
});

describe("aviso no campo", () => {
  const textSchema = (content: string, visibleWhen?: string): Schema => ({
    id: "t",
    name: "titulo",
    type: "text",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    content,
    fontSize: 10,
    fontColor: "#000",
    alignment: "left",
    visibleWhen,
  });

  it("campo com expressão válida não gera aviso", () => {
    expect(fieldWarning(textSchema("Olá {nome}"), undefined, en)).toBeNull();
  });

  it("conteúdo com expressão inválida gera aviso dizendo que renderiza vazio", () => {
    const warning = fieldWarning(textSchema("Total: {a) b}"), undefined, en);
    expect(warning).toMatch(/Invalid expression in "content" — renders empty/);
  });

  it("visibleWhen inválido gera aviso apontando o campo certo", () => {
    const warning = fieldWarning(textSchema("ok", "a) b"), undefined, en);
    expect(warning).toMatch(/Invalid expression in "visibleWhen"/);
  });

  it("erro de sintaxe vem ANTES de vínculo faltando na prioridade", () => {
    // The syntax is already producing wrong output; a missing binding is
    // half-finished configuration.
    const chart: Schema = {
      id: "c", name: "graf", type: "chart", x: 0, y: 0, width: 10, height: 10,
      chartType: "pie", visibleWhen: "a) b",
    } as Schema;
    expect(fieldWarning(chart, undefined, en)).toMatch(/Invalid expression/);
  });

  it("fórmula de coluna calculada é um TEMPLATE, não expressão nua", () => {
    // `resolveRowFromItem` passes the formula through `renderTemplate`, so
    // `"FAT-{fatura}"` (fixed text + a token) is legitimate use. Validating it
    // as a bare expression flagged every normal formula — a real false
    // positive, caught by the report-builder example's problems panel.
    const ok: Binding = {
      schemaName: "tab",
      type: "array",
      path: "rows",
      columns: ["id", { label: "Fatura", formula: "FAT-{fatura}" }, { label: "V", formula: "{CURRENCY(valor)}" }],
    };
    const table: Schema = {
      id: "tb", name: "tab", type: "table", x: 0, y: 0, width: 10, height: 10,
      head: ["id", "Fatura", "V"], content: [],
    };
    expect(expressionErrors(table, ok)).toEqual([]);
  });

  it("fórmula de coluna com token quebrado é acusada", () => {
    const binding: Binding = {
      schemaName: "tab",
      type: "array",
      path: "rows",
      columns: ["id", { label: "Total", formula: "{SUM(a) SUM(b)}" }],
    };
    const table: Schema = {
      id: "tb", name: "tab", type: "table", x: 0, y: 0, width: 10, height: 10,
      head: ["id", "Total"], content: [],
    };
    const errors = expressionErrors(table, binding);
    expect(errors.map((e) => e.field)).toEqual(["columns[1].formula"]);
  });

  it("linha de totais da tabela é conferida célula por célula", () => {
    const table: Schema = {
      id: "tb", name: "tab", type: "table", x: 0, y: 0, width: 10, height: 10,
      head: ["a", "b"], content: [], footer: ["Total", "{SUM(x) SUM(y)}"],
    };
    expect(expressionErrors(table, undefined).map((e) => e.field)).toEqual(["footer[1]"]);
  });
});

describe("erro de profundidade não derruba a geração", () => {
  // The hole this arrangement of error classes closed: before, the depth
  // guard threw a raw `Error`, and the tolerant layer only caught
  // `ExpressionSyntaxError` — so an absurdly nested expression brought the
  // whole `generatePdf` down. Precisely the case (a malformed or malicious
  // template) in which tolerating matters most.
  const deep = "CURRENCY(".repeat(60) + "valor" + ")".repeat(60);

  it("o parser estrito continua acusando", () => {
    expect(expressionError(deep)).toMatch(/nesting too deep/i);
  });

  it("a geração resolve pra vazio, sem contaminar os outros tokens", () => {
    expect(renderTemplate(`a={a} ruim={${deep}} b={b}`, data)).toBe("a=2 ruim= b=3");
  });

  it("o PDF sai inteiro, com o campo em branco", async () => {
    const template = {
      page: { width: 210, height: 297 },
      schemas: [
        {
          id: "t", name: "titulo", type: "text" as const, x: 10, y: 20, width: 100, height: 10,
          content: `Total: {${deep}}`, fontSize: 10, fontColor: "#000000", alignment: "left" as const,
        },
      ],
    };
    const bytes = await generatePdf(template, data, []);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });
});

describe("idioma da mensagem de erro", () => {
  it("inglês por padrão, e o dicionário decide", () => {
    // A mesma falha aparece em dois lugares com idiomas diferentes: no editor,
    // no idioma do designer, e no `Error.message` de quem chamou `parse` num
    // backend, onde a convenção de biblioteca é inglês.
    expect(expressionError("(a + b")).toContain("Unclosed parenthesis");
    expect(expressionError("(a + b", ptBR)).toContain("Falta fechar o parêntese");
    expect(expressionError("(a + b", en)).toContain("Unclosed parenthesis");
  });

  it("a posição também é traduzida", () => {
    expect(expressionError("a) b")).toContain("position 1");
    expect(expressionError("a) b", ptBR)).toContain("posição 1");
  });

  it("o parâmetro da mensagem sobrevive à tradução", () => {
    // "Falta fechar o parêntese de CONCAT(" — o nome da função é `detail`, e
    // vem da expressão, não do dicionário.
    expect(expressionError("CONCAT(a, b")).toContain("CONCAT(");
    expect(expressionError("CONCAT(a, b", ptBR)).toContain("CONCAT(");
  });

  it("operador suspeito segue o mesmo caminho", () => {
    expect(suspiciousOperator("fatura /")).toContain("whitespace on one side only");
    expect(suspiciousOperator("fatura /", ptBR)).toContain("espaço de um lado só");
  });

  it("`code` identifica a falha sem casar texto", () => {
    // É o que um consumidor usa pra decidir por tipo de erro, em vez de regex
    // numa mensagem que muda de idioma.
    try {
      parse("(a + b");
      throw new Error("devia ter estourado");
    } catch (err) {
      expect(err).toBeInstanceOf(ExpressionSyntaxError);
      expect((err as ExpressionSyntaxError).code).toBe("unclosedParen");
      expect((err as ExpressionSyntaxError).detail).toBe("");
    }
    try {
      parse("CONCAT(a, b");
      throw new Error("devia ter estourado");
    } catch (err) {
      expect((err as ExpressionSyntaxError).code).toBe("unclosedCall");
      expect((err as ExpressionSyntaxError).detail).toBe("CONCAT");
    }
  });
});
