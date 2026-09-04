import type { Dict } from "./i18n/locales/en";
import { ExpressionError } from "./expressions/errors";

// TODA falha que este pacote lança de propósito, como CLASSE, num arquivo só.
//
// Duas decisões moram aqui, e as duas são deliberadas:
//
// 1. `error.message` é INGLÊS, sempre. Mensagem lançada é diagnóstico de
//    DESENVOLVEDOR: ela vai pro log, pro stack trace e pro Sentry. Localizá-la
//    deixa o log multilíngue e impossível de grepar ("qual a frase em turco
//    disso?"), e a convenção de biblioteca é uma língua só. Várias delas dizem
//    o que FAZER (`passe generatePdf(..., { maxPages })`, `passe fontBytes`) —
//    essa é a parte mais valiosa, e é por isso que nenhuma foi encurtada.
//
// 2. O texto de USUÁRIO FINAL é localizado, e sai daqui por `describePdfError`
//    (no fim do arquivo) — que recebe o erro e um `Dict` e devolve
//    título + ação no idioma pedido. Ver a seção `errors` de `i18n/locales/en.ts`.
//
// POR QUE UM ARQUIVO SÓ, e não a classe junto do `throw`:
//
//   - `describePdfError` precisa conhecer TODAS as classes pra fazer o switch
//     exaustivo. Se cada uma morasse no seu módulo, o localizador importaria
//     `pdf/generate.ts` (pdf-lib, fontkit) e `template/migrate.ts` — ou seja,
//     quem só quer traduzir um erro pagaria o grafo inteiro de geração.
//   - Este arquivo importa `i18n/en` (tipo) e `expressions/errors`. Zero
//     React, zero pdf-lib, zero DOM — é o que deixa `src/server.ts`
//     reexportar tudo daqui (ver test/entryBoundaries.test.ts).
//
// POR QUE CLASSE, e não dicionário passado pelo pipeline: `drawImageField`
// está três camadas abaixo de `generatePdf`, e `migrateTemplate` roda ANTES
// das opções serem lidas. Threading de `locale` por aí (ou pior, um `locale`
// em estado de módulo) contamina toda assinatura do caminho de render por uma
// preocupação de apresentação. A classe carrega o DADO; quem apresenta
// localiza na borda.

// ---------------------------------------------------------------------------
// O discriminante
// ---------------------------------------------------------------------------

// A lista é a FONTE da verdade, e o tipo é derivado dela (não o contrário):
// assim existe um array em runtime pro guard de exaustividade
// (test/errors.test.ts) checar que todo code tem entrada nos dois
// dicionários. Sem esse array, um code novo renderizaria string vazia e nada
// avisaria.
export const PDF_ERROR_CODES = [
  "pageLimit",
  "unsupportedGlyph",
  "invalidPageSize",
  "backgroundImageUnreadable",
  "imageUploadTooLarge",
  "imageUploadUnreadable",
  "imageTooLarge",
  "tooManyImages",
  "unsupportedImageFormat",
  "imageUnreadable",
  "paginationStalled",
  "woff2SupportMissing",
  "fontDecompressFailed",
  "fontDecompressTimeout",
  "templateNotAnObject",
  "templateVersionInvalid",
  "templateVersionTooNew",
  "templateMigrationMissing",
] as const;

// `instanceof` funciona pra todas elas (a base comum abaixo), mas `code` é o
// que deixa o consumidor cobrir TODOS os casos com `switch` e ter o
// TypeScript reclamando quando aparecer um novo.
export type PdfErrorCode = (typeof PDF_ERROR_CODES)[number];

// De quem é a culpa. Muda o tom da UI e, num backend, o status HTTP: `data` e
// `template` são 4xx (quem chamou manda dado/template diferente), `config` é
// erro de instalação/opção, `package` é 500 — bug nosso, pra reportar.
export type PdfErrorBlame = "data" | "template" | "config" | "package";

// Base comum de todas elas. Abstrata de propósito: ninguém deve lançar um
// "erro genérico de PDF" — se não cabe em nenhuma classe abaixo, a resposta
// certa é classe nova, com os dados daquele sítio.
export abstract class PdfGenerationError extends Error {
  abstract readonly code: PdfErrorCode;
  abstract readonly blame: PdfErrorBlame;
}

const MB = 1024 * 1024;

