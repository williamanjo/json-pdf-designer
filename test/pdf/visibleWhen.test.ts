import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { layoutDocument } from "../../src/pdf/layout/layoutDocument";
import { generatePdf } from "../../src/pdf/generate";
import { buildInputs } from "../../src/bindings/bindings";
import type { Binding, Schema, Template } from "../../src/types";

const A4 = { width: 210, height: 297 };

function text(id: string, y: number, content: string, extra: Partial<Schema> = {}): Schema {
  return {
    id,
    name: id,
    type: "text",
    x: 10,
    y,
    width: 90,
    height: 10,
    content,
    fontSize: 10,
    fontColor: "#000000",
    alignment: "left",
    ...extra,
  } as Schema;
}

function layoutOf(template: Template, data: unknown = {}, bindings: Binding[] = []) {
  return layoutDocument(template, data, bindings, buildInputs(data, bindings));
}

const namesOn = (template: Template, data: unknown, bindings: Binding[] = []) =>
  layoutOf(template, data, bindings)
    .pages.flatMap((p) => p.placements)
    .map((p) => (p.kind === "field" ? p.schema.name : p.schema.name));

describe("visibleWhen — campo", () => {
  const template: Template = {
    page: A4,
    schemas: [
      text("sempre", 20, "sempre"),
      text("soEmpresa", 40, "empresa", { visibleWhen: 'tipo == "empresa"' }),
      text("soPessoa", 60, "pessoa", { visibleWhen: 'tipo == "pessoa"' }),
    ],
  };

  it("desenha só o campo cuja condição é verdadeira", () => {
    expect(namesOn(template, { tipo: "empresa" })).toEqual(["sempre", "soEmpresa"]);
    expect(namesOn(template, { tipo: "pessoa" })).toEqual(["sempre", "soPessoa"]);
  });

  it("campo sem visibleWhen aparece sempre", () => {
    expect(namesOn(template, {})).toContain("sempre");
  });

  it("condição inválida deixa o campo VISÍVEL — erro de digitação não apaga campo", () => {
    const broken: Template = { page: A4, schemas: [text("quebrado", 20, "x", { visibleWhen: "a) b" })] };
    expect(namesOn(broken, {})).toEqual(["quebrado"]);
  });

  it("visibleWhen em branco (ou só espaço) conta como sempre visível", () => {
    for (const cond of ["", "   "]) {
      const t: Template = { page: A4, schemas: [text("campo", 20, "x", { visibleWhen: cond })] };
      expect(namesOn(t, {}), JSON.stringify(cond)).toEqual(["campo"]);
    }
  });

  it("aceita AND/OR/NOT e comparação numérica", () => {
    const t: Template = {
      page: A4,
      schemas: [
        text("a", 20, "x", { visibleWhen: "total > 1000 AND NOT cancelado" }),
        text("b", 40, "x", { visibleWhen: "total > 5000 OR urgente" }),
      ],
    };
    expect(namesOn(t, { total: 1500, cancelado: "", urgente: "" })).toEqual(["a"]);
    expect(namesOn(t, { total: 1500, cancelado: "true", urgente: "1" })).toEqual(["b"]);
  });
});

