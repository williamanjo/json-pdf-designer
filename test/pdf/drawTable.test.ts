import { describe, expect, it } from "vitest";
import type { PDFFont, PDFPage } from "pdf-lib";
import { drawTableSlice } from "../../src/pdf/drawTable";
import type { TableSchema } from "../../src/types";

// drawTableSlice só chama drawText/drawRectangle/drawSvgPath no `page`
// recebido — um objeto falso que só grava as chamadas é suficiente pra
// testar posição/presença sem montar um PDFDocument de verdade (mesma
// técnica já usada em test/pdf/drawKpi.test.ts).
function makeFakePage() {
  const texts: { text: string; x: number; y: number; size: number }[] = [];
  const rects: { x: number; y: number; width: number; height: number; borderColor?: unknown }[] = [];
  const paths: { x: number; y: number; borderColor?: unknown; borderWidth?: number }[] = [];
  const lines: { x1: number; y1: number; x2: number; y2: number; color?: unknown }[] = [];
  const page = {
    drawText: (text: string, opts: { x: number; y: number; size: number }) => {
      texts.push({ text, x: opts.x, y: opts.y, size: opts.size });
    },
    drawRectangle: (opts: { x: number; y: number; width: number; height: number; borderColor?: unknown }) => {
      rects.push({ x: opts.x, y: opts.y, width: opts.width, height: opts.height, borderColor: opts.borderColor });
    },
    drawSvgPath: (_path: string, opts: { x: number; y: number; borderColor?: unknown; borderWidth?: number }) => {
      paths.push({ x: opts.x, y: opts.y, borderColor: opts.borderColor, borderWidth: opts.borderWidth });
    },
    drawLine: (opts: { start: { x: number; y: number }; end: { x: number; y: number }; color?: unknown }) => {
      lines.push({ x1: opts.start.x, y1: opts.start.y, x2: opts.end.x, y2: opts.end.y, color: opts.color });
    },
  };
  return { page: page as unknown as PDFPage, texts, rects, paths, lines };
}

// Largura 0 pra qualquer texto — simplifica a conta de alinhamento (não é
// o texto real desenhado que estes testes verificam, só posição).
const fakeFont = { widthOfTextAtSize: () => 0 } as unknown as PDFFont;

const MM_TO_PT = 72 / 25.4;
const CELL_PADDING_PT = 1.5 * MM_TO_PT;

function baseSchema(overrides: Partial<TableSchema> = {}): TableSchema {
  return {
    id: "t1",
    name: "table1",
    type: "table",
    x: 0,
    y: 0,
    width: 100,
    height: 30,
    head: ["A", "B"],
    content: [["1", "2"]],
    ...overrides,
  };
}

