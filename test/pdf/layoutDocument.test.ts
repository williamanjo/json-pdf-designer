import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { layoutDocument, type LayoutDocument } from "../../src/pdf/layout/layoutDocument";
import { generatePdf } from "../../src/pdf/generate";
import { buildInputs } from "../../src/bindings/bindings";
import type { Binding, Template } from "../../src/types";
import { hugeTableTemplate } from "./fixtures/hugeTable";
import { emptyTableTemplate } from "./fixtures/emptyTable";
import { sectionLargerThanPageTemplate } from "./fixtures/sectionLargerThanPage";

// `layoutDocument` decide TODA a paginação numa travessia só, e o render
// consome a decisão. Estes testes olham a decisão em si — coisa que um teste
// sobre o PDF gerado não consegue fazer: em que página cada campo caiu,
// quantas linhas em cada fatia de tabela, quantas repetições de seção por
// página.

function layoutOf(template: Template, data: unknown = {}, bindings: Binding[] = []): LayoutDocument {
  return layoutDocument(template, data, bindings, buildInputs(data, bindings));
}

// Resumo estável de um LayoutDocument, para snapshot. É o "golden test" que
// de fato funciona neste projeto: comparar BYTES de PDF é inviável (o pdf-lib
// escreve CreationDate/IDs não-determinísticos, então os bytes mudam a cada
// run), e snapshot de pixel já se mostrou inviável no ambiente. Isto é
// determinístico, legível no diff do PR e cobre exatamente o que importa.
function summarize(layout: LayoutDocument): string {
  return layout.pages
    .map((page, i) => {
      const lines = page.placements.map((p) => {
        const y = `y=${p.yMm.toFixed(1)}`;
        if (p.kind === "field") return `  field ${p.schema.name} ${y} value=${JSON.stringify(p.value ?? null)}`;
        if (p.kind === "tableSlice") {
          const head = p.includeHead ? " +head" : "";
          const footer = p.footer ? " +footer" : "";
          return `  tableSlice ${p.schema.name} ${y} rows=${p.rows.length}${head}${footer}${p.isLastSlice ? " last" : ""}`;
        }
        return `  sectionRepeat ${p.schema.name} ${y} index=${p.index}`;
      });
      return [`page ${i + 1} (${page.pageDef.id}) — ${page.placements.length} placement(s)`, ...lines].join("\n");
    })
    .join("\n");
}