describe("visibleWhen — efeito no fluxo", () => {
  it("campo escondido numa linha com vizinho visível deixa o buraco (a linha continua)", () => {
    // Dois campos no MESMO Y são uma "row" — os vizinhos precisam do lugar
    // deles, então a linha mantém a altura.
    const t: Template = {
      page: A4,
      schemas: [
        text("esq", 40, "esq", { visibleWhen: "nunca" }),
        { ...text("dir", 40, "dir"), x: 110 } as Schema,
        text("abaixo", 60, "abaixo"),
      ],
    };
    const layout = layoutOf(t, {});
    const placements = layout.pages[0].placements;
    expect(placements.map((p) => p.schema.name)).toEqual(["dir", "abaixo"]);
    // "abaixo" fica onde ficaria sem esconder nada: 40 + 10 (altura da linha)
    // + 10 (gap autorado até y=60) = 60.
    expect(placements[1].yMm).toBe(60);
  });

  it("linha totalmente escondida devolve a ALTURA dela, mantendo os gaps em volta", () => {
    const t: Template = {
      page: A4,
      schemas: [
        text("topo", 20, "topo"),
        text("escondido", 40, "x", { visibleWhen: "nunca" }),
        text("abaixo", 60, "abaixo"),
      ],
    };
    const semEsconder: Template = {
      page: A4,
      schemas: [text("topo", 20, "topo"), text("meio", 40, "x"), text("abaixo", 60, "abaixo")],
    };
    const y = (tpl: Template, name: string) =>
      layoutOf(tpl, {})
        .pages[0].placements.find((p) => p.schema.name === name)!.yMm;

    expect(y(semEsconder, "abaixo")).toBe(60);
    // A linha do meio tem 10mm de altura. Escondendo-a, "abaixo" sobe
    // exatamente 10mm — os dois gaps autorados (10mm de cada lado) continuam
    // valendo, só a altura do item escondido é devolvida.
    expect(y(t, "abaixo")).toBe(50);
  });

  it("tabela escondida sai do fluxo por inteiro e libera as páginas dela", () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ item: `I${i}`, valor: i }));
    const tabela: Schema = {
      id: "tab", name: "tab", type: "table", x: 10, y: 20, width: 190, height: 20,
      head: ["Item", "Valor"], content: [],
    } as Schema;
    const bindings: Binding[] = [{ schemaName: "tab", type: "array", path: "rows", columns: ["item", "valor"] }];

    const visivel: Template = { page: A4, schemas: [tabela, text("depois", 60, "depois")] };
    const escondida: Template = {
      page: A4,
      schemas: [{ ...tabela, visibleWhen: "mostrar" } as Schema, text("depois", 60, "depois")],
    };

    expect(layoutOf(visivel, { rows }, bindings).pages.length).toBeGreaterThan(4);
    // Escondida: nenhuma fatia, nenhuma página extra, e o texto sobe pro topo.
    const layout = layoutOf(escondida, { rows, mostrar: "" }, bindings);
    expect(layout.pages).toHaveLength(1);
    expect(layout.pages[0].placements.map((p) => p.schema.name)).toEqual(["depois"]);
  });

  it("seção escondida não repete nada", () => {
    const secId = "sec";
    const t: Template = {
      page: A4,
      schemas: [
        { id: secId, name: "secao", type: "section", x: 10, y: 20, width: 190, height: 30, visibleWhen: "mostrar" } as Schema,
        { ...text("membro", 22, "{nome}"), sectionId: secId } as Schema,
      ],
    };
    const bindings: Binding[] = [{ schemaName: "secao", type: "section", path: "itens" }];
    const data = { itens: [{ nome: "a" }, { nome: "b" }, { nome: "c" }], mostrar: "" };
    expect(layoutOf(t, data, bindings).pages[0].placements).toEqual([]);
  });
});

describe("visibleWhen — faixas repetidas (cabeçalho/rodapé)", () => {
  // As faixas são resolvidas pelo RENDER, não pelo layout, porque a condição
  // pode depender de {pageNumber}/{pageCount} — que só existem depois do
  // layout terminar.
  it("condição pode usar pageNumber — ex: aviso só na última página", async () => {
    const rows = Array.from({ length: 80 }, (_, i) => ({ item: `I${i}`, valor: i }));
    const template: Template = {
      page: A4,
      headerHeight: 15,
      footerHeight: 15,
      schemas: [
        { ...text("aviso", 285, "Confira os totais"), visibleWhen: "pageNumber == pageCount" } as Schema,
        { id: "tab", name: "tab", type: "table", x: 10, y: 20, width: 190, height: 20, head: ["Item", "Valor"], content: [] } as Schema,
      ],
    };
    const bindings: Binding[] = [{ schemaName: "tab", type: "array", path: "rows", columns: ["item", "valor"] }];
    const bytes = await generatePdf(template, { rows }, bindings);
    const doc = await PDFDocument.load(bytes);
    // Não dá pra ler o texto do PDF aqui; o que este teste garante é que a
    // condição com pageNumber não estoura nem muda a paginação.
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});

describe("visibleWhen — o PDF concorda com o layout", () => {
  it("contagem de páginas do PDF bate com pages.length quando há campo escondido", async () => {
    const rows = Array.from({ length: 120 }, (_, i) => ({ item: `I${i}`, valor: i }));
    const template: Template = {
      page: A4,
      headerHeight: 15,
      footerHeight: 15,
      schemas: [
        text("oculto", 18, "nunca aparece", { visibleWhen: "nunca" }),
        { id: "tab", name: "tab", type: "table", x: 10, y: 30, width: 190, height: 20, head: ["Item", "Valor"], content: [] } as Schema,
      ],
    };
    const bindings: Binding[] = [{ schemaName: "tab", type: "array", path: "rows", columns: ["item", "valor"] }];
    const data = { rows };
    const layout = layoutOf(template, data, bindings);
    const doc = await PDFDocument.load(await generatePdf(template, data, bindings));
    expect(doc.getPageCount()).toBe(layout.pages.length);
  });
});
