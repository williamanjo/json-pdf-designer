// The tokenizer for template expressions ({...} inside a field's content).
//
// This format's central lexical rule, and the reason a hand-written
// tokenizer exists instead of a generic one: **an operator is only an
// operator when it has whitespace on BOTH sides**. Otherwise it is part of
// the identifier.
//
//   {my-key}    -> path "my-key"       (hyphen inside the key name)
//   {my key}    -> path "my key"       (JSON key with a space)
//   {a-b}       -> path "a-b"
//   {a - b}     -> subtraction
//   {IF(a==2,…)}-> path "a==2" (not a comparison — no whitespace)
//   {IF(a == 2,…)} -> a comparison
//
// It is not a whim: it is the contract the previous engine had (by accident
// of the `/\s[+\-*/]\s/` regex) and that templates saved in production depend
// on. A "normal" tokenizer would break `{my-key}` into `my`, `-`, `key` and
// silently return 0. Here the rule is explicit and tested.
//
// The same holds for the WORD operators (AND/OR/NOT): `{a AND b}` combines
// two conditions, `{AND}` is the path of a key called "AND".
//
// ---------------------------------------------------------------------------
// BRACKETED PATH (3.2.0)
//
// The permissive rule above covers almost every JSON key, but not all: a key
// with a LITERAL dot in its name had no form at all (the `.` always separated
// segments), nor did a key with `(`/`)`/`,`/`"`, nor one with an operator
// surrounded by spaces. The delimited form names all of them:
//
//   {[id]}                -> key "id"
//   {[cliente].[nome]}    -> walks cliente -> nome
//   {[cliente.nome]}      -> the LITERAL key "cliente.nome" (the dot does not split)
//   {["token name"]}      -> key "token name"
//   {[total] + 1}         -> arithmetic (the operator is OUTSIDE the bracket)
//   {CURRENCY([total], "R$", 2)} -> a bracketed path as an argument
//
// A space inside the bracket REQUIRES quotes. Without that rule, `[a + b]`
// would be ambiguous between the key "a + b" and arithmetic inside the
// bracket — and silently guessing one of the two is worse than refusing.
//
// The bare form still stands, without exception: `{cliente.nome}`, `{my-key}`,
// `{my key}` are the paths they always were. The only case whose meaning
// changed is a key literally called `[something]`, which used to fall into the
// atom accumulator and now needs `{["[something]"]}`.

import { ExpressionSyntaxError } from "../errors";
// Re-exported because whoever handles tokens usually wants the error too.
export { ExpressionSyntaxError };

// Where the token starts in the original string. The position appears in the
// error message, which in turn becomes the field's warning in the editor — so
// it has to point at the exact character, not an approximation.
type Located = { start: number };

export type Token = Located &
  (
    // `source` keeps the text exactly as it was written. For a number that
    // matters: `{2.50}` renders "2.50", not "2.5" — the literal preserves the
    // places the author wrote (which is what the previous engine did,
    // returning the raw text). In arithmetic, the value is coerced normally.
    | { kind: "number"; value: number; source: string }
    | { kind: "string"; value: string; source: string }
    // An identifier: a function name OR a data path. The parser decides,
    // looking at whether a "(" comes next.
    | { kind: "ident"; value: string; source: string }
    // A DELIMITED path — a chain of segments already resolved by the lexer,
    // each without quotes. It is separate from `ident` because here the
    // segments are real data (`["a.b"]` is ONE segment with a dot inside),
    // and a dotted string cannot represent that.
    | { kind: "path"; segments: string[]; source: string }
    | { kind: "op"; value: "+" | "-" | "*" | "/"; source: string }
    | { kind: "compare"; value: "==" | "!=" | ">=" | "<=" | ">" | "<"; source: string }
    | { kind: "logical"; value: "AND" | "OR" | "NOT"; source: string }
    | { kind: "lparen"; source: string }
    | { kind: "rparen"; source: string }
    | { kind: "comma"; source: string }
  );

