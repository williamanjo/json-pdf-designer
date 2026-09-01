import { describe, it, expect } from "vitest";
import { suspiciousOperator, templateSuspiciousOperators } from "../../src/expressions/suspicious";
import { renderTemplate } from "../../src/bindings/bindings";
import { schemaExpressionErrors } from "../../src/expressions/schemaExpressions";
import { fieldWarning } from "../../src/fieldWarnings";
import type { Schema } from "../../src/types";

// O buraco que estes testes fecham: operador só é operador cercado de espaço
// dos dois lados, então `{fatura /}` é uma expressão VÁLIDA que busca a chave
// "fatura /". Ela não existe, o campo sai vazio, e nada acusava.

describe("suspiciousOperator", () => {
  it("aponta operador com espaço de um lado só", () => {
    for (const source of ["fatura /", "fatura +", "/ fatura", "fatura /2", "a >=b", "a>= b", "total -desconto"]) {
      expect(suspiciousOperator(source), source).not.toBeNull();
    }
  });

  it("diz qual operador e onde", () => {
    const message = suspiciousOperator("fatura /");
    expect(message).toContain('"/"');
    expect(message).toContain('"fatura /"');
  });

  it("cala em operador de verdade", () => {
    for (const source of ["a / b", "a + b", "a == b", "a AND b", "NOT pago", "IF(a > 5, 1, 2)"]) {
      expect(suspiciousOperator(source), source).toBeNull();
    }
  });

  it("cala em chave de JSON com operador encostado", () => {
    // A garantia que impede isto de ser erro de sintaxe: `{my-key}`,
    // `{fatura/2}` e `{a==2}` são paths legítimos.
    for (const source of ["my-key", "fatura/2", "a==2", "IF(a==2,1,2)"]) {
      expect(suspiciousOperator(source), source).toBeNull();
    }
  });

  it("cala em sinal de número negativo", () => {
    // `-1` depois de `,` ou de operador é literal negativo, não operador
    // pela metade — e vira token `number`, então nem chega na checagem.
    for (const source of ['CONCAT("x", -1)', "a + -1", "-1", "-5 + 2", "a - -b", "IF(a > 5, -1, 1)"]) {
      expect(suspiciousOperator(source), source).toBeNull();
    }
  });

  it("cala em operador dentro de aspas", () => {
    expect(suspiciousOperator('CONCAT("a > b", nome)')).toBeNull();
    expect(suspiciousOperator('IF(a > 1, "3 / 4", "")')).toBeNull();
  });

  it("cala em palavra que só CONTÉM AND/OR/NOT", () => {
    for (const source of ["FORNECEDOR nome", "NOTAS fiscais", "ANDamento", "cliente ANDRE"]) {
      expect(suspiciousOperator(source), source).toBeNull();
    }
  });

  it("não duplica aviso de expressão que já é erro de sintaxe", () => {
    // `fatura / ` (espaço dos dois lados) já é "Expressão incompleta" — o
    // aviso de suspeita não tem o que acrescentar.
    expect(suspiciousOperator("fatura / ")).toBeNull();
    expect(suspiciousOperator('CONCAT("aspas abertas')).toBeNull();
  });

  it("varre um template token a token", () => {
    const found = templateSuspiciousOperators("FAT-{fatura /} de {cliente} em {mes /2}");
    expect(found.map((f) => f.token)).toEqual(["{fatura /}", "{mes /2}"]);
  });
});

describe("o caso concreto, ponta a ponta", () => {
  const data = { fatura: "01226385" };

  it("renderiza vazio, como antes", () => {
    // O comportamento de RENDER não muda — só passa a ter aviso.
    expect(renderTemplate("FAT-{fatura /}", data)).toBe("FAT-");
    expect(renderTemplate("FAT-{fatura}", data)).toBe("FAT-01226385");
  });

  const schema = {
    id: "s1",
    name: "coluna_fatura",
    type: "text",
    x: 10,
    y: 10,
    width: 50,
    height: 8,
    content: "FAT-{fatura /}",
  } as Schema;

  it("vira problema com severity warning", () => {
    const [problem, ...rest] = schemaExpressionErrors(schema);
    expect(rest).toHaveLength(0);
    expect(problem.severity).toBe("warning");
    expect(problem.field).toBe("content");
    expect(problem.expression).toBe("{fatura /}");
  });

  it("chega no aviso do campo", () => {
    const warning = fieldWarning(schema, undefined);
    expect(warning).toContain("content");
    expect(warning).toContain('"/"');
  });

  it("erro de sintaxe tem prioridade sobre suspeita", () => {
    const both = { ...schema, content: "{fatura /} e {CONCAT(a,,b)}" } as Schema;
    const warning = fieldWarning(both, undefined);
    expect(warning).toContain("renders empty");
  });
});
