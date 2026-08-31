import { describe, expect, it } from "vitest";
import type { PDFDocument, PDFFont, PDFImage, PDFPage } from "pdf-lib";
import { buildBodyItems, drawFieldOfType, type DrawFieldContext } from "../../src/pdf/generate";
import type { TableSchema, TextSchema } from "../../src/types";

// buildBodyItems é pura (sem pdf-lib) — cobre só o agrupamento em BodyItem,
// não redesenha nada. Ver generate.pagination.test.ts/generate.multipage.
// test.ts pra paginação/render de ponta a ponta (não duplicado aqui).
function textField(overrides: Partial<TextSchema> = {}): TextSchema {
  return {
    id: overrides.id ?? "t",
    name: overrides.name ?? "campo",
    type: "text",
    x: 0,
    y: 10,
    width: 50,
    height: 8,
    content: "x",
    fontSize: 10,
    fontColor: "#000000",
    alignment: "left",
    ...overrides,
  };
}

function tableField(overrides: Partial<TableSchema> = {}): TableSchema {
  return {
    id: overrides.id ?? "tab",
    name: overrides.name ?? "tabela",
    type: "table",
    x: 0,
    y: 10,
    width: 100,
    height: 20,
    head: ["A"],
    content: [["1"]],
    ...overrides,
  };
}

describe("buildBodyItems", () => {
  it("dois campos de texto com o MESMO y viram uma única row (preserva X de cada um)", () => {
    const a = textField({ id: "a", name: "a", x: 0, y: 10, width: 40, height: 8 });
    const b = textField({ id: "b", name: "b", x: 60, y: 10, width: 40, height: 6 });

    const items = buildBodyItems([a, b]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "row", y: 10 });
    if (items[0].kind !== "row") throw new Error("esperava row");
    expect(items[0].schemas).toEqual([a, b]);
    // Altura da row é o máximo entre os membros, não a soma.
    expect(items[0].height).toBe(8);
  });

  it("campo de tabela nunca funde com irmãos, mesmo no MESMO y — vira item próprio", () => {
    const a = textField({ id: "a", name: "a", x: 0, y: 10, width: 40, height: 8 });
    const table = tableField({ id: "tab", name: "tabela", x: 60, y: 10, width: 100, height: 20 });
    const b = textField({ id: "b", name: "b", x: 0, y: 30, width: 40, height: 8 });

    const items = buildBodyItems([a, table, b]);

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ kind: "row", y: 10 });
    expect(items[1]).toEqual({ kind: "table", schema: table });
    expect(items[2]).toMatchObject({ kind: "row", y: 30 });
  });

  it("duas tabelas no mesmo y viram dois itens de tabela distintos (nunca uma row)", () => {
    const t1 = tableField({ id: "t1", name: "t1", y: 10 });
    const t2 = tableField({ id: "t2", name: "t2", y: 10 });

    const items = buildBodyItems([t1, t2]);

    expect(items).toEqual([
      { kind: "table", schema: t1 },
      { kind: "table", schema: t2 },
    ]);
  });
});

// drawFieldOfType — mesma técnica de fake-page-spy de drawTable.test.ts/
// drawKpi.test.ts, sem montar um PDFDocument de verdade. Cobre só o caso
// "text": os outros tipos (image/table/chart/kpi) já dependem de mais peça
// (pdf-lib de verdade pra embedPng/embedJpg, ou funções de bindings.ts) —
// exercitados de ponta a ponta pelos testes de generate.*.test.ts
// existentes, não duplicado aqui.
function makeFakePage() {
  const texts: { text: string; x: number; y: number; size: number }[] = [];
  const rects: { x: number; y: number; width: number; height: number }[] = [];
  const page = {
    drawText: (text: string, opts: { x: number; y: number; size: number }) => {
      texts.push({ text, x: opts.x, y: opts.y, size: opts.size });
    },
    drawRectangle: (opts: { x: number; y: number; width: number; height: number }) => {
      rects.push(opts);
    },
  };
  return { page: page as unknown as PDFPage, texts, rects };
}

const fakeFont = { widthOfTextAtSize: (text: string) => text.length * 5 } as unknown as PDFFont;

function makeFieldCtx(overrides: Partial<DrawFieldContext> = {}): DrawFieldContext {
  return {
    // Nunca chamado pro schema.type "text" (só usado por drawImageField) —
    // um objeto vazio basta, cast pro tipo esperado.
    doc: {} as PDFDocument,
    font: fakeFont,
    pageHeightPt: 297 * (72 / 25.4),
    imageCache: new Map<string, PDFImage>(),
    bindings: [],
    data: {},
    inputs: {},
    ...overrides,
  };
}

describe("drawFieldOfType", () => {
  it("campo de texto: desenha na posição esperada (mesmo cálculo de x/y/alinhamento de sempre)", async () => {
    const { page, texts, rects } = makeFakePage();
    const ctx = makeFieldCtx();
    const schema = textField({ x: 10, y: 20, width: 50, height: 8, fontSize: 10, alignment: "left" });

    await drawFieldOfType(ctx, page, schema, "Olá");

    expect(texts).toHaveLength(1);
    expect(texts[0].text).toBe("Olá");
    // Sem fundo/borda no schema => nenhum retângulo desenhado.
    expect(rects).toHaveLength(0);
  });

  it("campo de texto alinhado à direita: aplica o offset de alignX (mesma fórmula, paddingPt=0)", async () => {
    const { page, texts } = makeFakePage();
    const ctx = makeFieldCtx();
    const MM_TO_PT = 72 / 25.4;
    const widthMm = 50;
    const schema = textField({ x: 0, y: 0, width: widthMm, height: 8, fontSize: 10, alignment: "right", content: "abc" });

    await drawFieldOfType(ctx, page, schema, undefined);

    const widthPt = widthMm * MM_TO_PT;
    const textWidth = fakeFont.widthOfTextAtSize("abc", 10);
    expect(texts[0].x).toBeCloseTo(Math.max(0, widthPt - textWidth), 5);
  });
});
