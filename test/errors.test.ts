import { readFileSync } from "./support/read";
import { describe, expect, it } from "vitest";
import { generatePdf } from "../src/pdf/generate";
import { normalizeFontBytes } from "../src/pdf/fontUtils";
import { fileToBackgroundImage } from "../src/pdf/backgroundImage";
import { migrateTemplate } from "../src/template";
import { dictFor } from "../src/i18n/dictionaries";
import { en } from "../src/i18n/locales/en";
import { ptBR } from "../src/i18n/locales/pt-BR";
import { ExpressionSyntaxError } from "../src/expressions/errors";
import { parse } from "../src/expressions/engine/parse";
import {
  BackgroundImageUnreadableError,
  FontDecompressFailedError,
  FontDecompressTimeoutError,
  ImageTooLargeError,
  ImageUnreadableError,
  ImageUploadTooLargeError,
  ImageUploadUnreadableError,
  InvalidPageSizeError,
  PDF_ERROR_CODES,
  PageLimitError,
  PaginationStalledError,
  PdfGenerationError,
  TemplateMigrationMissingError,
  TemplateNotAnObjectError,
  TemplateVersionInvalidError,
  TemplateVersionTooNewError,
  TooManyImagesError,
  UnsupportedGlyphError,
  UnsupportedImageFormatError,
  Woff2SupportMissingError,
  describePdfError,
  isPdfError,
  type AnyPdfError,
  type PdfErrorCode,
  type PdfProblemCode,
} from "../src/errors";
import { relativeToSrc, sourceFiles, stringLiterals, stripComments } from "./support/classScan";
import type { ImageSchema, Template } from "../src/types";

// The package's errors, in the two halves of the design:
//
//   1. A CLASS with a `code` + structured data, thrown by the REAL path (a
//      template that goes past the limit, an image in the wrong format…) —
//      that is what replaces the `if (/a Portuguese phrase/.test(err.message))`
//      the examples used to do.
//   2. `describePdfError(err, t)` returning localized end-user text, and
//      `null` for an error that is not ours.
//
// The test that matters most here is the EXHAUSTIVENESS one, at the end:
// without it, a new code with no dictionary entry renders empty and nothing warns.

const A4 = { width: 210, height: 297 };

function text(content: string, over: Record<string, unknown> = {}) {
  return { id: "t1", name: "titulo", type: "text", x: 10, y: 10, width: 100, height: 12, content, fontSize: 12, ...over } as never;
}

function image(content: string, over: Partial<ImageSchema> = {}): ImageSchema {
  return { id: "i1", name: "logo", type: "image", x: 10, y: 10, width: 40, height: 40, content, ...over };
}

// The error `promise` rejects with. Asserting about the CLASS and the fields
// requires having the object in hand — `rejects.toThrow(/.../)` only looks at
// the phrase, which is precisely the coupling this design removes.
async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error("expected the promise to reject, and it resolved");
}

function thrown(fn: () => unknown): unknown {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error("expected the call to throw, and it did not");
}

// ---------------------------------------------------------------------------
// The classes, through the real path
// ---------------------------------------------------------------------------

