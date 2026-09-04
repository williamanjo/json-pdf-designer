import type { ChartFilterOp } from "../../types";
import { compareValues, getCaseInsensitiveSegments, stringifyOrEmpty } from "../dataAccess";
import { FUNCTIONS, type FnContext, type Value } from "./functions";
import type { Expr } from "./parse";

export type { Value };

const COMPARE_OPS: Record<string, ChartFilterOp> = {
  "==": "eq",
  "!=": "neq",
  ">=": "gte",
  "<=": "lte",
  ">": "gt",
  "<": "lt",
};

export function stringify(value: Value): string {
  return typeof value === "number" ? String(value) : value;
}

function toNumber(value: Value): number {
  // Number("") é 0 — de propósito, e é o comportamento de sempre: um path que
  // não resolve entra numa conta como 0, então `{naoexiste + a}` dá o valor de
  // `a` em vez de vazio.
  return typeof value === "number" ? value : Number(value);
}

// Regra de verdade/falsidade do formato, usada pela condição do {IF(...)}, por
// AND/OR/NOT e por `visibleWhen`: vazio, "0" e "false" (sem diferenciar
// maiúsculas) contam como falso; qualquer outra coisa como verdadeiro.
export function isTruthy(value: Value): boolean {
  const s = stringify(value).trim().toLowerCase();
  return s !== "" && s !== "0" && s !== "false";
}

// Ruído de ponto flutuante (ex: 12 * 22.9 -> 274.79999999999995) arredondado
// sem cortar precisão de verdade — 6 casas decimais cobre qualquer conta com
// dinheiro/quantidade, e a string final não carrega o lixo binário.
function roundFloatNoise(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function evaluate(expr: Expr, data: unknown): Value {
  switch (expr.kind) {
    case "text":
      return expr.value;

    case "number":
      // Devolve o TEXTO que o autor escreveu: `{2.50}` renderiza "2.50", não
      // "2.5". Numa conta, `toNumber` coage — que é exatamente o que o motor
      // anterior fazia.
      return expr.text;

    case "path":
      return stringifyOrEmpty(getCaseInsensitiveSegments(data, expr.segments));

    case "binary": {
      const left = toNumber(evaluate(expr.left, data));
      const right = toNumber(evaluate(expr.right, data));
      // Operando que não é número (texto de verdade), ou divisão por zero:
      // devolve vazio, a convenção do formato pra "não deu pra resolver".
      //
      // O motor anterior ESTOURAVA nos dois casos — `{"x" + 1}` e
      // `{a / zero}` batiam no limite de profundidade, porque a aritmética
      // falhava, devolvia null, e o fallback reprocessava a mesma string em
      // recursão infinita. Vazio é o que sempre se pretendeu.
      if (Number.isNaN(left) || Number.isNaN(right)) return "";
      if (expr.op === "/" && right === 0) return "";
      switch (expr.op) {
        case "+":
          return roundFloatNoise(left + right);
        case "-":
          return roundFloatNoise(left - right);
        case "*":
          return roundFloatNoise(left * right);
        default:
          return roundFloatNoise(left / right);
      }
    }

    case "compare": {
      const left = evaluate(expr.left, data);
      const right = evaluate(expr.right, data);
      return compareValues(left, COMPARE_OPS[expr.op], stringify(right)) ? "true" : "false";
    }

    case "logical": {
      // Curto-circuito, igual JS: `{existe AND existe.campo == "x"}` não
      // avalia o lado direito quando o esquerdo é falso.
      const left = isTruthy(evaluate(expr.left, data));
      if (expr.op === "AND") return left && isTruthy(evaluate(expr.right, data)) ? "true" : "false";
      return left || isTruthy(evaluate(expr.right, data)) ? "true" : "false";
    }

    case "not":
      return isTruthy(evaluate(expr.operand, data)) ? "false" : "true";

    case "call": {
      const fn = FUNCTIONS[expr.name];
      // Função desconhecida devolve vazio, não erro — mesmo comportamento de
      // sempre. Um template escrito para uma versão mais nova do pacote
      // (função que ainda não existe aqui) degrada num campo em branco em vez
      // de derrubar a geração inteira.
      if (!fn) return "";
      const ctx: FnContext = {
        data,
        args: expr.args,
        argSources: expr.argSources,
        str: (i) => (expr.args[i] === undefined ? "" : stringify(evaluate(expr.args[i], data))),
        val: (i) => (expr.args[i] === undefined ? "" : evaluate(expr.args[i], data)),
        truthy: (i) => (expr.args[i] === undefined ? false : isTruthy(evaluate(expr.args[i], data))),
      };
      return fn(ctx);
    }
  }
}

export function evaluateToString(expr: Expr, data: unknown): string {
  return stringify(evaluate(expr, data));
}
