import { en } from "../i18n/locales/en";
import type { Dict } from "../i18n/locales/en";

// Erros de expressão de template.
//
// Existem como CLASSES, e sob uma base comum, porque duas camadas precisam
// distinguir "o template está mal escrito" de "o motor quebrou":
//
// - `expressions/resolve.ts` engole os erros de template (campo vira vazio) e
//   deixa passar qualquer outro. Se um deles não descendesse de
//   `ExpressionError`, ele derrubaria o `generatePdf` inteiro.
// - `fieldWarnings.ts` transforma cada um deles no aviso do campo no editor.
//
// A versão anterior tinha uma classe só e reconhecia o erro de profundidade
// por regex na MENSAGEM. Isso já estava furado na prática: a camada tolerante
// não pegava o erro de profundidade, então uma expressão absurdamente
// aninhada derrubava a geração — justamente o caso (template malformado ou
// malicioso) em que tolerar mais importa.
//
// E o texto NÃO mora aqui: cada erro carrega `code` + `detail`, e a frase sai
// do dicionário (`t.expressionErrors[code]`). O motivo é que a mesma falha
// aparece em dois lugares com idiomas diferentes — no editor, no idioma do
// designer, e no `Error.message` de quem chamou `parse` num backend, onde a
// convenção de biblioteca é inglês. `message` é a versão inglesa;
// `localize(t)` dá a do idioma ativo.

// Explícito, e não derivado do dicionário: `expressionErrors` no dicionário
// também carrega mensagens que NÃO são erro estourado pelo parser (chave
// desbalanceada, operador suspeito — as duas são checagem de editor). Listar
// aqui deixa claro o que é código de erro; esquecer a chave no dicionário
// quebra o typecheck no `textOf` abaixo.
export type ExpressionErrorCode =
  | "incomplete"
  | "unclosedParen"
  | "unclosedCall"
  | "operatorWithoutLeft"
  | "unexpectedToken"
  | "trailingContent"
  | "unclosedQuote"
  // Path entre brackets (3.2.0): `[a` sem fechar, `[]`, e `[a b]` sem quotes.
  // O último é recusa deliberada de ambiguidade — ver o topo de tokenize.ts.
  | "unclosedBracket"
  | "emptySegment"
  | "spaceInSegment"
  | "tooDeep";

export abstract class ExpressionError extends Error {
  // Trecho que estava sendo avaliado — vai na mensagem do aviso.
  abstract readonly source: string;
  // Qual falha foi, sem depender de casar texto. Um consumidor que queira
  // decidir por tipo de erro usa isto, não a mensagem.
  abstract readonly code: ExpressionErrorCode;
  // Parâmetro da mensagem (nome da função, texto do token, limite de
  // profundidade) — "" quando a frase não tem nenhum.
  abstract readonly detail: string;
  // A mesma mensagem, no idioma de `t`.
  abstract localize(t: Dict): string;
}

function textOf(t: Dict, code: ExpressionErrorCode, detail: string): string {
  return t.expressionErrors[code](detail);
}

export class ExpressionSyntaxError extends ExpressionError {
  constructor(
    readonly code: ExpressionErrorCode,
    readonly source: string,
    // Offset EXATO do problema na string original (ver `start` nos tokens em
    // tokenize.ts) — aparece no aviso do campo, então precisa apontar o
    // caractere certo.
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

// Aninhamento além do limite. Protege a call stack do V8 de um template
// malformado (ou malicioso, em cenário multi-tenant onde o template vem de
// fonte não confiável) tipo `{CURRENCY(CURRENCY(CURRENCY(...)))}` repetido
// milhares de vezes: sem o limite isso é crash, não erro tratável.
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
