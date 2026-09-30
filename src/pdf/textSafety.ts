import type { PDFFont } from "pdf-lib";
import { UnsupportedGlyphError } from "../errors";

// Two things separate "the data has a strange character" from "no PDF comes
// out at all". This file is both of them.
//
// The trigger is the DATA, not the template: whoever builds the report does
// not control what comes in the JSON. Before this, a `\n` in a customer's name
// — coming from a textarea, from an address with a line break, from a CSV
// import — brought the whole document down with `WinAnsi cannot encode "\n"`.

// CONTROL characters (C0, DEL and C1). They have no glyph in ANY font, not
// even in a complete Unicode font passed through `fontBytes` — so replacing
// them with a space is not a loss of content, it is the only possible
// rendering.
//
// A field in this format is single-line by construction (there is no
// wrapping; what does not fit is truncated, see truncateToWidth), so `\n` and
// `\t` become a space instead of trying to become layout.
//
// Ranges covered: C0 (U+0000..U+001F — including tab, LF and CR), DEL
// (U+007F) and C1 (U+0080..U+009F). Written with escapes on purpose: a
// literal with the real character inside is unreadable and easy to ruin in a
// diff.
// Intentional: matching a control character IS the goal, and it is already
// written with Unicode escapes (which is what the lint suggests as the
// alternative).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

// Prepares a value coming from the data to be measured/drawn. Called by EVERY
// path that touches `drawText`/`widthOfTextAtSize` — text, a table cell, a KPI
// and a chart label.
export function sanitizeText(text: string): string {
  if (!text) return text;
  return text.replace(CONTROL_CHARS, " ");
}

// The first character of `text` the font cannot write, or null.
//
// It finds out by testing character by character instead of reading pdf-lib's
// error message: matching a third-party library's message breaks silently in
// its next version. It only runs on the ERROR path, so the cost does not matter.
function firstUnencodableChar(text: string, font: PDFFont, size: number): string | null {
  // It iterates by code point (not by UTF-16 unit), so an emoji outside the
  // BMP is reported as ONE character and not as two surrogates.
  for (const char of text) {
    try {
      font.widthOfTextAtSize(char, size);
    } catch {
      return char;
    }
  }
  return null;
}

// The class lives in src/errors.ts (with all the others, see the comment
// there) and is RE-EXPORTED from here: `UnsupportedGlyphError` was already
// imported from this module by code and by tests, and changing the path would
// gain nothing.
export { UnsupportedGlyphError } from "../errors";

// Runs `draw` and, if pdf-lib refuses because of a character, swaps the raw
// error ("WinAnsi cannot encode …", which does not say where) for one that
// names the field.
//
// `texts` is a FUNCTION on purpose: it is only called on the error path, so it
// may be expensive (resolving a chart's labels, flattening a table's rows)
// without weighing on normal generation.
export function withGlyphContext<T>(
  field: string,
  texts: () => (string | undefined)[],
  font: PDFFont,
  size: number,
  draw: () => T
): T {
  try {
    return draw();
  } catch (err) {
    // A NaN `size` would make the measurement fail for EVERY character, and the
    // first one would be blamed by mistake — the problem there is the size,
    // not the text.
    const safeSize = finiteOr(size, 10);
    for (const text of texts()) {
      if (!text) continue;
      const char = firstUnencodableChar(text, font, safeSize);
      if (char !== null) throw new UnsupportedGlyphError(field, char, text);
    }
    // None of the known texts is the culprit — the error is something else, and
    // masking it as a glyph problem would be worse than passing it on.
    throw err;
  }
}

// A number pdf-lib accepts. NaN/Infinity arrive from a template built by code
// (`width: Number(input)`) and become an opaque TypeError deep inside ("`size`
// must be of type `number`, but was actually of type `NaN`"), with zero clue
// about which field. Here it falls back to the default, which is the right
// behavior for a measurement: a lost font size must not cost the document.
export function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