// Limite em MB pra mensagem — `15728640` não diz nada a ninguém.
function mb(bytes: number): number {
  return Math.round((bytes / MB) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Paginação e layout
// ---------------------------------------------------------------------------

// Documento passou do teto de páginas. Interrompe em vez de devolver um PDF
// truncado que parece completo — ver DEFAULT_MAX_PAGES em
// pdf/layout/layoutDocument.ts pro porquê do teto ser em PÁGINA e não em
// iteração.
export class PageLimitError extends PdfGenerationError {
  readonly code = "pageLimit" as const;
  readonly blame = "data" as const;

  constructor(
    readonly maxPages: number,
    readonly field: string
  ) {
    super(
      `The document went past ${maxPages} pages while paginating "${field}" — generation stopped. ` +
        `Either the data is much bigger than expected (filter it before generating, or split it into several PDFs), ` +
        `or the template has a field that never fits on a page. ` +
        `If ${maxPages} pages is too few for your case, pass generatePdf(..., { maxPages }).`
    );
    this.name = "PageLimitError";
  }
}

// Um laço de paginação que não avança é bug de aritmética, não dado grande.
// Antes isso viraria giro até um contador de iteração estourar e o resultado
// sair truncado em silêncio.
export class PaginationStalledError extends PdfGenerationError {
  readonly code = "paginationStalled" as const;
  readonly blame = "package" as const;

  constructor(readonly field: string) {
    super(
      `Pagination stalled on "${field}": one pass consumed no content and opened no page. ` +
        `This is a bug in the package, not in your template — please report it with the template that reproduces it.`
    );
    this.name = "PaginationStalledError";
  }
}

// Tamanho de página é estrutural: não há default sensato pra adivinhar, e o
// pdf-lib devolveria um TypeError opaco ("`width` must be of type `number`,
// but was actually of type `NaN`") sem dizer de qual página. Um NaN aqui vem
// de template montado por código (`width: Number(input)`) — JSON não
// representa NaN.
export class InvalidPageSizeError extends PdfGenerationError {
  readonly code = "invalidPageSize" as const;
  readonly blame = "template" as const;

  constructor(
    readonly pageId: string,
    readonly width: number,
    readonly height: number
  ) {
    super(
      `Page "${pageId}": invalid size (width=${width}, height=${height}) — ` +
        `expected two finite numbers greater than zero, in millimetres.`
    );
    this.name = "InvalidPageSizeError";
  }
}

// ---------------------------------------------------------------------------
// Fonte
// ---------------------------------------------------------------------------

function codePointLabel(char: string): string {
  const cp = char.codePointAt(0) ?? 0;
  return `U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
}

// Erro de glifo ausente com contexto suficiente pra agir: qual campo, qual
// caractere, e o que fazer.
//
// A alternativa seria descartar o caractere e seguir. Não fazemos: um relatório
// é um documento que alguém assina, e sumir com um caractere do conteúdo em
// silêncio é pior que falhar. Caractere de CONTROLE é outra história (não tem
// glifo em fonte nenhuma) — esse o sanitizeText de pdf/textSafety.ts resolve.
export class UnsupportedGlyphError extends PdfGenerationError {
  readonly code = "unsupportedGlyph" as const;
  readonly blame = "data" as const;
  // U+XXXX do caractere — o consumidor não precisa recalcular pra mostrar.
  readonly codePoint: string;

  constructor(
    readonly field: string,
    readonly char: string,
    readonly text: string
  ) {
    super(
      `Field "${field}": the character ${JSON.stringify(char)} (${codePointLabel(char)}) does not exist in the font in use. ` +
        `The default font (Helvetica/WinAnsi) covers Latin accents, but not emoji/CJK/Arabic — ` +
        `pass \`fontBytes\` with a font that covers this character in generatePdf(..., { fontBytes }), ` +
        `or strip the character from the data.`
    );
    this.name = "UnsupportedGlyphError";
    this.codePoint = codePointLabel(char);
  }
}

// `wawoff2` é peer OPCIONAL (ver package.json): só quem embute .woff2 de
// verdade precisa dela. Quem passa .ttf/.otf/.woff nunca chega aqui.
export class Woff2SupportMissingError extends PdfGenerationError {
  readonly code = "woff2SupportMissing" as const;
  readonly blame = "config" as const;

