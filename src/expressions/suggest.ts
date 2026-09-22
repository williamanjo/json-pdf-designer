import { CUSTOM_FIELD_FUNCTIONS } from "../bindings/bindings";
import type { Dict } from "../i18n";

// Autocomplete for the expression editor (FormulaModal.tsx), in a pure module.
//
// Pure out of necessity and not out of taste: the project has no
// @testing-library/react (see the top of test/i18n/withInlineCode.test.tsx),
// so whatever is not outside the component has no way of being tested. Here
// lives the part that is easy to get wrong — where the word starts, what is
// left of the text after accepting a suggestion, where the caret stops.

export type Suggestion = {
  kind: "function" | "operator";
  // How it appears in the list.
  name: string;
  // What goes into the text. A function opens a parenthesis; an operator takes a space.
  insert: string;
  // The key of the example and the hint in the dictionary (functions only).
  // The suggestion carries the KEY, not the text: `suggestAt` is pure and
  // receives no language; whoever draws the list has `t` at hand (FormulaModal).
  hintKey?: keyof Dict["fieldFunctions"];
};

// The format's word operators. They live here and not in tokenize.ts because
// there the list belongs to the LEXER (with the whitespace-on-both-sides
// rule); this one belongs to the UI, and the two would change together if a
// new operator appeared — the test guarantees they keep matching.
const WORD_OPERATORS = ["AND", "OR", "NOT"] as const;

const FUNCTION_SUGGESTIONS: Suggestion[] = CUSTOM_FIELD_FUNCTIONS.map((fn) => ({
  kind: "function",
  name: fn.name,
  insert: `${fn.name}(`,
  hintKey: fn.hintKey,
}));

const OPERATOR_SUGGESTIONS: Suggestion[] = WORD_OPERATORS.map((op) => ({
  kind: "operator",
  name: op,
  insert: `${op} `,
}));

export const ALL_SUGGESTIONS: Suggestion[] = [...FUNCTION_SUGGESTIONS, ...OPERATOR_SUGGESTIONS];

// Caractere que pode fazer parte de nome de função/operador. Ponto e hífen
// ficam de fora: `faturas.total` é caminho de dado, não nome de função, e
// sugerir em cima de um caminho só atrapalha.
const WORD_CHAR = /[A-Za-z_]/;

export function wordAtCaret(text: string, caret: number): { word: string; start: number; end: number } {
  let start = caret;
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start--;
  let end = caret;
  while (end < text.length && WORD_CHAR.test(text[end])) end++;
  return { word: text.slice(start, caret), start, end };
}

// O caret está dentro de um literal de string? Aspas são pares simples (o
// tokenizador não tem escape — ver tokenize.ts), então contar basta: ímpar
// antes do caret = dentro. Ali é texto, e sugerir função no meio de
// `CONCAT("Total ` só estorva.
function insideString(text: string, caret: number): boolean {
  let quotes = 0;
  for (let i = 0; i < caret; i++) if (text[i] === '"') quotes++;
  return quotes % 2 === 1;
}

export function suggestAt(text: string, caret: number): Suggestion[] {
  if (insideString(text, caret)) return [];
  // With no partial word at the caret, nothing is suggested — not even the
  // whole list. Suggesting 14 items just because the cursor is in an empty
  // field (or right after a "(" ) is noise that covers the editor; the list
  // appears when a letter is typed, and goes away by itself after "(" or ",".
  const { word } = wordAtCaret(text, caret);
  if (!word) return [];
  const prefix = word.toUpperCase();
  return ALL_SUGGESTIONS.filter((s) => s.name.startsWith(prefix));
}

// Inserts `insert` at the caret, replacing the partial word being typed. It
// returns where the caret should end up — without that the cursor jumps to
// the end of the text and typing carries on in the wrong place.
export function applySuggestion(text: string, caret: number, suggestion: Suggestion): { text: string; caret: number } {
  const { start } = wordAtCaret(text, caret);
  let insert = suggestion.insert;
  // An operator is only an operator when surrounded by whitespace on BOTH
  // sides (tokenize.ts). Guaranteeing the left-hand space here is what stops
  // the autocomplete from producing exactly the defect `suspiciousOperator`
  // warns about: a `total AND` sitting against the text becomes a key name.
  if (suggestion.kind === "operator" && start > 0 && !/\s/.test(text[start - 1])) {
    insert = ` ${insert}`;
  }
  const next = text.slice(0, start) + insert + text.slice(caret);
  return { text: next, caret: start + insert.length };
}

// Insere texto cru no caret — o clique num campo da lista da esquerda. Sem
// troca de palavra parcial: o que estava digitado fica.
export function insertAtCaret(text: string, caret: number, insert: string): { text: string; caret: number } {
  const next = text.slice(0, caret) + insert + text.slice(caret);
  return { text: next, caret: caret + insert.length };
}
