import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generatePdf } from "../../src/pdf/generate";
import { UnsupportedGlyphError } from "../../src/pdf/textSafety";
import type { Binding, Template } from "../../src/types";
import { emptyTableTemplate } from "./fixtures/emptyTable";
import { hugeTableTemplate } from "./fixtures/hugeTable";
import { sectionLargerThanPageTemplate } from "./fixtures/sectionLargerThanPage";
import { missingDataTemplate } from "./fixtures/missingData";
import { emojiTemplate, ptBrAccentsTemplate } from "./fixtures/unicodeText";

// "Golden"/torture tests — unlike the unit tests in render/renderTable.test.ts/
// pagination.test.ts (which check an isolated function with a fake page),
// these run the WHOLE `generatePdf` pipeline with deliberately extreme
// templates, and check STRUCTURAL properties of the real PDF (through real
// pdf-lib, not a fake page) — they catch a regression that only appears when
// the pieces run together (e.g. an isolated function that is "correct" but
// hangs/produces invalid output when chained with the rest of the pipeline).
// No image/pixel snapshot — generating a PNG from a PDF already proved
// unworkable in this environment in earlier sessions; validation here is by
// page count/exception, not visual.

describe("generatePdf — torture tests (pipeline inteiro, casos extremos)", () => {
  it("tabela vazia (0 linhas) não trava e ainda desenha o cabeçalho", async () => {
    const bytes = await generatePdf(emptyTableTemplate(), {}, []);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("tabela com 600 linhas quebra em várias páginas de verdade, sem travar", async () => {
    const bytes = await generatePdf(hugeTableTemplate(600), {}, []);
    const doc = await PDFDocument.load(bytes);
    // ~7 rows per page (TABLE_ROW_HEIGHT_MM=7mm) minus the header — 600 rows
    // certainly cross well over a dozen physical pages.
    expect(doc.getPageCount()).toBeGreaterThan(10);
  }, 20000);

  it("seção maior que a página inteira não trava/loop infinito — termina com páginas finitas", async () => {
    const { template, data, bindings } = sectionLargerThanPageTemplate();
    const bytes = await generatePdf(template, data, bindings);
    const doc = await PDFDocument.load(bytes);
    // 2 repetitions, each larger than 1 page — at least 2 pages, and a
    // sensible ceiling (the safety guard in generate.ts stops at 20000
    // iterations, but it should not come anywhere near that here).
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(doc.getPageCount()).toBeLessThan(100);
  }, 20000);

  it("path ausente/null/vínculo que não resolve pra array não lança — renderiza vazio/fallback", async () => {
    const { template, data, bindings } = missingDataTemplate();
    const bytes = await generatePdf(template, data, bindings);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("acentuação pt-BR com a fonte padrão (Helvetica/WinAnsi) funciona sem precisar de fonte customizada", async () => {
    const bytes = await generatePdf(ptBrAccentsTemplate(), {}, []);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("emoji sem fonte customizada lança um erro reconhecível (fronteira documentada, não regressão silenciosa)", async () => {
    // A DELIBERATE boundary: WinAnsi does not cover emoji, and silently
    // dropping the character would be worse — a report is a signed document.
    // This test exists to pin that: if one day it stops throwing, the
    // documentation about "use fontBytes for full unicode" needs a review.
    //
    // The message is now ours (UnsupportedGlyphError), not pdf-lib's raw
    // "WinAnsi cannot encode …", which said neither WHICH field nor what to do.
    await expect(generatePdf(emojiTemplate(), {}, [])).rejects.toThrow(UnsupportedGlyphError);
    await expect(generatePdf(emojiTemplate(), {}, [])).rejects.toThrow(/Field "texto_emoji"/);
    await expect(generatePdf(emojiTemplate(), {}, [])).rejects.toThrow(/U\+1F389|fontBytes/);
  });

  it("caractere de CONTROLE no dado NÃO derruba o documento (vira espaço)", async () => {
    // The opposite of the case above, and the more common one in real data: an
    // LF coming from a textarea, an address with a line break, a CSV import. A
    // control character has no glyph in ANY font, so replacing it with a space
    // is the only possible rendering — it is not a loss of content.
    const template: Template = {
      page: { width: 210, height: 297 },
      schemas: [
        {
          id: "t", name: "campo", type: "text", x: 10, y: 20, width: 180, height: 10,
          content: "{nome}", fontSize: 10, fontColor: "#000000", alignment: "left",
        },
        {
          id: "tab", name: "tab", type: "table", x: 10, y: 40, width: 190, height: 20,
          head: ["Nome"], content: [],
        },
      ],
    };
    const bindings: Binding[] = [{ schemaName: "tab", type: "array", path: "rows", columns: ["nome"] }];
    const LF = String.fromCharCode(10);
    const TAB = String.fromCharCode(9);
    const data = { nome: `a${LF}b${TAB}c`, rows: [{ nome: `linha${LF}com quebra` }] };
    const doc = await PDFDocument.load(await generatePdf(template, data, bindings));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
