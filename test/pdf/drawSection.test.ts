import { describe, expect, it } from "vitest";
import { resolveSectionItems, sectionInstanceHeight, sectionMembersOf } from "../../src/pdf/drawSection";
import { TABLE_ROW_HEIGHT_MM } from "../../src/pdf/drawTable";
import type { Binding, SectionSchema, TableSchema, TemplatePage, TextSchema } from "../../src/types";

function makeSection(overrides: Partial<SectionSchema> = {}): SectionSchema {
  return {
    id: "sec1",
    name: "secao",
    type: "section",
    x: 0,
    y: 10,
    width: 100,
    height: 30,
    ...overrides,
  };
}

function makeText(overrides: Partial<TextSchema> = {}): TextSchema {
  return {
    id: "txt1",
    name: "texto",
    type: "text",
    x: 0,
    y: 10,
    width: 50,
    height: 5,
    content: "olá",
    fontSize: 9,
    fontColor: "#000000",
    alignment: "left",
    ...overrides,
  };
}

function makeTable(overrides: Partial<TableSchema> = {}): TableSchema {
  return {
    id: "tbl1",
    name: "tabela_membro",
    type: "table",
    x: 0,
    y: 10,
    width: 100,
    height: 20,
    head: ["produto", "qtd"],
    content: [["produto", "qtd"]],
    ...overrides,
  };
}

function makePage(overrides: Partial<TemplatePage> = {}): TemplatePage {
  return {
    id: "page1",
    page: { width: 210, height: 297 },
    schemas: [],
    ...overrides,
  };
}

describe("sectionMembersOf", () => {
  it("retorna só os schemas cujo sectionId aponta pra essa seção", () => {
    const section = makeSection({ id: "sec1" });
    const otherSection = makeSection({ id: "sec2" });
    const member1 = makeText({ id: "m1", sectionId: "sec1" });
    const member2 = makeTable({ id: "m2", sectionId: "sec1" });
    const otherMember = makeText({ id: "m3", sectionId: "sec2" });
    const unassigned = makeText({ id: "m4" });
    const pageDef = makePage({ schemas: [member1, member2, otherMember, unassigned, otherSection] });

    expect(sectionMembersOf(pageDef, section)).toEqual([member1, member2]);
  });

  it("retorna vazio quando nenhum schema pertence à seção", () => {
    const section = makeSection({ id: "sec1" });
    const pageDef = makePage({ schemas: [makeText({ id: "m1", sectionId: "sec2" })] });

    expect(sectionMembersOf(pageDef, section)).toEqual([]);
  });
});

describe("sectionInstanceHeight", () => {
  it("sem membros tabela, retorna a altura autorada da seção (mínimo)", () => {
    const section = makeSection({ id: "sec1", height: 30 });
    const pageDef = makePage({ schemas: [makeText({ id: "m1", sectionId: "sec1" })] });

    expect(sectionInstanceHeight(pageDef, section, undefined, [])).toBe(30);
  });

  it("tabela membro cujas linhas resolvidas excedem o placeholder empurra a altura pra baixo", () => {
    const section = makeSection({ id: "sec1", height: 30 });
    // Sem binding e sem item-objeto, resolveNestedTableRows cai pro
    // próprio tableMember.content (ver src/pdf/resolvers.ts).
    const tableMember = makeTable({
      id: "m1",
      sectionId: "sec1",
      height: 20,
      content: [
        ["a", "1"],
        ["b", "2"],
        ["c", "3"],
        ["d", "4"],
        ["e", "5"],
      ],
    });
    const pageDef = makePage({ schemas: [tableMember] });

    // actualHeight = (rows.length + 1 cabeçalho + 0 footer) * TABLE_ROW_HEIGHT_MM
    //              = (5 + 1) * 7 = 42
    // growth = max(0, 42 - 20) = 22
    const rows = tableMember.content.length;
    const expectedActualHeight = (rows + 1) * TABLE_ROW_HEIGHT_MM;
    const expectedGrowth = expectedActualHeight - tableMember.height;
    expect(expectedGrowth).toBeGreaterThan(0);

    expect(sectionInstanceHeight(pageDef, section, undefined, [])).toBe(section.height + expectedGrowth);
  });

  it("soma o crescimento de todas as tabelas membro (mestre-detalhe)", () => {
    const section = makeSection({ id: "sec1", height: 30 });
    const table1 = makeTable({
      id: "m1",
      name: "tabela_1",
      sectionId: "sec1",
      height: 14, // (2 rows + 1 head) * 7 = 21 -> growth 7
      content: [
        ["a", "1"],
        ["b", "2"],
      ],
    });
    const table2 = makeTable({
      id: "m2",
      name: "tabela_2",
      sectionId: "sec1",
      height: 14, // (3 rows + 1 head) * 7 = 28 -> growth 14
      content: [
        ["a", "1"],
        ["b", "2"],
        ["c", "3"],
      ],
    });
    const pageDef = makePage({ schemas: [table1, table2] });

    expect(sectionInstanceHeight(pageDef, section, undefined, [])).toBe(30 + 7 + 14);
  });
});

describe("resolveSectionItems", () => {
  const sectionSchema = makeSection({ id: "sec1", name: "secao" });

  it("sem binding correspondente, retorna [undefined] (preview de design)", () => {
    const bindings: Binding[] = [];
    expect(resolveSectionItems(sectionSchema, bindings, {})).toEqual([undefined]);
  });

  it("com binding, mas path resolve pra algo que não é array, retorna [undefined]", () => {
    const bindings: Binding[] = [{ schemaName: "secao", type: "section", path: "itens" }];
    const data = { itens: "não é array" };
    expect(resolveSectionItems(sectionSchema, bindings, data)).toEqual([undefined]);
  });

  it("com binding, mas array vazio, retorna [undefined]", () => {
    const bindings: Binding[] = [{ schemaName: "secao", type: "section", path: "itens" }];
    const data = { itens: [] };
    expect(resolveSectionItems(sectionSchema, bindings, data)).toEqual([undefined]);
  });

  it("com binding e array não-vazio, retorna o array de itens", () => {
    const bindings: Binding[] = [{ schemaName: "secao", type: "section", path: "itens" }];
    const itens = [{ produto: "A" }, { produto: "B" }];
    const data = { itens };
    expect(resolveSectionItems(sectionSchema, bindings, data)).toBe(itens);
  });

  it("path do binding é case-insensitive, igual chart/kpi/tabela (getCaseInsensitive, não mais lodash.get)", () => {
    const bindings: Binding[] = [{ schemaName: "secao", type: "section", path: "itens" }];
    const itens = [{ produto: "A" }, { produto: "B" }];
    const data = { Itens: itens };
    expect(resolveSectionItems(sectionSchema, bindings, data)).toBe(itens);
  });
});
