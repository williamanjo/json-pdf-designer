import { ExpressionDepthError, ExpressionSyntaxError, type ExpressionErrorCode } from "./errors";
import { tokenize, type Token } from "./tokenize";

// AST de uma expressão de template. Substitui o reescritor recursivo
// string-para-string do motor anterior, que reparseava a mesma string em cada
// nível — e por isso não tinha como ter precedência de operador nem
// agrupamento por parênteses (dois bugs reais: `{a + b * c}` dava 20 em vez
// de 14, e `{(a + b) * c}` dava 0).
export type Expr =
  // Literal de texto (o que veio entre aspas).
  | { kind: "text"; value: string }
  // Literal numérico. `text` é o que o autor ESCREVEU, e `value` o número:
  // `{2.50}` renderiza "2.50", mas numa conta vale 2.5. Dois campos em vez de
  // um opcional porque a invariante ("número sempre carrega o texto") passa a
  // ser do tipo, não uma convenção que dá pra esquecer.
  | { kind: "number"; value: number; text: string }
  | { kind: "path"; path: string }
  | { kind: "call"; name: string; args: Expr[]; argSources: string[] }
  | { kind: "binary"; op: "+" | "-" | "*" | "/"; left: Expr; right: Expr }
  | { kind: "compare"; op: "==" | "!=" | ">=" | "<=" | ">" | "<"; left: Expr; right: Expr }
  | { kind: "logical"; op: "AND" | "OR"; left: Expr; right: Expr }
  | { kind: "not"; operand: Expr };

// Precedência aritmética: `*` e `/` ligam mais forte que `+` e `-`. É a
// correção do primeiro bug — o motor anterior dobrava da esquerda pra
// direita, como calculadora de bolso.
const PRECEDENCE: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

// Mesmo limite (e mesmo motivo) do MAX_EXPRESSION_DEPTH do motor anterior:
// um template mal-formado ou malicioso com aninhamento gigante estoura a call
// stack do V8 como crash, não como erro tratável. 40 níveis cobre com folga
// qualquer aninhamento legítimo (uso real observado nunca passa de 2-3).
//
// Diferença importante em relação ao motor anterior: lá esse limite estava
// MASCARANDO uma recursão infinita — `{"x" + 1}` e `{a / zero}` batiam no
// limite e estouravam, porque a aritmética falhava, devolvia null, e o
// fallback reprocessava a MESMA string. Aqui o limite é só o que diz ser:
// profundidade real de aninhamento.
const MAX_EXPRESSION_DEPTH = 40;

// Gramática, do menor pro maior grau de ligação:
//
//   expressão   := ou
//   ou          := e ( 'OR' e )*
//   e           := não ( 'AND' não )*
//   não         := 'NOT' não | comparação
//   comparação  := aritmética ( op aritmética )?
//   aritmética  := átomo ( ('+'|'-'|'*'|'/') átomo )*   (precedence climbing)
//   átomo       := número | texto | path | FUNÇÃO(args) | '(' expressão ')'
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

  // Offset exato do token `index` na string original — cada token carrega o
  // seu (ver `start` em tokenize.ts). Nem indexOf (apontaria a PRIMEIRA
  // ocorrência do texto) nem soma de tamanhos (ignoraria o espaço entre
  // tokens) daria a posição certa.
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

  // O token seguinte, se for este operador lógico. Um helper em vez de
  // `peek()?.kind === "logical" && (peek() as ...).value === "OR"`, que
  // precisava de cast porque o `&&` não estreita o segundo `peek()`.
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
    // Comparação não associa — `a == b == c` não faz sentido aqui, e o motor
    // anterior também só lia a primeira.
    if (token?.kind === "compare") {
      this.next();
      return { kind: "compare", op: token.value, left, right: this.parseBinary(depth, 0) };
    }
    return left;
  }

  // Precedence climbing: consome operadores enquanto a precedência deles for
  // >= minPrecedence, descendo um nível pro lado direito.
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
        // Agrupamento de verdade — a correção do segundo bug.
        const inner = this.parseExpression(depth + 1);
        if (this.next()?.kind !== "rparen") {
          this.pos--;
          this.fail("unclosedParen");
        }
        return inner;
      }

      case "ident": {
        // Identificador seguido de "(" é chamada de função; senão é path.
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
                // Vírgula sobrando antes do ")" — `CONCAT(a,)`. O motor
                // anterior tolerava (splitDelimited descartava a parte
                // vazia), então estourar aqui derrubaria template que hoje
                // renderiza. Tolerar de volta.
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
        return { kind: "path", path: token.value };
      }

      case "op":
        // Menos unário: `{ - 5}`, `{a - -5}`. O tokenizador só emite "op" com
        // espaço dos dois lados, então isto é raro — mas tratar é melhor que
        // falhar.
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

  // Texto cru dos tokens de [from, to) — usado pelos agregadores (SUM/COUNT/
  // AVG), cujo argumento é um PATH DE ARRAY, não um valor a ser avaliado:
  // `SUM(itens.total)` soma a coluna `total` do array `itens`. Sem guardar o
  // texto, o parser já teria transformado isso num nó `path` e o agregador
  // perderia a informação de onde termina o array e começa a coluna.
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
    // Sobrou token — ex: `{a) b}`, `{SUM(a) SUM(b)}`. O tokenizador junta
    // espaço dentro de identificador, então isto é sempre erro de sintaxe de
    // verdade, não uma forma legítima.
    throw new ExpressionSyntaxError("trailingContent", source, parser.positionAtCursor());
  }
  return expr;
}
