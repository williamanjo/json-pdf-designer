import { describe, expect, it } from "vitest";
import type { PDFFont, PDFPage } from "pdf-lib";
import { drawKpi } from "../../src/pdf/drawKpi";
import type { KpiSchema } from "../../src/types";

// drawKpi só chama drawText/drawSvgPath no `page` recebido — um objeto
// falso que só grava as chamadas é suficiente pra testar posição/presença
// de cada sub-elemento, sem precisar montar um PDFDocument de verdade
// (pdf-lib não expõe as coordenadas desenhadas de volta a partir dos
// bytes gerados, ver nota da sessão sobre extração de texto de PDF).
function makeFakePage() {
  const texts: { text: string; x: number; y: number; size: number }[] = [];
  const paths: { x: number; y: number }[] = [];
  const page = {
    drawText: (text: string, opts: { x: number; y: number; size: number }) => {
      texts.push({ text, x: opts.x, y: opts.y, size: opts.size });
    },
    drawSvgPath: (_path: string, opts: { x: number; y: number }) => {
      paths.push({ x: opts.x, y: opts.y });
    },
  };
  return { page: page as unknown as PDFPage, texts, paths };
}

// Nunca trunca (largura 0 de "cabe sempre") — o texto exato desenhado não
// é o que estes testes verificam, só posição/presença.
const fakeFont = { widthOfTextAtSize: () => 0 } as unknown as PDFFont;

const MM_TO_PT = 72 / 25.4;
const PADDING_PT = 8; // mesmo valor de PADDING_PT em src/pdf/drawKpi.ts
const TITLE_SIZE = 8; // DEFAULT_KPI_TITLE_FONT_SIZE

function baseSchema(overrides: Partial<KpiSchema> = {}): KpiSchema {
  return {
    id: "k1",
    name: "kpi1",
    type: "kpi",
    x: 0,
    y: 0,
    width: 55,
    height: 35,
    icon: "bar_chart",
    title: "Title",
    value: "42",
    subtitle: "Caption",
    backgroundColor: "#2563eb",
    textColor: "#ffffff",
    ...overrides,
  };
}

describe("drawKpi", () => {
  it("sem offset customizado: desenha título/ícone/valor/legenda na posição de sempre (regressão)", () => {
    const { page, texts, paths } = makeFakePage();
    const schema = baseSchema();
    drawKpi(page, fakeFont, schema, "TITLE", "42", "Caption", 0, 0, 156, 99);

    // fundo do card + ícone = 2 drawSvgPath
    expect(paths.length).toBe(2);
    // título + valor + legenda = 3 drawText (nessa ordem)
    expect(texts.length).toBe(3);
    const [title, value, subtitle] = texts;
    expect(title.x).toBeCloseTo(PADDING_PT);
    expect(title.y).toBeCloseTo(99 - PADDING_PT - TITLE_SIZE);
    expect(value.text).toBe("42");
    expect(subtitle.x).toBeCloseTo(PADDING_PT);
    expect(subtitle.y).toBeCloseTo(PADDING_PT);
  });

  it("título ausente (undefined) não desenha nada de título — só valor+legenda", () => {
    const { texts, page } = makeFakePage();
    const schema = baseSchema({ title: undefined });
    drawKpi(page, fakeFont, schema, undefined, "42", "Caption", 0, 0, 156, 99);
    expect(texts.length).toBe(2);
    expect(texts.some((t) => t.text.includes("TITLE"))).toBe(false);
  });

  it("ícone 'none' não desenha o ícone — só o fundo do card", () => {
    const { paths, page } = makeFakePage();
    const schema = baseSchema({ icon: "none" });
    drawKpi(page, fakeFont, schema, "TITLE", "42", "Caption", 0, 0, 156, 99);
    expect(paths.length).toBe(1);
  });

  it("titleOffset customizado desenha o título na posição esperada (mm convertido pra pt)", () => {
    const { texts, page } = makeFakePage();
    const schema = baseSchema({ titleOffset: { x: 10, y: 5 } });
    drawKpi(page, fakeFont, schema, "TITLE", "42", "Caption", 0, 0, 156, 99);
    const expectedX = 10 * MM_TO_PT;
    const expectedY = 99 - 5 * MM_TO_PT - TITLE_SIZE;
    expect(texts[0].x).toBeCloseTo(expectedX, 1);
    expect(texts[0].y).toBeCloseTo(expectedY, 1);
  });
});