  constructor() {
    super(
      `Embedding a .woff2 font needs the optional 'wawoff2' package — ` +
        `run \`npm install wawoff2\`, or convert the font to .ttf/.otf offline ` +
        `(e.g. via wawoff2 in a throwaway Node script) and pass that instead.`
    );
    this.name = "Woff2SupportMissingError";
  }
}

// O descompressor rodou e recusou o arquivo (devolveu `false`).
export class FontDecompressFailedError extends PdfGenerationError {
  readonly code = "fontDecompressFailed" as const;
  readonly blame = "config" as const;

  constructor(readonly format: "woff2") {
    super(
      `Could not decompress the ${format.toUpperCase()} font (ConvertWOFF2ToTTF returned no data) — ` +
        `the file is probably corrupt, or is not really a ${format.toUpperCase()}. ` +
        `Convert the font to .ttf/.otf offline and pass that instead.`
    );
    this.name = "FontDecompressFailedError";
  }
}

// Rede de segurança pro que sobrar de instabilidade do WASM (CSP bloqueando
// wasm-eval, engine muito antiga etc). Sem ela, quem chamou `generatePdf`
// esperaria pra sempre, sem feedback nenhum.
export class FontDecompressTimeoutError extends PdfGenerationError {
  readonly code = "fontDecompressTimeout" as const;
  readonly blame = "config" as const;

  constructor(
    readonly format: "woff2",
    readonly timeoutMs: number
  ) {
    super(
      `${format.toUpperCase()} decompression stalled for more than ${timeoutMs}ms ` +
        `(a known WASM instability in some environments) — ` +
        `convert the file to .ttf/.otf once, offline (wawoff2 running in Node, for example), ` +
        `and use that .ttf/.otf directly as fontBytes.`
    );
    this.name = "FontDecompressTimeoutError";
  }
}

// ---------------------------------------------------------------------------
// Imagem
// ---------------------------------------------------------------------------

// Portão de ENTRADA, no editor: protege a aba do navegador de travar
// convertendo um arquivo enorme, antes de gastar CPU/memória com ele.
export class ImageUploadTooLargeError extends PdfGenerationError {
  readonly code = "imageUploadTooLarge" as const;
  readonly blame = "data" as const;

  constructor(
    readonly bytes: number,
    readonly limitBytes: number
  ) {
    super(`File is bigger than the ${mb(limitBytes)}MB limit (${mb(bytes)}MB) — shrink it before uploading.`);
    this.name = "ImageUploadTooLargeError";
  }
}

// Onde a conversão do arquivo escolhido pra PNG parou. Um `reason` só, e não
// três classes: as três falhas querem dizer a mesma coisa pra quem escolheu o
// arquivo ("não deu pra usar este arquivo"), e a ação é a mesma.
export type ImageUploadFailureReason = "read" | "decode" | "canvas";

const UPLOAD_FAILURE_DETAIL: Record<ImageUploadFailureReason, string> = {
  read: "the browser could not read the file",
  decode: "the browser could not decode the image (corrupt file, or a format it does not support)",
  canvas: "Canvas 2D is unavailable, so the image could not be converted to PNG",
};

export class ImageUploadUnreadableError extends PdfGenerationError {
  readonly code = "imageUploadUnreadable" as const;
  readonly blame = "data" as const;

  constructor(readonly reason: ImageUploadFailureReason) {
    super(`Could not use the picked file as a background image — ${UPLOAD_FAILURE_DETAIL[reason]}.`);
    this.name = "ImageUploadUnreadableError";
  }
}

// `field` null = imagem de FUNDO da página (Template.backgroundImage), que não
// tem nome de campo. Uma classe pra os dois porque o limite, o dado e a ação
// são idênticos — só o rótulo muda.
export class ImageTooLargeError extends PdfGenerationError {
  readonly code = "imageTooLarge" as const;
  readonly blame = "template" as const;

  constructor(
    readonly field: string | null,
    readonly bytes: number,
    readonly limitBytes: number
  ) {
    super(
      `${field === null ? "Page background image" : `Field "${field}"`}: ` +
        `image is bigger than the ${mb(limitBytes)}MB limit (${mb(bytes)}MB) — shrink the file before using it.`
    );
    this.name = "ImageTooLargeError";
  }
}

// Teto de imagens ÚNICAS por documento (o imageCache já dedupe por conteúdo):
// centenas de imagens distintas repetidas por uma seção é o jeito fácil de
// travar quem gera o PDF.
export class TooManyImagesError extends PdfGenerationError {
  readonly code = "tooManyImages" as const;
  readonly blame = "template" as const;