describe("as classes de erro chegam pelo caminho real, com os dados estruturados", () => {
  it("tamanho de página não finito → InvalidPageSizeError com id, width e height", async () => {
    const err = await rejection(generatePdf({ page: { width: NaN, height: 297 }, schemas: [text("x")] }, {}, []));
    expect(err).toBeInstanceOf(InvalidPageSizeError);
    const typed = err as InvalidPageSizeError;
    expect(typed.code).toBe("invalidPageSize");
    expect(typed.blame).toBe("template");
    // The design page's id. With no `pages`, it is the implicit page.
    expect(typeof typed.pageId).toBe("string");
    expect(Number.isNaN(typed.width)).toBe(true);
    expect(typed.height).toBe(297);
  });

  // The case the guard did NOT catch, and the reason it moved.
  //
  // `assertFinitePageSize` lived inside `renderLayoutPage`, which runs AFTER
  // `layoutDocument`. And the layout reads the size directly (`bodyLayout.ts`
  // does `pageDef.page.height - footerHeight`), so a template with no `page`
  // threw `TypeError: Cannot read properties of undefined (reading 'height')`
  // in there, before the guard was on the stack at all.
  //
  // What made this worth fixing was not the ugly message: a TypeError is not
  // OUR error, so `describePdfError` returns `null` and the consumer
  // classifies the failure as `blame: "package"` — "not your fault, report it"
  // — when the problem was their template. It is exactly the confusion the
  // typed error surface exists to end, and that is why the last case of this
  // block checks the consumer, and not only the class.
  it("`page` AUSENTE → InvalidPageSizeError, não um TypeError do layout", async () => {
    // A template with no `page` at all: hand-edited JSON, a file saved by
    // another tool, a shape the migration did not cover.
    const err = await rejection(generatePdf({ schemas: [text("x")] } as unknown as Template, {}, []));
    expect(err).toBeInstanceOf(InvalidPageSizeError);
    expect((err as Error).constructor.name).not.toBe("TypeError");
    const typed = err as InvalidPageSizeError;
    expect(typed.blame).toBe("template");
    // Absent becomes NaN in the error's fields — which is what the message has to say.
    expect(Number.isNaN(typed.width)).toBe(true);
    expect(Number.isNaN(typed.height)).toBe(true);
  });

  it("`page` que não é objeto → InvalidPageSizeError", async () => {
    const err = await rejection(
      generatePdf({ page: "A4", schemas: [text("x")] } as unknown as Template, {}, [])
    );
    expect(err).toBeInstanceOf(InvalidPageSizeError);
  });

  it("uma string numérica continua sendo recusada", async () => {
    // A guard against a "fix" that coerced the input: `Number("210")` is 210
    // and would pass, and then the value would carry on as a STRING through
    // the rest of generation. The coercion exists only to fill the error's fields.
    const err = await rejection(
      generatePdf({ page: { width: "210", height: 297 }, schemas: [text("x")] } as unknown as Template, {}, [])
    );
    expect(err).toBeInstanceOf(InvalidPageSizeError);
  });

  it("página torta no meio de `pages` falha ANTES de renderizar as boas", async () => {
    // This test proves ORDER, and the way to prove order is to give page 1 a
    // failure of its OWN and see which of the two comes out.
    //
    // Page 1 has an emoji, which without `fontBytes` gives an
    // UnsupportedGlyphError at RENDER time. Page 2 has an invalid size. With
    // the early validation, the size is checked before any render, so
    // InvalidPageSizeError comes out. Without it, page 1 renders first and the
    // glyph error comes out — the person fixes the emoji, runs again, and only
    // then discovers page 2.
    //
    // Without this pair of competing failures the test passed with and without
    // the fix, which made it decoration.
    const err = await rejection(
      generatePdf(
        {
          page: { width: 210, height: 297 },
          schemas: [],
          pages: [
            { id: "com-emoji", page: { width: 210, height: 297 }, schemas: [text("festa 🎉")] },
            { id: "torta", page: { width: 210, height: 0 }, schemas: [text("b")] },
          ],
        } as unknown as Template,
        {},
        []
      )
    );
    expect(err).toBeInstanceOf(InvalidPageSizeError);
    expect((err as InvalidPageSizeError).pageId).toBe("torta");
  });

  it("o consumidor recebe blame `template`, e não um genérico de bug do pacote", async () => {
    const err = await rejection(generatePdf({ schemas: [text("x")] } as unknown as Template, {}, []));
    const problem = describePdfError(err, dictFor("pt-BR"));
    // The entire point: it is NOT `null`. With the raw TypeError, it was.
    expect(problem).not.toBeNull();
    expect(problem?.code).toBe("invalidPageSize");
    expect(problem?.blame).toBe("template");
    expect(problem?.title).toBeTruthy();
  });

  it("PNG de fundo ilegível → BackgroundImageUnreadableError (e não a STRING crua do pako)", async () => {
    const t: Template = { page: A4, backgroundImage: "data:image/png;base64,AAAA", schemas: [text("x")] };
    const err = await rejection(generatePdf(t, {}, []));
    expect(err).toBeInstanceOf(BackgroundImageUnreadableError);
    expect((err as BackgroundImageUnreadableError).code).toBe("backgroundImageUnreadable");
    // pdf-lib/pako throws `"The input is not a PNG file!"` — a string, not an
    // Error. The caller's `err.message` gave `undefined`.
    expect((err as Error).message.length).toBeGreaterThan(0);
  });

  it("imagem em formato não suportado → UnsupportedImageFormatError nomeando o campo", async () => {
    const t: Template = { page: A4, schemas: [image("data:image/gif;base64,R0lGODlhAQABAAAAADs=", { name: "banner" })] };
    const err = await rejection(generatePdf(t, {}, []));
    expect(err).toBeInstanceOf(UnsupportedImageFormatError);
    const typed = err as UnsupportedImageFormatError;
    expect(typed.code).toBe("unsupportedImageFormat");
    expect(typed.field).toBe("banner");
  });

  it("imagem corrompida → ImageUnreadableError nomeando o campo", async () => {
    const t: Template = { page: A4, schemas: [image("data:image/png;base64,AAAA")] };
    const err = await rejection(generatePdf(t, {}, []));
    expect(err).toBeInstanceOf(ImageUnreadableError);
    expect((err as ImageUnreadableError).field).toBe("logo");
  });

  it("estouro do teto de páginas → PageLimitError com maxPages e o campo que paginava", async () => {
    const t: Template = {
      page: A4,
      schemas: [
        { id: "tb", name: "tabela_linhas", type: "table", x: 10, y: 20, width: 190, height: 20, head: ["Nome"], content: [] } as never,
      ],
    };
    const rows = Array.from({ length: 4000 }, (_, i) => ({ nome: `n${i}` }));
    const bindings = [{ schemaName: "tabela_linhas", type: "array" as const, path: "rows", columns: ["nome"] }];
    const err = await rejection(generatePdf(t, { rows }, bindings, { maxPages: 3 }));
    expect(err).toBeInstanceOf(PageLimitError);
    const typed = err as PageLimitError;
    expect(typed.code).toBe("pageLimit");
    expect(typed.maxPages).toBe(3);
    expect(typed.field).toBe("tabela_linhas");
    expect(typed.blame).toBe("data");
  });

  it("caractere sem glifo → UnsupportedGlyphError com campo, caractere e code point", async () => {
    const t: Template = { page: A4, schemas: [text("{nome}", { name: "cliente" })] };
    const err = await rejection(generatePdf(t, { nome: "Ana \u{1F389}" }, []));
    expect(err).toBeInstanceOf(UnsupportedGlyphError);
    const typed = err as UnsupportedGlyphError;
    expect(typed.code).toBe("unsupportedGlyph");
    expect(typed.field).toBe("cliente");
    expect(typed.char).toBe("\u{1F389}");
    // Pré-calculado: sem isso o consumidor reimplementaria codePointAt+padStart
    // pra mostrar o mesmo rótulo que a mensagem usa.
    expect(typed.codePoint).toBe("U+1F389");
  });

  it("WOFF2 que o descompressor recusa → FontDecompressFailedError", async () => {
    // Assinatura "wOF2" com corpo lixo: passa pelo detector e o
    // ConvertWOFF2ToTTF devolve `false`.
    const bytes = new Uint8Array(64);
    bytes.set([0x77, 0x4f, 0x46, 0x32], 0);
    const err = await rejection(normalizeFontBytes(bytes));
    expect(err).toBeInstanceOf(FontDecompressFailedError);
    const typed = err as FontDecompressFailedError;
    expect(typed.code).toBe("fontDecompressFailed");
    expect(typed.format).toBe("woff2");
    expect(typed.blame).toBe("config");
  }, 20000);

  it("upload acima do limite → ImageUploadTooLargeError com bytes e limite", async () => {
    // Só `size` e `type` são lidos antes do portão de tamanho — não precisa de
    // um arquivo de 20MB de verdade (nem de FileReader) pra testar o portão.
    const fake = { size: 999 * 1024 * 1024, type: "image/png" } as File;
    const err = await rejection(fileToBackgroundImage(fake));
    expect(err).toBeInstanceOf(ImageUploadTooLargeError);
    const typed = err as ImageUploadTooLargeError;
    expect(typed.code).toBe("imageUploadTooLarge");
    expect(typed.bytes).toBe(fake.size);
    expect(typed.limitBytes).toBeGreaterThan(0);
    expect(typed.bytes).toBeGreaterThan(typed.limitBytes);
  });

  it("template que não é objeto → TemplateNotAnObjectError com o tipo recebido", () => {
    const err = thrown(() => migrateTemplate([]));
    expect(err).toBeInstanceOf(TemplateNotAnObjectError);
    expect((err as TemplateNotAnObjectError).receivedType).toBe("array");
  });

  it("todas descendem de PdfGenerationError, e `isPdfError` reconhece", async () => {
    // A base comum é o que deixa um backend escrever UM `catch` que separa
    // "falha conhecida do pacote" de "qualquer outra coisa".
    const err = await rejection(generatePdf({ page: A4, schemas: [image("data:image/png;base64,AAAA")] }, {}, []));
    expect(err).toBeInstanceOf(PdfGenerationError);
    expect(err).toBeInstanceOf(Error);
    expect(isPdfError(err)).toBe(true);
    expect(isPdfError(new TypeError("alheio"))).toBe(false);
    expect(isPdfError(new ExpressionSyntaxError("incomplete", "{a+}", 3))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// O localizador
// ---------------------------------------------------------------------------

// Uma instância de CADA classe. É a base do guard de exaustividade abaixo: a
// chave é o `code`, e o teste compara as chaves daqui com PDF_ERROR_CODES.
const SAMPLES: Record<PdfErrorCode, AnyPdfError> = {
  pageLimit: new PageLimitError(5000, "tabela"),
  unsupportedGlyph: new UnsupportedGlyphError("cliente", "\u{1F389}", "Ana \u{1F389}"),
  invalidPageSize: new InvalidPageSizeError("pagina-1", NaN, 297),
  backgroundImageUnreadable: new BackgroundImageUnreadableError(),
  imageUploadTooLarge: new ImageUploadTooLargeError(30 * 1024 * 1024, 20 * 1024 * 1024),
  imageUploadUnreadable: new ImageUploadUnreadableError("decode"),
  imageTooLarge: new ImageTooLargeError("logo", 20 * 1024 * 1024, 15 * 1024 * 1024),
  tooManyImages: new TooManyImagesError(200),
  unsupportedImageFormat: new UnsupportedImageFormatError("banner"),
  imageUnreadable: new ImageUnreadableError("logo"),
  paginationStalled: new PaginationStalledError("tabela"),
  woff2SupportMissing: new Woff2SupportMissingError(),
  fontDecompressFailed: new FontDecompressFailedError("woff2"),
  fontDecompressTimeout: new FontDecompressTimeoutError("woff2", 8000),
  templateNotAnObject: new TemplateNotAnObjectError("array"),
  templateVersionInvalid: new TemplateVersionInvalidError("1", 1),
  templateVersionTooNew: new TemplateVersionTooNewError(99, 1),
  templateMigrationMissing: new TemplateMigrationMissingError(1, 2),
};

describe("describePdfError — texto de usuário final, localizado", () => {
  it("devolve null pro que não é erro nosso (o consumidor mostra o genérico dele)", () => {
    for (const alheio of [new TypeError("boom"), new Error("qualquer coisa"), "uma string", null, undefined, 42, {}]) {
      expect(describePdfError(alheio, en), JSON.stringify(String(alheio))).toBeNull();
    }
  });

  it("separa o que ACONTECEU do que FAZER (é assim que os examples renderizam)", () => {
    const p = describePdfError(SAMPLES.pageLimit, dictFor("pt-BR"));
    expect(p).not.toBeNull();
    expect(p!.title).toBe("O relatório passou de 5000 páginas");
    expect(p!.action).toContain("Filtre o dado antes de gerar");
    // `detail` é o `message` cru, em INGLÊS — a linha técnica, pra log e pra
    // um "detalhes" escondido na UI. Nunca a frase principal.
    expect(p!.detail).toContain("The document went past 5000 pages");
    expect(p!.field).toBe("tabela");
    expect(p!.blame).toBe("data");
  });

  it("o nome da aba na ação sai do MESMO dicionário que o editor usa", () => {
    // Duplicar o rótulo aqui mandaria a pessoa procurar uma aba com outro
    // nome do que ela vê na tela.
    expect(describePdfError(SAMPLES.invalidPageSize, ptBR)!.action).toContain(`"${ptBR.tabBar.page}"`);
    expect(describePdfError(SAMPLES.invalidPageSize, en)!.action).toContain(`"${en.tabBar.page}"`);
  });

  it("`field` só aparece quando o erro sabe qual campo é", () => {
    expect(describePdfError(SAMPLES.imageUnreadable, en)!.field).toBe("logo");
    // Fundo de página não é campo — e o localizador usa outro título.
    const fundo = describePdfError(new ImageTooLargeError(null, 20e6, 15e6), en)!;
    expect(fundo.field).toBeUndefined();
    expect(fundo.title).toContain("background");
    expect(describePdfError(SAMPLES.imageTooLarge, en)!.title).toContain('"logo"');
  });

  it("erro de expressão entra como code `expression`, reusando o localize() dele", () => {
    // A hierarquia de expressão já tinha localizador próprio; reimplementar
    // aqui daria duas frases pra mesma falha.
    const err = thrown(() => parse("CURRENCY(total"));
    const p = describePdfError(err, ptBR);
    expect(p).not.toBeNull();
    expect(p!.code).toBe("expression");
    expect(p!.blame).toBe("template");
    expect(p!.title).toBe("O template tem uma expressão inválida");
    expect(p!.action).toContain("Corrija a expressão no template");
    // O texto da falha de sintaxe, em pt-BR — não a versão inglesa do
    // `message`.
    expect(p!.action).toMatch(/posição/);
    expect(describePdfError(err, en)!.action).toMatch(/position/);
  });
});

// ---------------------------------------------------------------------------
// Exaustividade — o guard que importa
// ---------------------------------------------------------------------------

describe("exaustividade: nenhum code renderiza vazio", () => {
  it("SAMPLES cobre exatamente PDF_ERROR_CODES", () => {
    // Sem esta comparação, os testes abaixo passariam ignorando o code novo.
    expect(Object.keys(SAMPLES).sort()).toEqual([...PDF_ERROR_CODES].sort());
  });

  it("todo code tem entrada na seção `errors` dos DOIS dicionários", () => {
    for (const code of PDF_ERROR_CODES) {
      for (const [nome, dict] of [["en", en], ["pt-BR", ptBR]] as const) {
        expect(code in dict.errors, `o code "${code}" não tem entrada em ${nome}.errors — describePdfError renderizaria vazio`).toBe(true);
      }
    }
    // O caso extra, que não é PdfErrorCode mas o localizador também cobre.
    expect("expression" in en.errors).toBe(true);
    expect("expression" in ptBR.errors).toBe(true);
  });

  it("todo code produz título e ação NÃO VAZIOS, e diferentes entre en e pt-BR", () => {
    // Título vazio é o modo de falha real de um code novo: o `switch` compila,
    // a entrada do dicionário não existe (ou foi copiada do inglês) e a UI
    // mostra uma caixa em branco. As duas metades são checadas aqui.
    const semAcao: PdfProblemCode[] = [
      // "bug do pacote, reporte" — a ação já está no título, e não há nada que
      // quem chamou possa fazer com o dado ou o template.
      "paginationStalled",
      "templateMigrationMissing",
    ];

    for (const code of PDF_ERROR_CODES) {
      const emEn = describePdfError(SAMPLES[code], en);
      const emPt = describePdfError(SAMPLES[code], ptBR);
      expect(emEn, `describePdfError devolveu null pro code "${code}"`).not.toBeNull();
      expect(emPt).not.toBeNull();
      expect(emEn!.code, `o code do problema não bate com o da classe (${code})`).toBe(code);

      expect(emEn!.title.trim().length, `title vazio em en pro code "${code}"`).toBeGreaterThan(0);
      expect(emPt!.title.trim().length, `title vazio em pt-BR pro code "${code}"`).toBeGreaterThan(0);
      expect(emEn!.title, `en e pt-BR têm o MESMO title pro code "${code}" — entrada não traduzida?`).not.toBe(emPt!.title);

      if (semAcao.includes(code)) {
        expect(emEn!.action, `o code "${code}" ganhou ação — tire-o de semAcao`).toBeUndefined();
      } else {
        expect(emEn!.action?.trim().length, `action vazia em en pro code "${code}"`).toBeGreaterThan(0);
        expect(emPt!.action?.trim().length, `action vazia em pt-BR pro code "${code}"`).toBeGreaterThan(0);
        expect(emEn!.action, `en e pt-BR têm a MESMA action pro code "${code}"`).not.toBe(emPt!.action);
      }

      // `detail` é sempre o message cru.
      expect(emEn!.detail).toBe(SAMPLES[code].message);
    }
  });

  it("`name` de cada classe é o nome dela (é o que aparece no log e no Sentry)", () => {
    for (const code of PDF_ERROR_CODES) {
      const err = SAMPLES[code];
      expect(err.name, `${code}: name não foi setado no construtor`).toBe(err.constructor.name);
    }
  });
});

// ---------------------------------------------------------------------------
// "A mensagem é inglês"
// ---------------------------------------------------------------------------

// Acento é o proxy: as mensagens antigas eram todas em português, e nenhuma
// frase inglesa razoável carrega um. Um `throw` que voltar pro português cai
// aqui — o que este teste guarda é a decisão de o `message` ser diagnóstico de
// desenvolvedor (log/stack/Sentry grepáveis), não texto de usuário.
const ACENTUADO = /[\u00C0-\u024F\u1E00-\u1EFF]/;

describe("as mensagens LANÇADAS estão em inglês", () => {
  it("nenhuma string de src/errors.ts tem caractere acentuado", () => {
    // Todas as mensagens do pacote nascem aqui (os `super(...)` das classes),
    // então varrer este arquivo cobre o conjunto inteiro. Comentário é
    // removido antes: este repo comenta em português de propósito.
    const fonte = sourceFiles().find((f) => relativeToSrc(f) === "errors.ts");
    expect(fonte, "src/errors.ts não foi encontrado — a varredura mudou de base").toBeDefined();
    const ofensoras = stringLiterals(stripComments(readSource(fonte!)))
      .filter((l) => ACENTUADO.test(l.value))
      .map((l) => `linha ${l.line}: ${l.value.slice(0, 60)}`);
    expect(ofensoras, `mensagem de erro com acento — o \`message\` do pacote é inglês:\n  ${ofensoras.join("\n  ")}`).toEqual([]);
  });

  it("só os hooks de contexto constroem `new Error(...)` fora de errors.ts, e em inglês", () => {
    // As exceções DECLARADAS, e as duas são a MESMA exceção: "faltou o
    // <DesignerProvider> acima de você" é erro de COMPOSIÇÃO React, lido por
    // quem escreve o código. Não passa por describePdfError (não há nada pra
    // o usuário final fazer), então não ganhou classe — mas continua em
    // inglês, pela mesma razão das outras.
    //
    // `useDesignerZoom` mora em arquivo próprio (e não junto dos outros
    // hooks) porque o zoom tem contexto próprio, e porque a regra
    // `react(only-export-components)` do oxlint obriga o split — ver
    // designer/context/zoomContext.ts.
    const PERMITIDOS = ["designer/context/hooks.ts", "designer/context/useDesignerZoom.ts"];

    const comErrorSolto = sourceFiles()
      .filter((f) => relativeToSrc(f) !== "errors.ts")
      .filter((f) => /new Error\(/.test(stripComments(readSource(f))))
      .map(relativeToSrc)
      .sort();
    expect(
      comErrorSolto,
      `\`new Error(...)\` fora de src/errors.ts — toda falha deve ganhar CLASSE (ou entrar na lista de exceções, com o porquê):\n  ${comErrorSolto.join("\n  ")}`
    ).toEqual(PERMITIDOS);

    for (const rel of PERMITIDOS) {
      const fonte = sourceFiles().find((f) => relativeToSrc(f) === rel)!;
      const ofensoras = stringLiterals(stripComments(readSource(fonte)))
        .filter((l) => ACENTUADO.test(l.value))
        .map((l) => `${rel}:${l.line}`);
      expect(ofensoras, `mensagem com acento em ${rel}`).toEqual([]);
    }
  });
});

function readSource(file: string): string {
  return readFileSync(file, "utf8");
}
