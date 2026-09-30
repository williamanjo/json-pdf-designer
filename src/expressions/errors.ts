import { en } from "../i18n/locales/en";
import type { Dict } from "../i18n/locales/en";

// Template expression errors.
//
// They exist as CLASSES, and under a common base, because two layers need to
// tell "the template is badly written" apart from "the engine broke":
//
// - `expressions/resolve.ts` swallows template errors (the field becomes
//   empty) and lets anything else through. If one of them did not descend
//   from `ExpressionError`, it would bring down the whole `generatePdf`.
// - `fieldWarnings.ts` turns each into the field's warning in the editor.
//
// The previous version had a single class and recognized the depth error by a
// regex on the MESSAGE. That was already leaky in practice: the tolerant layer
// did not catch the depth error, so an absurdly nested expression brought
// generation down — precisely the case (a malformed or malicious template) in
// which tolerating matters most.
//
// And the text does NOT live here: each error carries `code` + `detail`, and
// the phrase comes from the dictionary (`t.expressionErrors[code]`). The
// reason is that the same failure appears in two places in different
// languages — in the editor, in the designer's language, and in the
// `Error.message` of whoever called `parse` in a backend, where the library
// convention is English. `message` is English; `localize(t)` is the active one.

// Explicit, and not derived from the dictionary: `expressionErrors` in the
// dictionary also carries messages that are NOT errors thrown by the parser
// (an unbalanced brace, a suspicious operator — both are editor checks).
// Listing them here makes clear what an error code is; forgetting the key in
// the dictionary breaks the typecheck in `textOf` below.
export type ExpressionErrorCode =
  | "incomplete"
  | "unclosedParen"
  | "unclosedCall"
  | "operatorWithoutLeft"
  | "unexpectedToken"
  | "trailingContent"
  | "unclosedQuote"
  // A bracketed path (3.2.0): `[a` left open, `[]`, and `[a b]` without quotes.
  // The last one is a deliberate refusal of ambiguity — see the top of tokenize.ts.
  | "unclosedBracket"
  | "emptySegment"
  | "spaceInSegment"
  | "tooDeep";

export abstract class ExpressionError extends Error {
  // The stretch that was being evaluated — it goes into the warning's message.
  abstract readonly source: string;
  // Which failure it was, without depending on matching text. A consumer who
  // wants to decide by error type uses this, not the message.
  abstract readonly code: ExpressionErrorCode;
  // The message's parameter (a function name, a token's text, the depth
  // limit) — "" when the phrase has none.
  abstract readonly detail: string;
  // The same message, in `t`'s language.
  abstract localize(t: Dict): string;
}

function textOf(t: Dict, code: ExpressionErrorCode, detail: string): string {
  return t.expressionErrors[code](detail);
}

export class ExpressionSyntaxError extends ExpressionError {
  constructor(
    readonly code: ExpressionErrorCode,
    readonly source: string,
    // The EXACT offset of the problem in the original string (see `start` on
    // the tokens in tokenize.ts) — it appears in the field's warning, so it
    // has to point at the right character.
    readonly position: number,
    readonly detail: string = ""
  ) {
    super(en.expressionErrors.at(textOf(en, code, detail), position, JSON.stringify(source)));
    this.name = "ExpressionSyntaxError";
  }

  localize(t: Dict): string {
    return t.expressionErrors.at(textOf(t, this.code, this.detail), this.position, JSON.stringify(this.source));
  }
}

// Nesting beyond the limit. It protects V8's call stack from a malformed (or
// malicious, in a multi-tenant scenario where the template comes from an
// untrusted source) template such as `{CURRENCY(CURRENCY(CURRENCY(...)))}`
// repeated thousands of times: without the limit that is a crash, not an error.
export class ExpressionDepthError extends ExpressionError {
  readonly code = "tooDeep" as const;
  readonly detail: string;

  constructor(
    readonly source: string,
    readonly maxDepth: number
  ) {
    super(textOf(en, "tooDeep", String(maxDepth)));
    this.name = "ExpressionDepthError";
    this.detail = String(maxDepth);
  }

  localize(t: Dict): string {
    return textOf(t, "tooDeep", this.detail);
  }
}
