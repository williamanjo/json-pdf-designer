import { en, type Dict } from "../i18n/en";
import { tokenize } from "./tokenize";

// Operador com espaço de um lado só — o buraco que a regra lexical deste
// formato deixa aberto.
//
// A regra é: operador só é operador cercado de espaço dos DOIS lados
// (tokenize.ts explica por quê — chave JSON chamada "AND", `{my-key}` etc).
// A consequência é que `{fatura /}` não é erro de sintaxe nenhum: o `/` tem
// `}` do lado direito, então entra no identificador e o path passa a ser
// `"fatura /"`. Essa chave não existe no JSON, path inexistente resolve pra
// vazio, e o campo sai em branco sem que nada acuse — nem o parser (a
// expressão é válida) nem a geração (dado faltando é degrade, não falha).
//
// Não dá pra virar erro de sintaxe: isso quebraria a garantia de que uma
// chave com `/` no nome continua acessível. Mas dá pra APONTAR o caso
// suspeito, e o sinal é preciso: espaço em EXATAMENTE UM lado. Chave com
// operador encostado (`{fatura/2}`) é plausível e fica quieta; chave com
// espaço de um lado só (`"fatura /"`, `"a >=b"`) é erro de digitação em
// praticamente todos os casos reais.
//
// Trabalhar sobre os tokens `ident` (não sobre a string crua) é o que faz a
// checagem não ter falso positivo de graça:
//   - operador de verdade já virou token `op`/`compare`/`logical`, nunca chega aqui;
//   - conteúdo de aspas já virou token `string`, então `{CONCAT("a > b", x)}` passa;
//   - sinal de número negativo (`-1` depois de `,` ou de operador) vira token
//     `number`, então `{CONCAT("x", -1)}` e `{a + -1}` passam.

const SYMBOL_OPERATORS = ["==", "!=", ">=", "<=", ">", "<", "+", "-", "*", "/"] as const;
const WORD_OPERATORS = ["AND", "NOT", "OR"] as const;

const isSpace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch);
// Letra/dígito/underscore: se o vizinho de "OR" é um desses, o "OR" é pedaço
// de palavra ("FORNECEDOR nome"), não um operador escrito errado.
const isWordChar = (ch: string | undefined) => ch !== undefined && /[A-Za-z0-9_]/.test(ch);

// Qual operador começa em `i` dentro deste identificador, ou null.
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

// O primeiro operador com espaço de um lado só dentro de um identificador.
// Início e fim do identificador contam como "sem espaço" — é a mesma
// convenção de `isSurroundedBySpace` em tokenize.ts, e é o que faz
// `{fatura /}` (fim do token à direita) ser pego.
function oneSidedOperatorIn(ident: string): string | null {
  for (let i = 0; i < ident.length; i++) {
    const op = operatorTextAt(ident, i);
    if (!op) continue;
    if (isSpace(ident[i - 1]) !== isSpace(ident[i + op.length])) return op;
    i += op.length - 1;
  }
  return null;
}

// O aviso de UMA expressão, ou null se não há nada suspeito. Nunca estoura:
// expressão que nem tokeniza é problema do `expressionError`, que já a
// reporta como erro de sintaxe — dois avisos pro mesmo defeito só confundem.
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

// O mesmo para um template inteiro (texto com zero ou mais `{...}`), token a
// token. Mesmo formato de retorno de `templateExpressionErrors`.
const TOKEN_RE = /\{([^{}]+)\}/g;

export function templateSuspiciousOperators(template: string, t: Dict = en): { token: string; message: string }[] {
  const found: { token: string; message: string }[] = [];
  for (const match of template.matchAll(TOKEN_RE)) {
    const message = suspiciousOperator(match[1], t);
    if (message) found.push({ token: match[0], message });
  }
  return found;
}
