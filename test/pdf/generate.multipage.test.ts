import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generatePdf } from "../../src/pdf/generate";
import type { Binding, TableSchema, Template, TextSchema } from "../../src/types";

async function loadPageSizes(bytes: Uint8Array): Promise<[number, number][]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())]);
}

describe("generatePdf — multi-página (Template.pages)", () => {
  it("soma as páginas físicas de cada página-design (contínuo, não reinicia)", async () => {
    // Página 1: tabela grande o bastante pra quebrar em 2 páginas físicas
    // (mesmo cenário do teste de paginação de 1 página já existente).
    const bigTable: TableSchema = {
      id: "t1",
      name: "tabela",
      type: "table",
      x: 10,
      y: 20,
      width: 190,
      height: 50,
      head: ["A", "B"],
      content: Array.from({ length: 60 }, (_, i) => [String(i), String(i * 2)]),
    };
    // Página 2: design totalmente diferente (página A5, campo de texto só).
    const label: TextSchema = {
      id: "txt1",
      name: "rotulo",
      type: "text",
      x: 10,
      y: 10,
      width: 100,
      height: 15,
      content: "Resumo",
      fontSize: 12,
      fontColor: "#000000",
      alignment: "left",
    };

    const template: Template = {
      // Campos flat de topo viram irrelevantes quando `pages` existe.
      page: { width: 210, height: 297 },
      schemas: [],
      pages: [
        { id: "p1", page: { width: 210, height: 297 }, schemas: [bigTable] },
        { id: "p2", page: { width: 148, height: 210 }, schemas: [label] },
      ],
    };

    const bytes = await generatePdf(template, {}, []);
    const sizes = await loadPageSizes(bytes);

    // Página-design 1 (A4) quebrou em >1 página física; a última página
    // física pertence à página-design 2 (A5) — tamanhos diferentes provam
    // que os dois designs foram desenhados no MESMO documento, em sequência.
    expect(sizes.length).toBeGreaterThan(2);
    const a5WidthPt = Math.round((148 * 72) / 25.4);
    expect(sizes[sizes.length - 1][0]).toBe(a5WidthPt);
    expect(sizes[0][0]).not.toBe(a5WidthPt);
  });

  it("Template sem `pages` continua produzindo a mesma contagem/tamanho de página de sempre", async () => {
    const table: TableSchema = {
      id: "t1",
      name: "tabela",
      type: "table",
      x: 10,
      y: 20,
      width: 190,
      height: 50,
      head: ["A", "B"],
      content: [
        ["1", "2"],
        ["3", "4"],
      ],
    };
    const flatTemplate: Template = { page: { width: 210, height: 297 }, schemas: [table] };
    const wrappedTemplate: Template = {
      page: { width: 210, height: 297 },
      schemas: [],
      pages: [{ id: "single", page: { width: 210, height: 297 }, schemas: [table] }],
    };
    const bindings: Binding[] = [];

    const flatSizes = await loadPageSizes(await generatePdf(flatTemplate, {}, bindings));
    const wrappedSizes = await loadPageSizes(await generatePdf(wrappedTemplate, {}, bindings));
    expect(wrappedSizes).toEqual(flatSizes);
  });
});