  constructor(readonly maxImages: number) {
    super(
      `The document goes past the limit of ${maxImages} distinct images — ` +
        `reduce how many different images it uses.`
    );
    this.name = "TooManyImagesError";
  }
}

export class UnsupportedImageFormatError extends PdfGenerationError {
  readonly code = "unsupportedImageFormat" as const;
  readonly blame = "template" as const;

  constructor(readonly field: string) {
    super(`Field "${field}": image in an unsupported format (PNG/JPEG only). Re-upload the file from the editor.`);
    this.name = "UnsupportedImageFormatError";
  }
}

export class ImageUnreadableError extends PdfGenerationError {
  readonly code = "imageUnreadable" as const;
  readonly blame = "template" as const;

  constructor(readonly field: string) {
    super(`Field "${field}": could not read this image — the file is corrupt or invalid.`);
    this.name = "ImageUnreadableError";
  }
}

// Separada de ImageUnreadableError de propósito: o fundo é um artefato de
// AUTORIA (o letterhead que alguém subiu no editor), a imagem de campo vem do
// dado. A ação é diferente, e o consumidor quer poder dizer qual das duas é.
//
// O pdf-lib/pako lança uma STRING crua no caminho original ("The input is not
// a PNG file!"), não um Error — então `catch (e) { e.message }` de quem chama
// dava `undefined`. Esta classe também conserta isso.
export class BackgroundImageUnreadableError extends PdfGenerationError {
  readonly code = "backgroundImageUnreadable" as const;
  readonly blame = "template" as const;

  constructor() {
    super(`Page background image: could not read this PNG — the file is corrupt, or is not a PNG.`);
    this.name = "BackgroundImageUnreadableError";
  }
}

// ---------------------------------------------------------------------------
// Template (migração)
// ---------------------------------------------------------------------------

export class TemplateNotAnObjectError extends PdfGenerationError {
  readonly code = "templateNotAnObject" as const;
  readonly blame = "template" as const;

  constructor(readonly receivedType: string) {
    super(`Invalid template — expected an object, received ${receivedType}.`);
    this.name = "TemplateNotAnObjectError";
  }
}

export class TemplateVersionInvalidError extends PdfGenerationError {
  readonly code = "templateVersionInvalid" as const;
  readonly blame = "template" as const;
  readonly receivedType: string;

  constructor(
    readonly received: unknown,
    // Versão assumida quando `version` está ausente — o que este erro diz que
    // seria a alternativa válida.
    readonly implicitVersion: number
  ) {
    super(
      `Invalid Template.version (${JSON.stringify(received)}) — ` +
        `expected an integer >= 1, or absent for format ${implicitVersion}.`
    );
    this.name = "TemplateVersionInvalidError";
    this.receivedType = Array.isArray(received) ? "array" : typeof received;
  }
}

// Versão MAIOR que a corrente é erro, não aviso: o arquivo foi salvo por um
// build mais novo e pode conter campos que este build ignoraria em silêncio.
// Falhar alto é melhor que gerar um PDF faltando pedaço.
export class TemplateVersionTooNewError extends PdfGenerationError {
  readonly code = "templateVersionTooNew" as const;
  readonly blame = "template" as const;

  constructor(
    readonly found: number,
    readonly supported: number
  ) {
    super(
      `Template is at version ${found}, but this build only understands up to ${supported} — ` +
        `update json-pdf-designer.`
    );
    this.name = "TemplateVersionTooNewError";
  }
}

export class TemplateMigrationMissingError extends PdfGenerationError {
  readonly code = "templateMigrationMissing" as const;
  readonly blame = "package" as const;

  constructor(
    readonly from: number,
    readonly to: number
  ) {
    super(
      `Missing the Template migration from version ${from} to ${to} — ` +
        `bug in the package, not in your template.`
    );
    this.name = "TemplateMigrationMissingError";
  }
}

// ---------------------------------------------------------------------------
// O localizador
// ---------------------------------------------------------------------------