describe("drawTableSlice", () => {
  it("sem nenhum campo novo: 1 retângulo de fundo por linha (head sem fundo próprio, valor sem fundo) + célula à esquerda (regressão)", () => {
    const { page, texts, rects, paths } = makeFakePage();
    const schema = baseSchema();
    drawTableSlice(page, fakeFont, schema, schema.content, 0, 100, 200);
    // head: 1 retângulo de fundo (linha toda) + 2 bordas de célula = 3
    // body: sem bodyBackgroundColor -> só as 2 bordas de célula
    expect(paths.length).toBe(0); // sem borderRadius nenhum, nunca usa drawSvgPath
    expect(rects.length).toBe(1 /* fundo head */ + 2 /* bordas head */ + 2 /* bordas body */);
    // texto da célula head[0] alinhado à esquerda: x = 0 (col 0) + padding
    expect(texts[0].x).toBeCloseTo(CELL_PADDING_PT);
  });

  it("borderColor do schema substitui o cinza padrão nas bordas retas E na moldura arredondada", () => {
    const { page: defaultPage, rects: defaultRects } = makeFakePage();
    drawTableSlice(defaultPage, fakeFont, baseSchema(), baseSchema().content, 0, 100, 200);
    const defaultBorders = defaultRects.filter((r) => r.borderColor);
    const defaultColor = defaultBorders[0].borderColor;

    const { page, rects } = makeFakePage();
    const schema = baseSchema({ borderColor: "#ff0000" });
    drawTableSlice(page, fakeFont, schema, schema.content, 0, 100, 200);
    // toda borda reta (célula por célula, já que não tem canto arredondado)
    // usa a MESMA cor resolvida do schema, não mais a constante cinza fixa —
    // o único rect SEM borderColor é o fundo do cabeçalho (fill, sem borda).
    const borders = rects.filter((r) => r.borderColor);
    expect(borders.length).toBe(4); // 2 células do head + 2 do body
    borders.forEach((r) => expect(r.borderColor).toEqual({ type: "RGB", red: 1, green: 0, blue: 0 }));
    expect(borders[0].borderColor).not.toEqual(defaultColor);

    // com arredondamento, a borda também sai vermelha — no `drawSvgPath`
    // (moldura) e no divisor interno entre colunas (`drawLine`).
    const { page: roundedPage, paths, lines } = makeFakePage();
    const roundedSchema = baseSchema({ borderColor: "#ff0000", headBorderRadius: { topLeft: 3, topRight: 3 } });
    drawTableSlice(roundedPage, fakeFont, roundedSchema, roundedSchema.content, 0, 100, 200);
    expect(paths.length).toBe(1);
    expect(paths[0].borderColor).toEqual({ type: "RGB", red: 1, green: 0, blue: 0 });
    expect(lines.length).toBe(1);
    expect(lines[0].color).toEqual({ type: "RGB", red: 1, green: 0, blue: 0 });
  });

  it("columnWidths explícito muda o X da coluna seguinte", () => {
    const { page, texts } = makeFakePage();
    const schema = baseSchema({ columnWidths: [30, undefined] }); // col 0 = 30mm, col 1 = resto
    drawTableSlice(page, fakeFont, schema, schema.content, 0, 100, 200);
    // texto da head[1] começa em x = 30mm (convertido pt) + padding
    const expectedX = 30 * MM_TO_PT + CELL_PADDING_PT;
    expect(texts[1].x).toBeCloseTo(expectedX, 1);
  });

  it("headAlign 'right' desloca o X do texto do cabeçalho pra direita (comparado ao default)", () => {
    const { page, texts } = makeFakePage();
    const defaultSchema = baseSchema();
    drawTableSlice(page, fakeFont, defaultSchema, defaultSchema.content, 0, 100, 200);
    const defaultX = texts[0].x;

    const { page: page2, texts: texts2 } = makeFakePage();
    const rightSchema = baseSchema({ headAlign: "right" });
    drawTableSlice(page2, fakeFont, rightSchema, rightSchema.content, 0, 100, 200);
    expect(texts2[0].x).toBeGreaterThan(defaultX);
  });

  it("headBorderRadius definido desenha o fundo do cabeçalho via drawSvgPath (arredondado), com a borda embutida no mesmo path (não redesenha borda reta por cima)", () => {
    const { page, paths, rects, lines } = makeFakePage();
    const schema = baseSchema({ headBorderRadius: { topLeft: 3, topRight: 3 } });
    drawTableSlice(page, fakeFont, schema, schema.content, 0, 100, 200);
    expect(paths.length).toBe(1);
    expect(paths[0].borderColor).toBeDefined();
    expect(paths[0].borderWidth).toBe(0.5);
    // linha do cabeçalho (arredondada): sem retângulo de borda por célula,
    // só o divisor interno entre as 2 colunas (1 linha reta)
    expect(rects.length).toBe(2 /* bordas do body (não arredondado) */);
    expect(lines.length).toBe(1);
  });

  it("bodyBorderRadius só arredonda a última linha da última fatia (isLastSlice)", () => {
    // precisa de uma cor de fundo pro corpo pra ter ALGO a arredondar —
    // sem bodyBackgroundColor não há preenchimento nenhum (nem retângulo
    // reto, nem arredondado).
    const schema = baseSchema({ bodyBackgroundColor: "#ffffff", bodyBorderRadius: { bottomLeft: 3, bottomRight: 3 } });
    const { page: notLast, paths: pathsNotLast } = makeFakePage();
    drawTableSlice(notLast, fakeFont, schema, schema.content, 0, 100, 200, true, undefined, false);
    expect(pathsNotLast.length).toBe(0);

    const { page: last, paths: pathsLast } = makeFakePage();
    drawTableSlice(last, fakeFont, schema, schema.content, 0, 100, 200, true, undefined, true);
    expect(pathsLast.length).toBe(1);
    expect(pathsLast[0].borderColor).toBeDefined();
    expect(pathsLast[0].borderWidth).toBe(0.5);
  });

  it("footer com footerBorderRadius arredonda o fundo do rodapé, com a borda embutida no path arredondado", () => {
    const { page, paths } = makeFakePage();
    const schema = baseSchema({ footerBorderRadius: { bottomLeft: 3, bottomRight: 3 }, footer: ["Total", "3"] });
    drawTableSlice(page, fakeFont, schema, schema.content, 0, 100, 200, true, schema.footer);
    expect(paths.length).toBe(1);
    expect(paths[0].borderColor).toBeDefined();
    expect(paths[0].borderWidth).toBe(0.5);
  });
});
