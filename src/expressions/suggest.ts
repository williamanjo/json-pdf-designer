import { CUSTOM_FIELD_FUNCTIONS } from "../bindings/bindings";
import type { Dict } from "../i18n";

// Autocomplete do editor de expressão (FormulaModal.tsx), em módulo puro.
//
// Puro por necessidade e não por gosto: o projeto não tem
// @testing-library/react (ver o topo de test/i18n/withInlineCode.test.tsx),
// então o que não estiver fora do componente não tem como ser testado. Aqui
// mora a parte que erra fácil — onde a palavra começa, o que sobra do texto
// depois de aceitar uma sugestão, onde o caret para.

export type Suggestion = {
  kind: "function" | "operator";
  // Como aparece na lista.
  name: string;
  // O que entra no texto. Função abre parêntese; operador leva espaço.
  insert: string;
  // Chave do exemplo e da dica no dicionário (só função). A sugestão carrega
  // a CHAVE, não o texto: `suggestAt` é puro e não recebe idioma; quem
  // desenha a lista tem o `t` à mão e resolve lá (ver FormulaModal.tsx).
  hintKey?: keyof Dict["fieldFunctions"];
};

// Os operadores por palavra do formato. Ficam aqui e não em tokenize.ts
// porque ali a lista é do LEXER (com a regra de espaço nos dois lados); esta
// é da UI, e as duas mudariam juntas se um operador novo aparecesse — o
// teste garante que continuam batendo.
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
  // Sem palavra parcial no caret, nada é sugerido — nem a lista inteira.
  // Sugerir 14 itens só por o cursor estar num campo vazio (ou logo depois de
  // um "(" ) é ruído que tapa o editor; a lista aparece quando se digita uma
  // letra, e some sozinha depois de "(" ou ",".
  const { word } = wordAtCaret(text, caret);
  if (!word) return [];
  const prefix = word.toUpperCase();
  return ALL_SUGGESTIONS.filter((s) => s.name.startsWith(prefix));
}

// Insere `insert` no caret, trocando a palavra parcial que estava sendo
// digitada. Devolve onde o caret deve ficar — sem isso o cursor pula pro fim
// do texto e digitar continua no lugar errado.
export function applySuggestion(text: string, caret: number, suggestion: Suggestion): { text: string; caret: number } {
  const { start } = wordAtCaret(text, caret);
  let insert = suggestion.insert;
  // Operador só é operador cercado de espaço dos DOIS lados (tokenize.ts).
  // Garantir o espaço da esquerda aqui é o que impede o autocomplete de
  // produzir exatamente o defeito que `suspiciousOperator` avisa: um
  // `total AND` encostado vira nome de chave, não operação.
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
