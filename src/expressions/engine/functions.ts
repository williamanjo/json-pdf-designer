import type { Expr } from "./parse";
import { getCaseInsensitive, numbersFromArrayPath, splitArrayPath } from "../dataAccess";
import { formatCurrency, formatDate } from "./formatters";

export type Value = string | number;

// What a template function receives. The arguments arrive as **unevaluated**
// AST, plus the evaluation callbacks — on purpose:
//
// - `IF` is lazy: only the chosen branch is evaluated. `{IF(exists, value,
//   "N/A")}` must not blow up because the branch NOT used has a path that
//   does not resolve.
// - `SUM`/`COUNT`/`AVG` receive an **array path**, not a value: in
//   `SUM(items.total)`, `items.total` is not "the value at items.total" but
//   "the total column of the items array". That is why they use `argSources`
//   (the raw text) instead of the evaluated argument.
export type FnContext = {
  data: unknown;
  args: Expr[];
  argSources: string[];
  // Evaluates argument `index` as a string. "" when the argument does not exist.
  str(index: number): string;
  // Evaluates as a value (string or number), preserving the type.
  val(index: number): Value;
  // Truthiness of argument `index` — a comparison when it is one, otherwise the
  // format's truthiness rule (see isTruthy in evaluate.ts).
  truthy(index: number): boolean;
};

type ExpressionFunction = (ctx: FnContext) => Value;

// Decimal places from an optional argument. Number("") is 0, not NaN — if the
// argument does not resolve to anything (a wrong path and so on), "" must not
// silently become "0 decimal places"; it falls back to the default.
function decimalsArg(ctx: FnContext, index: number, fallback = 2): number {
  if (ctx.args[index] === undefined) return fallback;
  const raw = ctx.str(index);
  if (raw === "") return fallback;
  const n = Number(raw);
  return Number.isNaN(n) ? fallback : n;
}

export const FUNCTIONS: Record<string, ExpressionFunction> = {
  SUM: (ctx) => numbersFromArrayPath(ctx.data, ctx.argSources[0] ?? "").reduce((a, b) => a + b, 0),

  COUNT: (ctx) => {
    const { arrayPath } = splitArrayPath(ctx.argSources[0] ?? "");
    const arr = getCaseInsensitive(ctx.data, arrayPath);
    return Array.isArray(arr) ? arr.length : 0;
  },

  AVG: (ctx) => {
    const nums = numbersFromArrayPath(ctx.data, ctx.argSources[0] ?? "");
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  },

  CONCAT: (ctx) => ctx.args.map((_, i) => ctx.str(i)).join(""),

  UPPER: (ctx) => ctx.str(0).toUpperCase(),

  LOWER: (ctx) => ctx.str(0).toLowerCase(),

  // Strips leading/trailing whitespace — common in a legacy system export with
  // fixed-width fields (e.g. "fatura": " 01156189"). {CONCAT}/{token} keep the
  // value exactly as it arrived (on purpose); to strip the space without
  // relying on the side effect of Number(" x") (which would also eat a
  // leading zero), use an explicit TRIM.
  TRIM: (ctx) => ctx.str(0).trim(),

  // The 3rd arg (optional) states the INPUT format — e.g. DATE(vencto,
  // "DD/MM/YYYY", "DD/MM/YYYY") reads "10/04/2025" as 10 April, and does not
  // let JS's new Date(...) guess (American, it would become October).
  DATE: (ctx) =>
    formatDate(
      ctx.str(0),
      ctx.args[1] !== undefined ? ctx.str(1) : "DD/MM/YYYY",
      ctx.args[2] !== undefined ? ctx.str(2) : undefined
    ),

  // The 3rd arg (optional) = decimal places, default 2 (the currency standard).
  CURRENCY: (ctx) => formatCurrency(ctx.str(0), ctx.args[1] !== undefined ? ctx.str(1) : "", decimalsArg(ctx, 2)),

  // Controlled decimal places — like C's "%.2f". E.g. NUMBER(qty * price, 2)
  // -> "160.00". With no thousands separator or symbol (that is CURRENCY) —
  // it only rounds and fixes the number of places.
  NUMBER: (ctx) => {
    const raw = ctx.val(0);
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isNaN(n)) return "";
    return n.toFixed(decimalsArg(ctx, 1));
  },

  // {IF(condition, "then", "else")} — the condition may be a comparison
  // ("status == \"paid\"", "total > 100") or a lone path/expression (a
  // truthiness check). Only the chosen side is evaluated.
  IF: (ctx) => (ctx.truthy(0) ? ctx.val(1) : ctx.val(2)),
};

export const FUNCTION_NAMES = Object.keys(FUNCTIONS);
