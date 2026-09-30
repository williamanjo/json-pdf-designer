import { ExpressionDepthError, ExpressionSyntaxError, type ExpressionErrorCode } from "../errors";
import { tokenize, type Token } from "./tokenize";

// The AST of a template expression. It replaces the previous engine's
// recursive string-to-string rewriter, which reparsed the same string at
// every level — and therefore had no way to have operator precedence or
// parenthesized grouping (two real bugs: `{a + b * c}` gave 20 instead of
// 14, and `{(a + b) * c}` gave 0).
export type Expr =
  // A text literal (whatever came between quotes).
  | { kind: "text"; value: string }
  // A numeric literal. `text` is what the author WROTE, and `value` the
  // number: `{2.50}` renders "2.50", but in arithmetic it is worth 2.5. Two
  // fields instead of one optional because the invariant ("a number always
  // carries its text") becomes part of the type, not a forgettable convention.
  | { kind: "number"; value: number; text: string }
  // SEGMENTS, and not a dotted string. `{["a.b"]}` is ONE segment that
  // contains a dot — a string cannot tell that apart from walking a->b, and
  // that ambiguity is exactly what the brackets exist to resolve. The bare
  // form (`{a.b}`) is split on the dot here, so it arrives the same way.
  | { kind: "path"; segments: string[] }
  | { kind: "call"; name: string; args: Expr[]; argSources: string[] }
  | { kind: "binary"; op: "+" | "-" | "*" | "/"; left: Expr; right: Expr }
  | { kind: "compare"; op: "==" | "!=" | ">=" | "<=" | ">" | "<"; left: Expr; right: Expr }
  | { kind: "logical"; op: "AND" | "OR"; left: Expr; right: Expr }
  | { kind: "not"; operand: Expr };

// Arithmetic precedence: `*` and `/` bind tighter than `+` and `-`. It is
// the fix for the first bug — the previous engine folded left to right, like
// a pocket calculator.
const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

// The same limit (and the same reason) as the previous engine's
// MAX_EXPRESSION_DEPTH: a malformed or malicious template with gigantic
// nesting blows V8's call stack as a crash, not as a catchable error. 40
// levels covers any legitimate nesting (observed real usage never passes 2-3).
//
// An important difference from the previous engine: there this limit was
// MASKING an infinite recursion — `{"x" + 1}` and `{a / zero}` hit the limit
// and blew up, because the arithmetic failed, returned null, and the fallback
// reprocessed the SAME string. Here the limit is only what it says it is:
// real nesting depth.
const MAX_EXPRESSION_DEPTH = 40;

