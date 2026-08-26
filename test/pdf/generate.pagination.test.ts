import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generatePdf } from "../../src/pdf/generate";
import type { Binding, SectionSchema, TableSchema, Template } from "../../src/types";

async function pageCount(template: Template, data: unknown, bindings: Binding[]): Promise<number> {
  const bytes = await generatePdf(template, data, bindings);
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

describe("generatePdf — paginação (caracterização do comportamento atual)", () => {
  it("tabela solta com poucas linhas cabe em 1 página", () => {
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
    const template: Template = { page: { width: 210, height: 297 }, schemas: [table] };
    return pageCount(template, {}, []).then((n) => expect(n).toBe(1));
  });

  it("tabela solta com muitas linhas quebra em várias páginas", async () => {
    const content = Array.from({ length: 60 }, (_, i) => [String(i), String(i * 2)]);
    const table: TableSchema = {
      id: "t1",
      name: "tabela",
      type: "table",
      x: 10,
      y: 20,
      width: 190,
      height: 50,
      head: ["A", "B"],
      content,
    };
    const template: Template = { page: { width: 210, height: 297 }, schemas: [table] };
    const n = await pageCount(template, {}, []);
    expect(n).toBeGreaterThan(1);
  });

  it("seção mestre-detalhe: item com mais linhas empurra o resto e pode quebrar página", async () => {
    const section: SectionSchema = {
      id: "s1",
      name: "secao",
      type: "section",
      x: 10,
      y: 10,
      width: 190,
      height: 10,
    };
    const member: TableSchema = {
      id: "m1",
      name: "itensTable",
      type: "table",
      x: 10,
      y: 12,
      width: 190,
      height: 7,
      head: ["Produto"],
      content: [["item"]],
      sectionId: "s1",
    };
    const template: Template = { page: { width: 210, height: 45 }, schemas: [section, member] };
    const data = {
      pedidos: [
        { itens: [{ produto: "a" }, { produto: "b" }, { produto: "c" }] },
        { itens: [{ produto: "x" }] },
      ],
    };
    const bindings: Binding[] = [
      { schemaName: "secao", type: "section", path: "pedidos" },
      { schemaName: "itensTable", type: "array", path: "itens", columns: ["produto"] },
    ];
    const n = await pageCount(template, data, bindings);
    expect(n).toBe(2);
  });
});