// A união EXPLÍCITA das classes. É ela que faz `switch (err.code)` estreitar
// pra classe certa (e portanto dar acesso aos campos estruturados): a base
// abstrata sozinha só daria `code: PdfErrorCode`, sem ligar code e campos.
//
// Classe nova sem entrada aqui → o `case` dela em describePdfError não
// compila. É o segundo dos três guards de exaustividade; os outros dois são o
// `assertExhaustive` no fim do switch e `PdfErrorCodesHaveDictEntries` abaixo.
export type AnyPdfError =
  | PageLimitError
  | PaginationStalledError
  | InvalidPageSizeError
  | UnsupportedGlyphError
  | Woff2SupportMissingError
  | FontDecompressFailedError
  | FontDecompressTimeoutError
  | ImageUploadTooLargeError
  | ImageUploadUnreadableError
  | ImageTooLargeError
  | TooManyImagesError
  | UnsupportedImageFormatError
  | ImageUnreadableError
  | BackgroundImageUnreadableError
  | TemplateNotAnObjectError
  | TemplateVersionInvalidError
  | TemplateVersionTooNewError
  | TemplateMigrationMissingError;

// Guard de tipo pra estreitar de `unknown` pra união. `instanceof` na base
// abstrata é o teste em runtime; a assinatura é o que o TypeScript usa.
export function isPdfError(err: unknown): err is AnyPdfError {
  return err instanceof PdfGenerationError;
}

// Terceiro guard: um code sem entrada na seção `errors` do dicionário faria
// `describePdfError` renderizar string vazia. Aqui isso é erro de COMPILAÇÃO.
type AssertTrue<T extends true> = T;
export type PdfErrorCodesHaveDictEntries = AssertTrue<PdfErrorCode extends keyof Dict["errors"] ? true : never>;

// `expression` não é um PdfErrorCode: os erros de expressão têm hierarquia
// própria (ExpressionError, com o `code` de SINTAXE deles e um `localize(t)`
// que já existe). Mas eles podem sair de `generatePdf` quando alguém usa a API
// estrita, então o localizador cobre — como um caso a mais, não forçando-os na
// união de cima.
export type PdfProblemCode = PdfErrorCode | "expression";

// O que mostrar pra quem NÃO é desenvolvedor.
//
// `title` e `action` estão separados porque é assim que se renderiza: o título
// é a frase principal, a ação é o que a pessoa faz agora, e `detail` (a
// mensagem crua, em inglês) é a linha técnica que fica escondida atrás de um
// "detalhes". Juntar os três num parágrafo só obrigaria a UI a desmontar.
export type PdfProblem = {
  // Pra decidir status HTTP, telemetria, ou um caso especial na UI sem casar
  // texto.
  code: PdfProblemCode;
  // De quem é a culpa — muda o tom, e o status.
  blame: PdfErrorBlame;
  // O que aconteceu, no idioma de `dict`.
  title: string;
  // O que fazer agora, no idioma de `dict`. Ausente quando não há ação útil
  // (bug do pacote: a "ação" é reportar, e isso o título já diz).
  action?: string;
  // Campo do template envolvido, quando o erro sabe qual.
  field?: string;
  // `error.message` cru — INGLÊS, de propósito (ver o topo do arquivo).
  detail: string;
};

