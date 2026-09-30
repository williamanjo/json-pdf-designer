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
  // Number("") is 0 — on purpose, and it is the long-standing behavior: a path
  // that does not resolve enters an arithmetic expression as 0, so
  // `{doesnotexist + a}` gives the value of `a` instead of empty.
  return typeof value === "number" ? value : Number(value);
}

// The format's truthiness rule, used by the {IF(...)} condition, by AND/OR/NOT
// and by `visibleWhen`: empty, "0" and "false" (case-insensitive) count as
// false; anything else as true.
export function isTruthy(value: Value): boolean {
  const s = stringify(value).trim().toLowerCase();
  return s !== "" && s !== "0" && s !== "false";
}

// Floating point noise (e.g. 12 * 22.9 -> 274.79999999999995) rounded off
// without cutting real precision — 6 decimal places cover any money/quantity
// arithmetic, and the final string does not carry the binary garbage.
function roundFloatNoise(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function evaluate(expr: Expr, data: unknown): Value {
  switch (expr.kind) {
    case "text":
      return expr.value;

    case "number":
      // It returns the TEXT the author wrote: `{2.50}` renders "2.50", not
      // "2.5". In arithmetic, `toNumber` coerces — which is exactly what the
      // previous engine did.
      return expr.text;

    case "path":
      return stringifyOrEmpty(getCaseInsensitiveSegments(data, expr.segments));

    case "binary": {
      const left = toNumber(evaluate(expr.left, data));
      const right = toNumber(evaluate(expr.right, data));
      // An operand that is not a number (real text), or a division by zero:
      // it returns empty, the format's convention for "could not resolve".
      //
      // The previous engine BLEW UP in both cases — `{"x" + 1}` and
      // `{a / zero}` hit the depth limit, because the arithmetic failed,
      // returned null, and the fallback reprocessed the same string in
      // infinite recursion. Empty is what was always intended.
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
      // Short-circuit, like JS: `{exists AND exists.field == "x"}` does not
      // evaluate the right side when the left one is false.
      const left = isTruthy(evaluate(expr.left, data));
      if (expr.op === "AND") return left && isTruthy(evaluate(expr.right, data)) ? "true" : "false";
      return left || isTruthy(evaluate(expr.right, data)) ? "true" : "false";
    }

    case "not":
      return isTruthy(evaluate(expr.operand, data)) ? "false" : "true";

    case "call": {
      const fn = FUNCTIONS[expr.name];
      // An unknown function returns empty, not an error — the same behavior as
      // ever. A template written for a newer version of the package (a
      // function that does not exist here yet) degrades to a blank field
      // instead of bringing the whole generation down.
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