// The grammar, from the loosest to the tightest binding:
//
//   expression  := or
//   or          := and ( 'OR' and )*
//   and         := not ( 'AND' not )*
//   not         := 'NOT' not | comparison
//   comparison  := arithmetic ( op arithmetic )?
//   arithmetic  := atom ( ('+'|'-'|'*'|'/') atom )*   (precedence climbing)
//   atom        := number | text | path | FUNCTION(args) | '(' expression ')'
class Parser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly source: string
  ) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  // The exact offset of token `index` in the original string — each token
  // carries its own (see `start` in tokenize.ts). Neither indexOf (it would
  // point at the FIRST occurrence of the text) nor a sum of lengths (it would
  // ignore the whitespace between tokens) would give the right position.
  private positionOf(index: number): number {
    const token = this.tokens[index];
    if (token) return token.start;
    const last = this.tokens[this.tokens.length - 1];
    return last ? last.start + last.source.length : 0;
  }

  private fail(code: ExpressionErrorCode, detail = ""): never {
    throw new ExpressionSyntaxError(code, this.source, this.positionOf(this.pos), detail);
  }

  private guardDepth(depth: number): void {
    if (depth > MAX_EXPRESSION_DEPTH) throw new ExpressionDepthError(this.source, MAX_EXPRESSION_DEPTH);
  }

  parseExpression(depth: number): Expr {
    this.guardDepth(depth);
    return this.parseOr(depth);
  }

  // The next token, if it is this logical operator. A helper instead of
  // `peek()?.kind === "logical" && (peek() as ...).value === "OR"`, which
  // needed a cast because the `&&` does not narrow the second `peek()`.
  private peekLogical(op: "AND" | "OR" | "NOT"): boolean {
    const token = this.peek();
    return token?.kind === "logical" && token.value === op;
  }

  private parseOr(depth: number): Expr {
    let left = this.parseAnd(depth);
    while (this.peekLogical("OR")) {
      this.next();
      left = { kind: "logical", op: "OR", left, right: this.parseAnd(depth) };
    }
    return left;
  }

  private parseAnd(depth: number): Expr {
    let left = this.parseNot(depth);
    while (this.peekLogical("AND")) {
      this.next();
      left = { kind: "logical", op: "AND", left, right: this.parseNot(depth) };
    }
    return left;
  }

  private parseNot(depth: number): Expr {
    if (this.peekLogical("NOT")) {
      this.next();
      this.guardDepth(depth + 1);
      return { kind: "not", operand: this.parseNot(depth + 1) };
    }
    return this.parseComparison(depth);
  }

  private parseComparison(depth: number): Expr {
    const left = this.parseBinary(depth, 0);
    const token = this.peek();
    // Comparison does not associate — `a == b == c` makes no sense here, and
    // the previous engine also only read the first one.
    if (token?.kind === "compare") {
      this.next();
      return { kind: "compare", op: token.value, left, right: this.parseBinary(depth, 0) };
    }
    return left;
  }

  // Precedence climbing: it consumes operators while their precedence is
  // >= minPrecedence, descending one level for the right-hand side.
  private parseBinary(depth: number, minPrecedence: number): Expr {
    let left = this.parseAtom(depth);
    for (;;) {
      const token = this.peek();
      if (token?.kind !== "op") break;
      const precedence = PRECEDENCE[token.value];
      if (precedence < minPrecedence) break;
      this.next();
      const right = this.parseBinary(depth, precedence + 1);
      left = { kind: "binary", op: token.value, left, right };
    }
    return left;
  }

  private parseAtom(depth: number): Expr {
    const token = this.next();
    if (!token) this.fail("incomplete");

    switch (token.kind) {
      case "number":
        return { kind: "number", value: token.value, text: token.source };

      case "string":
        return { kind: "text", value: token.value };

      case "lparen": {
        // Real grouping — the fix for the second bug.
        const inner = this.parseExpression(depth + 1);
        if (this.next()?.kind !== "rparen") {
          this.pos--;
          this.fail("unclosedParen");
        }
        return inner;
      }

      case "ident": {
        // An identifier followed by "(" is a function call; otherwise it is a path.
        if (this.peek()?.kind === "lparen") {
          this.next();
          const args: Expr[] = [];
          const argSources: string[] = [];
          if (this.peek()?.kind !== "rparen") {
            for (;;) {
              const startPos = this.pos;
              args.push(this.parseExpression(depth + 1));
              argSources.push(this.sourceOfTokens(startPos, this.pos));
              if (this.peek()?.kind === "comma") {
                this.next();
                // A trailing comma before the ")" — `CONCAT(a,)`. The previous
                // engine tolerated it (splitDelimited discarded the empty
                // part), so blowing up here would bring down a template that
                // renders today. Tolerate it again.
                if (this.peek()?.kind === "rparen") break;
                continue;
              }
              break;
            }
          }
          if (this.next()?.kind !== "rparen") {
            this.pos--;
            this.fail("unclosedCall", token.value);
          }
          return { kind: "call", name: token.value.toUpperCase(), args, argSources };
        }
        return { kind: "path", segments: token.value.split(".") };
      }

      // A delimited path: the lexer has already resolved the segments
      // (including those with a dot or a space inside), so there is nothing
      // to split here. That difference is what justifies the separate token.
      case "path":
        return { kind: "path", segments: token.segments };

      case "op":
        // Unary minus: `{ - 5}`, `{a - -5}`. The tokenizer only emits an "op"
        // with whitespace on both sides, so this is rare — but handling it is
        // better than failing.
        if (token.value === "-") {
          return { kind: "binary", op: "-", left: { kind: "number", value: 0, text: "0" }, right: this.parseAtom(depth) };
        }
        this.pos--;
        this.fail("operatorWithoutLeft", token.value);

      default:
        this.pos--;
        this.fail("unexpectedToken", token.source);
    }
  }

  // The raw text of the tokens in [from, to) — used by the aggregators (SUM/
  // COUNT/AVG), whose argument is an ARRAY PATH, not a value to evaluate:
  // `SUM(items.total)` sums the `total` column of the `items` array. Without
  // keeping the text, the parser would already have turned this into a `path`
  // node and the aggregator would lose where the array ends and the column starts.
  private sourceOfTokens(from: number, to: number): string {
    return this.tokens
      .slice(from, to)
      .map((t) => t.source)
      .join("")
      .trim();
  }

  atEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  positionAtCursor(): number {
    return this.positionOf(this.pos);
  }
}

export function parse(source: string): Expr {
  const tokens = tokenize(source);
  if (tokens.length === 0) return { kind: "text", value: "" };
  const parser = new Parser(tokens, source);
  const expr = parser.parseExpression(0);
  if (!parser.atEnd()) {
    // A leftover token — e.g. `{a) b}`, `{SUM(a) SUM(b)}`. The tokenizer joins
    // whitespace inside an identifier, so this is always a genuine syntax
    // error, not a legitimate form.
    throw new ExpressionSyntaxError("trailingContent", source, parser.positionAtCursor());
  }
  return expr;
}
