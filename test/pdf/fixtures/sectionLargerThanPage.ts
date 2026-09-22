import type { Binding, Template } from "../../../src/types";

// A repeated section whose AUTHORED HEIGHT alone (before any growth from a
// master-detail table) is already larger than the available body of a whole A4
// page — it tests that `generatePdf` does not hang or enter an infinite
// empty-page loop when a single item does not physically fit on a page (the
// safety guard lives in generate.ts; this tests the whole pipeline, not only
// the isolated function).
export function sectionLargerThanPageTemplate(): { template: Template; data: unknown; bindings: Binding[] } {
  const sectionId = "sec1";
  const template: Template = {
    page: { width: 210, height: 297 },
    schemas: [
      {
        id: sectionId,
        name: "secao_gigante",
        type: "section",
        x: 10,
        y: 10,
        width: 190,
        // Larger than the whole sheet (297mm) — it does not fit even on an empty page.
        height: 400,
      },
      {
        id: "txt1",
        name: "titulo_item",
        type: "text",
        x: 10,
        y: 10,
        width: 150,
        height: 10,
        content: "Item da seção",
        fontSize: 10,
        fontColor: "#000000",
        alignment: "left",
        sectionId,
      },
    ],
  };
  const bindings: Binding[] = [{ schemaName: "secao_gigante", type: "section", path: "itens" }];
  const data = { itens: [{}, {}] }; // 2 repetitions — each one larger than a whole page.
  return { template, data, bindings };
}
