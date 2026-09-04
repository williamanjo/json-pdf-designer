import { describe, expect, it } from "vitest";
import {
  makeChartSchema,
  makeImageSchema,
  makeKpiSchema,
  makeSectionColumnPair,
  makeSectionSchema,
  makeTableSchema,
  makeTextSchema,
  nextFreeY,
  uid,
} from "../src/schemaFactory";
import { en } from "../src/i18n/locales/en";
import type { Schema, TextSchema } from "../src/types";

describe("uid", () => {
  it("retorna strings não vazias", () => {
    const id = uid();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("duas chamadas consecutivas produzem valores diferentes", () => {
    expect(uid()).not.toBe(uid());
  });
});

describe("makeTextSchema", () => {
  it("cria com type/dimensões/x default e nome com o prefixo certo", () => {
    const s = makeTextSchema(20);
    expect(s.type).toBe("text");
    expect(s.width).toBe(80);
    expect(s.height).toBe(10);
    expect(s.content).toBe(en.schemaDefaults.textContent);
    expect(s.x).toBe(10);
    expect(s.y).toBe(20);
    expect(s.name.startsWith(`${en.schemaDefaults.textNamePrefix}_`)).toBe(true);
  });
});

describe("makeTableSchema", () => {
  it("cria com head/content default e prefixo de nome certo", () => {
    const s = makeTableSchema(0);
    expect(s.type).toBe("table");
    expect(s.width).toBe(150);
    expect(s.height).toBe(30);
    expect(s.head).toEqual([en.schemaDefaults.column1, en.schemaDefaults.column2]);
    expect(s.content).toEqual([[en.schemaDefaults.value1, en.schemaDefaults.value2]]);
    expect(s.x).toBe(10);
    expect(s.name.startsWith(`${en.schemaDefaults.tableNamePrefix}_`)).toBe(true);
  });
});

describe("makeImageSchema", () => {
  it("cria com content vazio e prefixo de nome certo", () => {
    const s = makeImageSchema(0);
    expect(s.type).toBe("image");
    expect(s.width).toBe(40);
    expect(s.height).toBe(40);
    expect(s.content).toBe("");
    expect(s.x).toBe(10);
    expect(s.name.startsWith(`${en.schemaDefaults.imageNamePrefix}_`)).toBe(true);
  });
});

describe("makeSectionSchema", () => {
  it("cria com dimensões default e prefixo de nome certo", () => {
    const s = makeSectionSchema(0);
    expect(s.type).toBe("section");
    expect(s.width).toBe(190);
    expect(s.height).toBe(20);
    expect(s.x).toBe(10);
    expect(s.name.startsWith(`${en.schemaDefaults.sectionNamePrefix}_`)).toBe(true);
  });
});

describe("makeChartSchema", () => {
  it("cria com defaults de gráfico pizza/donut e prefixo de nome certo", () => {
    const s = makeChartSchema(0);
    expect(s.type).toBe("chart");
    expect(s.width).toBe(100);
    expect(s.height).toBe(70);
    expect(s.chartType).toBe("pie");
    expect(s.pieStyle).toBe("donut");
    expect(s.legendPosition).toBe("right");
    expect(s.displayMode).toBe("percent");
    expect(s.topN).toBe(7);
    expect(s.x).toBe(10);
    expect(s.name.startsWith(`${en.schemaDefaults.chartNamePrefix}_`)).toBe(true);
  });
});

describe("makeKpiSchema", () => {
  it("cria com defaults de cartão indicador e prefixo de nome certo", () => {
    const s = makeKpiSchema(0);
    expect(s.type).toBe("kpi");
    expect(s.width).toBe(55);
    expect(s.height).toBe(35);
    expect(s.icon).toBe("bar_chart");
    expect(s.title).toBe(en.schemaDefaults.kpiTitle);
    expect(s.value).toBe(en.schemaDefaults.kpiValue);
    expect(s.subtitle).toBe(en.schemaDefaults.kpiSubtitle);
    expect(s.backgroundColor).toBe("#2563eb");
    expect(s.textColor).toBe("#ffffff");
    expect(s.x).toBe(10);
    expect(s.name.startsWith(`${en.schemaDefaults.kpiNamePrefix}_`)).toBe(true);
  });
});

describe("makeSectionColumnPair", () => {
  it("substitui caracteres não alfanuméricos do nome da coluna pelo nome seguro gerado", () => {
    const column = "Valor (R$)";
    const { header, value } = makeSectionColumnPair("sec1", column, 0, 0);
    const safeCol = column.replace(/[^a-zA-Z0-9]/g, "_");
    expect(header.name).toContain(`${en.schemaDefaults.headerNamePrefix}_${safeCol}_`);
    expect(value.name).toContain(`${en.schemaDefaults.valueNamePrefix}_${safeCol}_`);
    // garante que os caracteres originais não-alfanuméricos não vazam pro nome
    expect(header.name).not.toMatch(/[^a-zA-Z0-9_]/);
    expect(value.name).not.toMatch(/[^a-zA-Z0-9_]/);
  });

  it("header.content é a coluna crua; value.content é a coluna entre chaves", () => {
    const column = "processo";
    const { header, value } = makeSectionColumnPair("sec1", column, 0, 0);
    expect(header.content).toBe(column);
    expect(value.content).toBe(`{${column}}`);
  });

  it("header e value compartilham o mesmo sectionId", () => {
    const { header, value } = makeSectionColumnPair("sec1", "col", 0, 0);
    expect(header.sectionId).toBe("sec1");
    expect(value.sectionId).toBe("sec1");
  });

  it("retorna o valueBinding no formato template apontando pro nome do campo value", () => {
    const column = "fatura";
    const { value, valueBinding } = makeSectionColumnPair("sec1", column, 0, 0);
    expect(valueBinding).toEqual({
      schemaName: value.name,
      type: "template",
      template: `{${column}}`,
    });
  });

  it("posiciona header em (x,y) e value ao lado, deslocado por width + gap", () => {
    const { header, value } = makeSectionColumnPair("sec1", "col", 10, 20);
    expect(header.x).toBe(10);
    expect(header.y).toBe(20);
    expect(value.y).toBe(20);
    expect(value.x).toBe(header.x + header.width + 5);
  });
});

describe("nextFreeY", () => {
  it("array vazio retorna o valor base (10)", () => {
    expect(nextFreeY([])).toBe(10);
  });

  it("escolhe o máximo verdadeiro entre TODOS os schemas, não só o último", () => {
    const base = (overrides: Partial<TextSchema>): TextSchema => ({
      ...makeTextSchema(0),
      ...overrides,
    });
    const schemas: Schema[] = [
      base({ y: 0, height: 12 }), // y+height = 12
      base({ y: 100, height: 5 }), // y+height = 105 (o verdadeiro máximo, não é o último)
      base({ y: 5, height: 5 }), // último do array, y+height = 10
    ];
    // base + gap = 105 + 5 = 110, já múltiplo de 5 (GRID_SIZE_MM), sem alterar no snap
    expect(nextFreeY(schemas)).toBe(110);
  });
});