// A tuple, not a Set<string>: iterating/comparing over it preserves the
// literal type, which is what avoids a cast when building the token.
const ARITHMETIC = ["+", "-", "*", "/"] as const;
// 2 characters before 1 — otherwise ">=" would be read as ">" with a leftover
// "=". The same order the previous engine's IF_OPERATORS used.
const COMPARISONS = ["==", "!=", ">=", "<=", ">", "<"] as const;
// Longest before shortest for the same reason (none is a prefix of another
// here, but the order makes the intent explicit).
const NOT = "NOT";
const LOGICALS = ["AND", NOT, "OR"] as const;

const isSpace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch);

// Is an operator at this position surrounded by whitespace on both sides?
function isSurroundedBySpace(src: string, start: number, length: number): boolean {
  return isSpace(src[start - 1]) && isSpace(src[start + length]);
}

// The token of the operator starting at `i`, already with the right kind and
// value — only `start` is missing, which the caller fills in. Returning the
// finished token (instead of `{ text, kind }`) avoids rebuilding it with a cast.
//
// An `Omit` straight over the union would collapse the three members into one
// object with `kind: "op" | "compare" | "logical"` and every `value` together
// — and then the result would no longer be assignable to `Token`. The
// `T extends unknown` forces distribution, keeping the three members separate.
type WithoutStart<T> = T extends unknown ? Omit<T, "start"> : never;
type OperatorToken = WithoutStart<Extract<Token, { kind: "op" | "compare" | "logical" }>>;

// Which operator starts at `i`, if any IS surrounded by whitespace. It
// returns null when there is none — including when the character is an
// operator but sits against the text (then it belongs to the identifier).
function operatorAt(src: string, i: number): OperatorToken | null {
  for (const cmp of COMPARISONS) {
    if (src.startsWith(cmp, i) && isSurroundedBySpace(src, i, cmp.length)) {
      return { kind: "compare", value: cmp, source: cmp };
    }
  }
  // AND/OR/NOT are case-insensitive, like a function name (`sum(...)` works).
  // `source` keeps it as written; `value` normalizes it.
  for (const word of LOGICALS) {
    const written = src.slice(i, i + word.length);
    if (written.toUpperCase() === word && isSurroundedBySpace(src, i, word.length)) {
      return { kind: "logical", value: word, source: written };
    }
  }
  for (const op of ARITHMETIC) {
    if (src[i] === op && isSurroundedBySpace(src, i, 1)) {
      return { kind: "op", value: op, source: op };
    }
  }
  return null;
}

// A `NOT` at the START of the expression (or right after a "(" / an operator)
// has no whitespace on its left, so `isSurroundedBySpace` would refuse it.
// This extra case covers `{NOT paid}` and `{IF(NOT paid, …)}` — NOT only.
function leadingNotAt(src: string, i: number, tokens: Token[]): boolean {
  if (src.slice(i, i + NOT.length).toUpperCase() !== NOT) return false;
  if (!isSpace(src[i + NOT.length])) return false;
  const before = src.slice(0, i).trim();
  if (before === "") return true;
  const prev = tokens[tokens.length - 1];
  return prev !== undefined && (prev.kind === "lparen" || prev.kind === "comma" || prev.kind === "logical");
}

// Characters that always end an atom. `[` and `]` joined in 3.2.0: without
// them, `a[0]` would still become a single identifier, and then a stray `[`
// in the middle of the text would pass silently instead of being a syntax error.
const ATOM_BREAK = new Set(["(", ")", ",", '"', "[", "]"]);

// One bracketed segment, starting at the `[` at `i`. It returns the content
// already unquoted and where the `]` ended.
function bracketSegmentAt(src: string, i: number): { value: string; end: number } {
  const open = i + 1;
  const quote = src[open];

  if (quote === '"' || quote === "'") {
    const close = src.indexOf(quote, open + 1);
    if (close === -1) throw new ExpressionSyntaxError("unclosedQuote", src, open);
    if (src[close + 1] !== "]") throw new ExpressionSyntaxError("unclosedBracket", src, i);
    return { value: src.slice(open + 1, close), end: close + 2 };
  }

  const close = src.indexOf("]", open);
  if (close === -1) throw new ExpressionSyntaxError("unclosedBracket", src, i);
  const body = src.slice(open, close);
  if (body === "") throw new ExpressionSyntaxError("emptySegment", src, i);
  // An unquoted space is refused on purpose — see the comment at the top.
  if (/\s/.test(body)) throw new ExpressionSyntaxError("spaceInSegment", src, i);
  return { value: body, end: close + 1 };
}