describe("layoutDocument", () => {
  it("template sem corpo ainda rende uma página (as faixas repetidas precisam de uma)", () => {
    const layout = layoutOf({ page: { width: 210, height: 297 }, schemas: [] });
    expect(layout.pages).toHaveLength(1);
    expect(layout.pages[0].placements).toEqual([]);
  });

  it("campos que compartilham o mesmo Y autorado caem na mesma linha do fluxo", () => {
    // Preserva grade lado a lado (ex: dois KPIs) em vez de cascatear um
    // embaixo do outro.
    const template: Template = {
      page: { width: 210, height: 297 },
      schemas: [
        { id: "a", name: "esq", type: "text", x: 10, y: 40, width: 80, height: 10, content: "A", fontSize: 10, fontColor: "#000", alignment: "left" },
        { id: "b", name: "dir", type: "text", x: 100, y: 40, width: 80, height: 10, content: "B", fontSize: 10, fontColor: "#000", alignment: "left" },
      ],
    };
    const layout = layoutOf(template);
    expect(layout.pages).toHaveLength(1);
    const ys = layout.pages[0].placements.map((p) => p.yMm);
    expect(ys).toEqual([40, 40]);
  });

  it("tabela longa se fatia em várias páginas, com cabeçalho repetido em cada uma", () => {
    const layout = layoutOf(hugeTableTemplate(60));
    expect(layout.pages.length).toBeGreaterThan(1);
    const slices = layout.pages.flatMap((p) => p.placements).filter((p) => p.kind === "tableSlice");
    // Nenhuma linha perdida nem duplicada no fatiamento.
    expect(slices.reduce((sum, s) => sum + (s.kind === "tableSlice" ? s.rows.length : 0), 0)).toBe(60);
    // repeatHeader default = true.
    expect(slices.every((s) => s.kind === "tableSlice" && s.includeHead)).toBe(true);
    // Só a última fatia é marcada como última.
    expect(slices.filter((s) => s.kind === "tableSlice" && s.isLastSlice)).toHaveLength(1);
  });

  it("repeatHeader: false desenha o cabeçalho só na primeira fatia", () => {
    const base = hugeTableTemplate(60);
    const table = { ...base.schemas[0], repeatHeader: false } as typeof base.schemas[0];
    const layout = layoutOf({ ...base, schemas: [table] });
    const slices = layout.pages.flatMap((p) => p.placements).filter((p) => p.kind === "tableSlice");
    expect(slices.length).toBeGreaterThan(1);
    expect(slices.map((s) => (s.kind === "tableSlice" ? s.includeHead : null))).toEqual([true, ...slices.slice(1).map(() => false)]);
  });

  it("tabela vazia ainda coloca uma fatia (o cabeçalho é desenhado)", () => {
    const layout = layoutOf(emptyTableTemplate());
    const slices = layout.pages.flatMap((p) => p.placements).filter((p) => p.kind === "tableSlice");
    expect(slices).toHaveLength(1);
    expect(slices[0].kind === "tableSlice" && slices[0].rows).toEqual([]);
    expect(slices[0].kind === "tableSlice" && slices[0].includeHead).toBe(true);
  });

  it("seção maior que a página inteira termina em páginas finitas, sem loop infinito", () => {
    const { template, data, bindings } = sectionLargerThanPageTemplate();
    const layout = layoutOf(template, data, bindings);
    expect(layout.pages.length).toBeGreaterThanOrEqual(2);
    expect(layout.pages.length).toBeLessThan(100);
  });

  it("valor de campo de texto já vem resolvido — o render não resolve dado nenhum", () => {
    const template: Template = {
      page: { width: 210, height: 297 },
      schemas: [
        { id: "t", name: "titulo", type: "text", x: 10, y: 20, width: 100, height: 10, content: "Olá {nome}", fontSize: 12, fontColor: "#000", alignment: "left" },
      ],
    };
    const layout = layoutOf(template, { nome: "Ana" });
    const field = layout.pages[0].placements[0];
    expect(field.kind === "field" && field.value).toBe("Olá Ana");
  });
});

describe("layoutDocument x generatePdf — a divergência dry-run/render", () => {
  // A razão de o layout existir. Antes havia DUAS travessias: uma para contar
  // páginas (porque {pageCount} precisa do total antes do primeiro traço) e
  // outra para desenhar. Um bug numa das cópias significaria "o dry-run disse
  // 7 páginas, o desenho fez 8" — silencioso e horrível de achar.
  //
  // Hoje a contagem É `layout.pages.length` e o desenho consome esse mesmo
  // array, então a divergência é estruturalmente impossível. Este teste é o
  // que prova a equivalência ponta a ponta.

  const cases: [string, Template, unknown, Binding[]][] = [
    ["tabela de 600 linhas", hugeTableTemplate(600), {}, []],
    ["tabela de 60 linhas", hugeTableTemplate(60), {}, []],
    ["tabela vazia", emptyTableTemplate(), {}, []],
  ];

  for (const [label, template, data, bindings] of cases) {
    it(`${label}: pages.length bate com o PDF gerado`, async () => {
      const layout = layoutOf(template, data, bindings);
      const bytes = await generatePdf(template, data, bindings);
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(layout.pages.length);
    }, 20000);
  }

  it("seção maior que a página: pages.length bate com o PDF gerado", async () => {
    const { template, data, bindings } = sectionLargerThanPageTemplate();
    const layout = layoutOf(template, data, bindings);
    const bytes = await generatePdf(template, data, bindings);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(layout.pages.length);
  });
});

describe("golden estruturado", () => {
  it("é determinístico — duas chamadas dão o mesmo resumo", () => {
    const t = hugeTableTemplate(25);
    expect(summarize(layoutOf(t))).toBe(summarize(layoutOf(t)));
  });

  it("tabela que pagina", () => {
    expect(summarize(layoutOf(hugeTableTemplate(25)))).toMatchSnapshot();
  });

  it("mestre-detalhe (seção repetida com tabela membro)", () => {
    const { template, data, bindings } = sectionLargerThanPageTemplate();
    expect(summarize(layoutOf(template, data, bindings))).toMatchSnapshot();
  });
});
