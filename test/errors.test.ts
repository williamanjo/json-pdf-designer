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

// Os erros do pacote, nas duas metades do desenho:
//
//   1. CLASSE com `code` + dados estruturados, lançada pelo caminho REAL (um
//      template que estoura o limite, uma imagem em formato errado…) — é o que
//      substitui o `if (/frase em português/.test(err.message))` que os
//      examples faziam.
//   2. `describePdfError(err, t)` devolvendo texto de usuário final
//      localizado, e `null` pra erro que não é nosso.
//
// O teste que mais importa aqui é o de EXAUSTIVIDADE, no fim: sem ele, um code
// novo sem entrada no dicionário renderiza vazio e nada avisa.

const A4 = { width: 210, height: 297 };

function text(content: string, over: Record<string, unknown> = {}) {
  return { id: "t1", name: "titulo", type: "text", x: 10, y: 10, width: 100, height: 12, content, fontSize: 12, ...over } as never;
}

function image(content: string, over: Partial<ImageSchema> = {}): ImageSchema {
  return { id: "i1", name: "logo", type: "image", x: 10, y: 10, width: 40, height: 40, content, ...over };
}

// O erro com que `promise` rejeita. Afirmar sobre a CLASSE e os campos exige
// ter o objeto em mão — `rejects.toThrow(/.../)` só olha a frase, que é
// justamente o acoplamento que este desenho remove.
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
// As classes, pelo caminho real
// ---------------------------------------------------------------------------

describe("as classes de erro chegam pelo caminho real, com os dados estruturados", () => {
  it("tamanho de página não finito → InvalidPageSizeError com id, width e height", async () => {
    const err = await rejection(generatePdf({ page: { width: NaN, height: 297 }, schemas: [text("x")] }, {}, []));
    expect(err).toBeInstanceOf(InvalidPageSizeError);
    const typed = err as InvalidPageSizeError;
    expect(typed.code).toBe("invalidPageSize");
    expect(typed.blame).toBe("template");
    // O id da página-design. Sem `pages`, é a página implícita.
    expect(typeof typed.pageId).toBe("string");
    expect(Number.isNaN(typed.width)).toBe(true);
    expect(typed.height).toBe(297);
  });

  // O caso que o guard NÃO pegava, e o motivo de ele ter mudado de lugar.
  //
  // `assertFinitePageSize` vivia dentro do `renderLayoutPage`, que roda DEPOIS
  // do `layoutDocument`. E o layout lê o tamanho direto (`bodyLayout.ts` faz
  // `pageDef.page.height - footerHeight`), então template sem `page` estourava
  // `TypeError: Cannot read properties of undefined (reading 'height')` lá
  // dentro, antes de o guard existir na pilha.
  //
  // O que fazia isso valer uma correção não era a mensagem feia: um TypeError
  // não é erro NOSSO, então `describePdfError` devolve `null` e o consumidor
  // classifica a falha como `blame: "package"` — "não é culpa sua, reporte" —
  // quando o problema era o template dele. É exatamente a confusão que a
  // superfície de erro tipada existe pra acabar, e por isso o último caso
  // deste bloco checa o consumidor, e não só a classe.
  it("`page` AUSENTE → InvalidPageSizeError, não um TypeError do layout", async () => {
    // Template sem `page` nenhum: JSON editado à mão, arquivo salvo por outra
    // ferramenta, formato que a migração não cobriu.
    const err = await rejection(generatePdf({ schemas: [text("x")] } as unknown as Template, {}, []));
    expect(err).toBeInstanceOf(InvalidPageSizeError);
    expect((err as Error).constructor.name).not.toBe("TypeError");
    const typed = err as InvalidPageSizeError;
    expect(typed.blame).toBe("template");
    // Ausente vira NaN nos campos do erro — é o que a mensagem precisa dizer.
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
    // Guarda contra um "conserto" que coagisse a entrada: `Number("210")` é
    // 210 e passaria, e aí o valor seguiria como STRING pro resto da
    // geração. A coerção existe só pra preencher os campos do erro.
    const err = await rejection(
      generatePdf({ page: { width: "210", height: 297 }, schemas: [text("x")] } as unknown as Template, {}, [])
    );
    expect(err).toBeInstanceOf(InvalidPageSizeError);
  });

  it("página torta no meio de `pages` falha ANTES de renderizar as boas", async () => {
    // Este teste prova ORDEM, e o jeito de provar ordem é dar à página 1 uma
    // falha PRÓPRIA e ver qual das duas sai.
    //
    // Página 1 tem um emoji, que sem `fontBytes` dá UnsupportedGlyphError no
    // RENDER. Página 2 tem tamanho inválido. Com a validação antecipada, o
    // tamanho é conferido antes de qualquer render, então sai
    // InvalidPageSizeError. Sem ela, a página 1 renderiza primeiro e sai o
    // erro de glifo — a pessoa conserta o emoji, roda de novo, e só então
    // descobre a página 2.
    //
    // Sem este par de falhas concorrentes o teste passava com e sem o fix,
    // o que o tornava decoração.
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
    // O ponto inteiro: NÃO é `null`. Com o TypeError cru, era.
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
    // O pdf-lib/pako lança `"The input is not a PNG file!"` — uma string, não
    // um Error. `err.message` de quem chamava dava `undefined`.
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
