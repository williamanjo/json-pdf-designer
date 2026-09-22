import { en, type Dict } from "../i18n/locales/en";
import { ExpressionError } from "./errors";
import { evaluate, evaluateToString, isTruthy } from "./engine/evaluate";
import { parse } from "./engine/parse";

// A tolerant layer on top of the strict parser.
//
// The parser blows up on a malformed expression, and that is good: it is what
// lets the editor POINT AT the problem (see fieldWarnings.ts) instead of
// leaving a field mysteriously blank. But blowing up at GENERATION time would
// be worse than the previous behavior: before, a forgotten `{CONCAT(a,)}` in
// a field left that field empty; if the parse blew up here, the same mistake
// would bring down the ENTIRE PDF — not a single page comes out. Trading "one
// blank field" for "no report" is not an improvement.
//
// So: generation is tolerant (an empty field), and the error shows up in the
// editor, before generating. Whoever wants the strict version programmatically
// uses `parse` directly, or `expressionError` below.

// Every `{...}` of a template. `[^{}]+` = a token contains no braces.
const TOKEN_RE = /\{([^{}]+)\}/g;

// Resolves one token, returning "" when it is syntactically invalid.
export function resolveTokenLenient(token: string, data: unknown): string {
  try {
    return evaluateToString(parse(token), data);
  } catch (err) {
    // Only a TEMPLATE error is swallowed (syntax, depth). Anything else is an
    // engine bug and has to surface — swallowing it all would hide a regression.
    if (err instanceof ExpressionError) return "";
    throw err;
  }
}

// Resolves a whole template (text with zero or more `{...}`), token by token.
// An invalid token becomes "" without affecting the others — it is the blast
// radius the previous engine had.
export function renderTemplateLenient(template: string, data: unknown): string {
  return template.replace(TOKEN_RE, (_, inner) => resolveTokenLenient(inner, data));
}

// The truthiness of a condition expression (a field's `visibleWhen`). An
// invalid condition counts as VISIBLE, not invisible: a typo must not make a
// field silently disappear from the report — the editor warns, and the field
// keeps showing up until someone fixes it.
export function evaluateConditionLenient(condition: string, data: unknown, fallback = true): boolean {
  try {
    return isTruthy(evaluate(parse(condition), data));
  } catch (err) {
    if (err instanceof ExpressionError) return fallback;
    throw err;
  }
}

// The syntax error message of ONE expression, or null if it is valid. Used
// by the field warning in the editor.
//
// `t` decides the message's language; without it, English (the library
// message convention, and what a backend logs). Whoever is inside React
// passes `useT()`; outside it, `dictFor(locale)`.
export function expressionError(source: string, t: Dict = en): string | null {
  try {
    parse(source);
    return null;
  } catch (err) {
    if (err instanceof ExpressionError) return err.localize(t);
    throw err;
  }
}

// The syntactically invalid `{...}` tokens of a template, with each one's
// message. Empty = a valid template.
export function templateExpressionErrors(template: string, t: Dict = en): { token: string; message: string }[] {
  const errors: { token: string; message: string }[] = [];
  for (const match of template.matchAll(TOKEN_RE)) {
    const message = expressionError(match[1], t);
    if (message) errors.push({ token: match[0], message });
  }
  return errors;
}