// The whole chain: `[a]`, `[a].[b]`, `[a.b].[c]`, and also `[a].b` (a bare
// tail, accepted because refusing it would only produce a confusing error).
function bracketPathAt(src: string, i: number): { segments: string[]; source: string; end: number } {
  const start = i;
  const segments: string[] = [];
  let pos = i;

  for (;;) {
    if (src[pos] === "[") {
      const seg = bracketSegmentAt(src, pos);
      segments.push(seg.value);
      pos = seg.end;
    } else {
      // A bare segment in a tail: it consumes up to the next boundary.
      const from = pos;
      while (pos < src.length) {
        const c = src[pos];
        if (c === "." || ATOM_BREAK.has(c) || operatorAt(src, pos)) break;
        pos++;
      }
      const bare = src.slice(from, pos).trim();
      if (bare === "") throw new ExpressionSyntaxError("emptySegment", src, from);
      segments.push(bare);
    }

    // It continues the chain only if there is a `.` with something after it.
    if (src[pos] !== "." || pos + 1 >= src.length) break;
    pos++;
  }

  return { segments, source: src.slice(start, pos), end: pos };
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (ch === '"') {
      const end = source.indexOf('"', i + 1);
      if (end === -1) throw new ExpressionSyntaxError("unclosedQuote", source, i);
      tokens.push({ kind: "string", value: source.slice(i + 1, end), source: source.slice(i, end + 1), start: i });
      i = end + 1;
      continue;
    }

    if (ch === "[") {
      const path = bracketPathAt(source, i);
      tokens.push({ kind: "path", segments: path.segments, source: path.source, start: i });
      i = path.end;
      continue;
    }

    if (ch === "(") { tokens.push({ kind: "lparen", source: ch, start: i }); i++; continue; }
    if (ch === ")") { tokens.push({ kind: "rparen", source: ch, start: i }); i++; continue; }
    if (ch === ",") { tokens.push({ kind: "comma", source: ch, start: i }); i++; continue; }

    if (leadingNotAt(source, i, tokens)) {
      tokens.push({ kind: "logical", value: NOT, source: source.slice(i, i + NOT.length), start: i });
      i += NOT.length;
      continue;
    }

    const op = operatorAt(source, i);
    if (op) {
      tokens.push({ ...op, start: i });
      i += op.source.length;
      continue;
    }

    // Whitespace outside an identifier (between a ")" and an operator, for
    // instance) — it is simply skipped. Whitespace INSIDE an identifier is
    // handled by the accumulator below, which only trims at the end.
    if (/\s/.test(ch)) { i++; continue; }

    // An atom: it consumes up to punctuation or an operator surrounded by
    // whitespace. A space or a hyphen sitting against the text joins the atom
    // on purpose (see the comment at the top).
    const start = i;
    while (i < source.length) {
      const c = source[i];
      if (ATOM_BREAK.has(c)) break;
      if (operatorAt(source, i)) break;
      i++;
    }
    const raw = source.slice(start, i);
    const text = raw.trim();
    if (text === "") {
      // Nothing but whitespace up to the next punctuation — nothing to emit.
      continue;
    }
    // A pure numeric literal (the "2" of NUMBER(value, 2)). Without this it
    // would become a path lookup by mistake — the key "2" is not in the JSON.
    if (/^-?\d+(\.\d+)?$/.test(text)) {
      tokens.push({ kind: "number", value: Number(text), source: text, start: start + raw.indexOf(text) });
    } else {
      tokens.push({ kind: "ident", value: text, source: raw, start: start + raw.indexOf(text) });
    }
  }

  return tokens;
}