// A tradução de um erro do pacote em texto de usuário final.
//
// Devolve `null` pro que NÃO é erro nosso — um TypeError de dentro do pdf-lib,
// um erro de rede, o que for. Aí o consumidor mostra o genérico DELE, em vez
// de nós inventarmos um título pra uma falha que não conhecemos.
//
// `dict` vem de `dictFor(locale)` (ou de `useT()` dentro de um componente).
export function describePdfError(err: unknown, dict: Dict): PdfProblem | null {
  const t = dict.errors;

  // Expressão inválida NÃO chega aqui na prática: a geração é tolerante de
  // propósito (expressão inválida vira campo vazio, ver expressions/resolve.ts)
  // e o editor avisa antes. Chega se alguém chamou a API estrita — `parse` num
  // backend que valida template antes de salvar, por exemplo.
  if (err instanceof ExpressionError) {
    return {
      code: "expression",
      blame: "template",
      title: t.expression.title,
      // `localize` é o localizador que a própria hierarquia de expressão já
      // tem — reimplementar aqui daria duas frases pra mesma falha.
      action: t.expression.action(err.localize(dict)),
      detail: err.message,
    };
  }

  if (!isPdfError(err)) return null;
  const detail = err.message;

  switch (err.code) {
    case "pageLimit":
      return { code: err.code, blame: err.blame, title: t.pageLimit.title(err.maxPages), action: t.pageLimit.action, field: err.field, detail };
    case "paginationStalled":
      return { code: err.code, blame: err.blame, title: t.paginationStalled.title(err.field), field: err.field, detail };
    case "invalidPageSize":
      return {
        code: err.code,
        blame: err.blame,
        title: t.invalidPageSize.title(err.pageId),
        // O nome da aba sai do MESMO dicionário que o editor usa pro rótulo
        // dela — assim a mensagem nunca manda procurar uma aba com outro nome.
        action: t.invalidPageSize.action(dict.tabBar.page),
        detail,
      };
    case "unsupportedGlyph":
      return {
        code: err.code,
        blame: err.blame,
        // O caractere é DADO (vem do JSON) — só a moldura da frase traduz.
        title: t.unsupportedGlyph.title(JSON.stringify(err.char), err.codePoint),
        action: t.unsupportedGlyph.action,
        field: err.field,
        detail,
      };
    case "woff2SupportMissing":
      return { code: err.code, blame: err.blame, title: t.woff2SupportMissing.title, action: t.woff2SupportMissing.action, detail };
    case "fontDecompressFailed":
      return { code: err.code, blame: err.blame, title: t.fontDecompressFailed.title, action: t.fontDecompressFailed.action, detail };
    case "fontDecompressTimeout":
      return { code: err.code, blame: err.blame, title: t.fontDecompressTimeout.title, action: t.fontDecompressTimeout.action, detail };
    case "imageUploadTooLarge":
      return {
        code: err.code,
        blame: err.blame,
        title: t.imageUploadTooLarge.title(mb(err.limitBytes)),
        action: t.imageUploadTooLarge.action,
        detail,
      };
    case "imageUploadUnreadable":
      return { code: err.code, blame: err.blame, title: t.imageUploadUnreadable.title, action: t.imageUploadUnreadable.action, detail };
    case "imageTooLarge":
      return {
        code: err.code,
        blame: err.blame,
        title:
          err.field === null
            ? t.imageTooLarge.titleBackground(mb(err.limitBytes))
            : t.imageTooLarge.titleField(err.field, mb(err.limitBytes)),
        action: t.imageTooLarge.action,
        ...(err.field === null ? {} : { field: err.field }),
        detail,
      };
    case "tooManyImages":
      return { code: err.code, blame: err.blame, title: t.tooManyImages.title(err.maxImages), action: t.tooManyImages.action, detail };
    case "unsupportedImageFormat":
      return {
        code: err.code,
        blame: err.blame,
        title: t.unsupportedImageFormat.title(err.field),
        action: t.unsupportedImageFormat.action,
        field: err.field,
        detail,
      };
    case "imageUnreadable":
      return { code: err.code, blame: err.blame, title: t.imageUnreadable.title(err.field), action: t.imageUnreadable.action, field: err.field, detail };
    case "backgroundImageUnreadable":
      return {
        code: err.code,
        blame: err.blame,
        title: t.backgroundImageUnreadable.title,
        action: t.backgroundImageUnreadable.action,
        detail,
      };
    case "templateNotAnObject":
      return {
        code: err.code,
        blame: err.blame,
        title: t.templateNotAnObject.title(err.receivedType),
        action: t.templateNotAnObject.action,
        detail,
      };
    case "templateVersionInvalid":
      return {
        code: err.code,
        blame: err.blame,
        title: t.templateVersionInvalid.title(JSON.stringify(err.received)),
        action: t.templateVersionInvalid.action,
        detail,
      };
    case "templateVersionTooNew":
      return {
        code: err.code,
        blame: err.blame,
        title: t.templateVersionTooNew.title(err.found, err.supported),
        action: t.templateVersionTooNew.action,
        detail,
      };
    case "templateMigrationMissing":
      return { code: err.code, blame: err.blame, title: t.templateMigrationMissing.title(err.from, err.to), detail };
  }

  // Inalcançável enquanto todo code tiver `case` acima — e é justamente isso
  // que esta linha garante: um code novo sem `case` faz `err` não ser `never`
  // aqui, e o TypeScript recusa a chamada. Em runtime devolve `null` (o mesmo
  // que um erro alheio) em vez de estourar dentro de um handler de erro.
  return assertExhaustive(err);
}

function assertExhaustive(_err: never): null {
  return null;
}
