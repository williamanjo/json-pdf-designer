import { en, type Dict } from "../i18n/locales/en";
import { tokenize } from "./engine/tokenize";

// An operator with whitespace on one side only — the hole this format's
// lexical rule leaves open.
//
// The rule is: an operator is only an operator when surrounded by whitespace
// on BOTH sides (tokenize.ts explains why — a JSON key called "AND",
// `{my-key}` and so on). The consequence is that `{fatura /}` is no syntax
// error at all: the `/` has a `}` on its right, so it joins the identifier
// and the path becomes `"fatura /"`. That key does not exist in the JSON, a
// non-existent path resolves to empty, and the field comes out blank with
// nothing to flag it — neither the parser (the expression is valid) nor
// generation (missing data is a degrade, not a failure).
//
// It cannot become a syntax error: that would break the guarantee that a key
// with a `/` in its name stays reachable. But the suspicious case CAN be
// pointed at, and the signal is precise: whitespace on EXACTLY ONE side. A
// key with an operator against it (`{fatura/2}`) is plausible and stays
// quiet; a key with whitespace on one side only (`"fatura /"`, `"a >=b"`) is
// a typo in practically every real case.
//
// Working over the `ident` tokens keeps the check free of false positives:
//   - a real operator is already an `op`/`compare`/`logical` token, it never arrives here;
//   - quoted content is already a `string` token, so `{CONCAT("a > b", x)}` passes;
//   - a negative number's sign (`-1` after a `,` or an operator) becomes a
//     `number` token, so `{CONCAT("x", -1)}` and `{a + -1}` pass.

const SYMBOL_OPERATORS = ["==", "!=", ">=", "<=", ">", "<", "+", "-", "*", "/"] as const;
const WORD_OPERATORS = ["AND", "NOT", "OR"] as const;

const isSpace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch);
// Letter/digit/underscore: if the neighbor of "OR" is one of those, the "OR"
// is part of a word ("FORNECEDOR nome"), not a misspelled operator.
const isWordChar = (ch: string | undefined) => ch !== undefined && /[A-Za-z0-9_]/.test(ch);

// Which operator starts at `i` inside this identifier, or null.
function operatorTextAt(ident: string, i: number): string | null {
  for (const op of SYMBOL_OPERATORS) {
    if (ident.startsWith(op, i)) return op;
  }
  for (const word of WORD_OPERATORS) {
    if (ident.slice(i, i + word.length).toUpperCase() !== word) continue;
    if (isWordChar(ident[i - 1]) || isWordChar(ident[i + word.length])) continue;
    return ident.slice(i, i + word.length);
  }
  return null;
}

// The first operator with whitespace on one side only inside an identifier.
// The start and the end of the identifier count as "no whitespace" — it is
// the same convention as `isSurroundedBySpace` in tokenize.ts, and it is what
// makes `{fatura /}` (the end of the token on the right) get caught.
function oneSidedOperatorIn(ident: string): string | null {
  for (let i = 0; i < ident.length; i++) {
    const op = operatorTextAt(ident, i);
    if (!op) continue;
    if (isSpace(ident[i - 1]) !== isSpace(ident[i + op.length])) return op;
    i += op.length - 1;
  }
  return null;
}

// The warning for ONE expression, or null if there is nothing suspicious. It
// never throws: an expression that does not even tokenize belongs to
// `expressionError`, which already reports it as a syntax error.
export function suspiciousOperator(source: string, t: Dict = en): string | null {
  let tokens;
  try {
    tokens = tokenize(source);
  } catch {
    return null;
  }
  for (const token of tokens) {
    if (token.kind !== "ident") continue;
    const op = oneSidedOperatorIn(token.value);
    if (!op) continue;
    return t.expressionErrors.suspiciousOperator(op, token.value);
  }
  return null;
}

// The same for a whole template (text with zero or more `{...}`), token by
// token. Same return shape as `templateExpressionErrors`.
const TOKEN_RE = /\{([^{}]+)\}/g;

export function templateSuspiciousOperators(template: string, t: Dict = en): { token: string; message: string }[] {
  const found: { token: string; message: string }[] = [];
  for (const match of template.matchAll(TOKEN_RE)) {
    const message = suspiciousOperator(match[1], t);
    if (message) found.push({ token: match[0], message });
  }
  return found;
}
