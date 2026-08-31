import { describe, expect, it } from "vitest";
import type { PDFFont, PDFPage } from "pdf-lib";
import { drawChart } from "../../../src/pdf/render/renderChart";
import type { ChartSchema } from "../../../src/types";
import type { ChartItem } from "../../../src/bindings/bindings";

// drawChart só chama drawText/drawRectangle/drawSvgPath no `page` recebido
// — mesma técnica de fake-page-spy já usada em renderKpi.test.ts/
// renderTable.test.ts: um objeto falso que só grava as chamadas, sem montar
// um PDFDocument de verdade.
function makeFakePage() {
  const texts: { text: string; x: number; y: number; size: number }[] = [];
  const rects: { x: number; y: number; width: number; height: number }[] = [];
  const paths: { x: number; y: number }[] = [];
  const page = {
    drawText: (text: string, opts: { x: number; y: number; size: number }) => {
      texts.push({ text, x: opts.x, y: opts.y, size: opts.size });
    },
    drawRectangle: (opts: { x: number; y: number; width: number; height: number }) => {
      rects.push({ x: opts.x, y: opts.y, width: opts.width, height: opts.height });
    },
    drawSvgPath: (_path: string, opts: { x: number; y: number }) => {
      paths.push({ x: opts.x, y: opts.y });
    },
  };
  return { page: page as unknown as PDFPage, texts, rects, paths };
}

// Largura 0 pra qualquer texto — simplifica a conta de posição (não é o
// texto exato desenhado que estes testes verificam, só presença/posição).
const fakeFont = { widthOfTextAtSize: () => 0 } as unknown as PDFFont;

function baseSchema(overrides: Partial<ChartSchema> = {}): ChartSchema {
  return {
    id: "c1",
    name: "chart1",
    type: "chart",
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    chartType: "pie",
    displayMode: "number",
    ...overrides,
  };
}

function items(n: number): ChartItem[] {
  return Array.from({ length: n }, (_, i) => ({ label: `Item ${i}`, value: (i + 1) * 10, color: "#336699" }));
}

describe("drawChart", () => {
  it("gráfico de barra: desenha 1 par rótulo+valor por item", () => {
    const { page, texts } = makeFakePage();
    const schema = baseSchema({ chartType: "bar" });
    const data = items(3);
    const total = data.reduce((s, it) => s + it.value, 0);
    drawChart(page, fakeFont, schema, data, total, 0, 200, 156, 99);

    // cada item: 1 texto de rótulo + 1 texto de valor = 2 * items.length
    expect(texts.length).toBe(data.length * 2);
    expect(texts[0].text).toBe("Item 0");
    expect(texts[1].text).toContain("10");
  });

  it('pizza com legendPosition "right": 1 swatch de legenda por item', () => {
    const { page, rects } = makeFakePage();
    const schema = baseSchema({ legendPosition: "right" });
    const data = items(4);
    const total = data.reduce((s, it) => s + it.value, 0);
    drawChart(page, fakeFont, schema, data, total, 0, 200, 156, 99);

    // drawLegend desenha 1 drawRectangle (swatch) por item, nada mais usa
    // drawRectangle em render/renderChart.ts.
    expect(rects.length).toBe(data.length);
  });

  it("items.length === 0 não desenha nada (early return)", () => {
    const { page, texts, rects, paths } = makeFakePage();
    const schema = baseSchema();
    drawChart(page, fakeFont, schema, [], 0, 0, 200, 156, 99);

    expect(texts.length).toBe(0);
    expect(rects.length).toBe(0);
    expect(paths.length).toBe(0);
  });

  it('legendPosition "slices": desenha rótulo em cima de cada fatia, sem bloco de legenda separado', () => {
    const { page, texts, rects, paths } = makeFakePage();
    const schema = baseSchema({ legendPosition: "slices" });
    const data = items(3);
    const total = data.reduce((s, it) => s + it.value, 0);
    drawChart(page, fakeFont, schema, data, total, 0, 200, 156, 99);

    // 1 drawSvgPath por fatia (o path da própria fatia)
    expect(paths.length).toBe(data.length);
    // rótulo direto em cima da fatia = drawText, mas SEM nenhum
    // drawRectangle (drawLegend não é chamado quando legendPosition é
    // "slices" — não há swatch de legenda nenhum).
    expect(texts.length).toBe(data.length);
    expect(rects.length).toBe(0);
  });
});
