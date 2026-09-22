import { en, type Dict } from "../i18n/locales/en";

// A field's text is a TEMPLATE: literal text with zero or more `{...}` in the
// middle (`FAT-{fatura}`). This module is what the editor needs to know about
// the BRACES themselves — something the expression parser does not see,
// because it only receives the content inside them.
//
// Pure and tested out of necessity: the project has no @testing-library/react
// (see the top of test/i18n/withInlineCode.test.tsx), so caret and scanning
// logic has to live outside the component for a test to exist at all.

export type TokenSpan = {
  // The index of the first character INSIDE the braces.
  start: number;
  // The index of the closing `}` (or the end of the stretch, when there is none).
  end: number;
  inner: string;
};

// The `{...}` containing the caret, or null if the caret is in literal text.
//
// It serves two things in the editor: suggesting a function only inside the
// braces (outside them it is loose text, and a list of functions there only
// gets in the way), and knowing whether a click inserts `total` or `{total}`.
export function tokenAtCaret(template: string, caret: number): TokenSpan | null {
  // The last `{` before the caret with no `}` in between = the caret is inside it.
  let open = -1;
  for (let i = 0; i < caret; i++) {
    if (template[i] === "{") open = i;
    else if (template[i] === "}") open = -1;
  }
  if (open === -1) return null;

  // The token ends at the next `}` — or at a new `{`, when the author forgot
  // to close it: then the stretch only goes that far, instead of swallowing
  // the token below.
  let close = template.indexOf("}", caret);
  if (close === -1) close = template.length;
  const nextOpen = template.indexOf("{", caret);
  const end = nextOpen !== -1 && nextOpen < close ? nextOpen : close;
  return { start: open + 1, end, inner: template.slice(open + 1, end) };
}

// An unbalanced brace, or null if everything is closed.
//
// It exists because nothing else flags this: the template resolver matches
// `/\{([^{}]+)\}/g`, so an unclosed `{` simply does not match and the stretch
// comes out as LITERAL TEXT in the PDF — `{CURRENCY(total` printed in plain
// sight. It is not an expression syntax error (the parser never sees that
// stretch) nor a generation failure; it was just a field coming out wrong.
export function braceError(template: string, t: Dict = en): string | null {
  let open = -1;
  for (let i = 0; i < template.length; i++) {
    const ch = template[i];
    if (ch === "{") {
      // `{a {b}` — the outer one never closes, and the resolver matches only `{b}`.
      if (open !== -1) return t.expressionErrors.braceNested(i);
      open = i;
    } else if (ch === "}") {
      if (open === -1) return t.expressionErrors.braceUnexpected(i);
      open = -1;
    }
  }
  return open !== -1 ? t.expressionErrors.braceUnclosed(open) : null;
}
