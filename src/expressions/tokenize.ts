// Tokenizador das expressões de template ({...} em conteúdo de campo).
//
// A regra lexical central deste formato, e o motivo de existir um
// tokenizador à mão em vez de um genérico: **um operador só é operador
// quando tem espaço em branco dos DOIS lados**. Fora disso ele faz parte do
// identificador.
//
//   {my-key}    -> path "my-key"       (hífen dentro do nome da chave)
//   {my key}    -> path "my key"       (chave JSON com espaço)
//   {a-b}       -> path "a-b"
//   {a - b}     -> subtração
//   {IF(a==2,…)}-> path "a==2" (não é comparação — sem espaço)
//   {IF(a == 2,…)} -> comparação
//
// Não é capricho: é o contrato que o motor anterior tinha (por acidente do
// regex `/\s[+\-*/]\s/`) e do qual template salvo em produção depende. Um
// tokenizador "normal" quebraria `{my-key}` em `my`, `-`, `key` e devolveria
// 0 em silêncio. Aqui a regra é explícita e testada.
//
// Vale igual pros operadores por PALAVRA (AND/OR/NOT): `{a AND b}` combina
// duas condições, `{AND}` é o path de uma chave chamada "AND".

import { ExpressionSyntaxError } from "./errors";
// Reexportado porque quem lida com tokens costuma querer o erro junto.
export { ExpressionSyntaxError };

// Onde o token começa na string original. A posição aparece na mensagem de
// erro, que por sua vez vira o aviso do campo no editor — então tem de apontar
// o caractere exato, não uma aproximação.
type Located = { start: number };

export type Token = Located &
  (
    // `source` guarda o texto exatamente como foi escrito. Pra número isso
    // importa: `{2.50}` renderiza "2.50", não "2.5" — o literal preserva as
    // casas que o autor escreveu (é o que o motor anterior fazia, devolvendo o
    // texto cru). Numa conta, o valor é coagido normalmente.
    | { kind: "number"; value: number; source: string }
    | { kind: "string"; value: string; source: string }
    // Identificador: nome de função OU path de dado. Quem decide é o parser,
    // olhando se vem um "(" depois.
    | { kind: "ident"; value: string; source: string }
    | { kind: "op"; value: "+" | "-" | "*" | "/"; source: string }
    | { kind: "compare"; value: "==" | "!=" | ">=" | "<=" | ">" | "<"; source: string }
    | { kind: "logical"; value: "AND" | "OR" | "NOT"; source: string }
    | { kind: "lparen"; source: string }
    | { kind: "rparen"; source: string }
    | { kind: "comma"; source: string }
  );

// Tupla, não Set<string>: iterar/comparar sobre ela preserva o tipo literal,
// que é o que dispensa um cast ao montar o token.
const ARITHMETIC = ["+", "-", "*", "/"] as const;
// 2 caracteres antes de 1 — senão ">=" seria lido como ">" seguido de "="
// sobrando. Mesma ordem que o IF_OPERATORS do motor anterior usava.
const COMPARISONS = ["==", "!=", ">=", "<=", ">", "<"] as const;
// Mais longo antes do mais curto pela mesma razão (nenhum é prefixo de outro
// aqui, mas a ordem deixa a intenção explícita).
const NOT = "NOT";
const LOGICALS = ["AND", NOT, "OR"] as const;

const isSpace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch);

// Um operador nesta posição está cercado de espaço nos dois lados?
function isSurroundedBySpace(src: string, start: number, length: number): boolean {
  return isSpace(src[start - 1]) && isSpace(src[start + length]);
}

// O token do operador que começa em `i`, já com kind e value certos — só
// falta o `start`, que quem chama preenche. Devolver o token pronto (em vez de
// `{ text, kind }`) é o que dispensa reconstruí-lo com cast lá em cima.
//
// `Omit` direto sobre a união colapsaria os três membros num só objeto com
// `kind: "op" | "compare" | "logical"` e `value` de todos juntos — aí o
// resultado não seria mais atribuível a `Token`. O `T extends unknown` força a
// distribuição, preservando os três membros separados.
type WithoutStart<T> = T extends unknown ? Omit<T, "start"> : never;
type OperatorToken = WithoutStart<Extract<Token, { kind: "op" | "compare" | "logical" }>>;

// Qual operador começa em `i`, se algum ESTIVER cercado de espaço. Devolve
// null quando não há — inclusive quando o caractere é um operador mas está
// encostado no texto (aí ele pertence ao identificador).
function operatorAt(src: string, i: number): OperatorToken | null {
  for (const cmp of COMPARISONS) {
    if (src.startsWith(cmp, i) && isSurroundedBySpace(src, i, cmp.length)) {
      return { kind: "compare", value: cmp, source: cmp };
    }
  }
  // AND/OR/NOT são case-insensitive, igual nome de função (`sum(...)`
  // funciona). O `source` guarda como foi escrito; o `value` normaliza.
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

// `NOT` no COMEÇO da expressão (ou logo depois de um "(" / operador) não tem
// espaço à esquerda, então `isSurroundedBySpace` recusaria. Este caso extra
// cobre `{NOT pago}` e `{IF(NOT pago, …)}` — só pra NOT, que é prefixo.
function leadingNotAt(src: string, i: number, tokens: Token[]): boolean {
  if (src.slice(i, i + NOT.length).toUpperCase() !== NOT) return false;
  if (!isSpace(src[i + NOT.length])) return false;
  const before = src.slice(0, i).trim();
  if (before === "") return true;
  const prev = tokens[tokens.length - 1];
  return prev !== undefined && (prev.kind === "lparen" || prev.kind === "comma" || prev.kind === "logical");
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

    // Espaço fora de identificador (entre um ")" e um operador, por exemplo)
    // — só pula. Espaço DENTRO de identificador é tratado no acumulador
    // abaixo, que só corta no fim.
    if (/\s/.test(ch)) { i++; continue; }

    // Átomo: consome até bater em pontuação ou num operador cercado de
    // espaço. Espaço e hífen encostados entram no átomo de propósito (ver o
    // comentário no topo).
    const start = i;
    while (i < source.length) {
      const c = source[i];
      if (c === "(" || c === ")" || c === "," || c === '"') break;
      if (operatorAt(source, i)) break;
      i++;
    }
    const raw = source.slice(start, i);
    const text = raw.trim();
    if (text === "") {
      // Só espaço até a próxima pontuação — nada a emitir.
      continue;
    }
    // Literal numérico puro (o "2" de NUMBER(valor, 2)). Sem isto viraria
    // busca de path por engano — chave "2" não existe no JSON.
    if (/^-?\d+(\.\d+)?$/.test(text)) {
      tokens.push({ kind: "number", value: Number(text), source: text, start: start + raw.indexOf(text) });
    } else {
      tokens.push({ kind: "ident", value: text, source: raw, start: start + raw.indexOf(text) });
    }
  }

  return tokens;
}
