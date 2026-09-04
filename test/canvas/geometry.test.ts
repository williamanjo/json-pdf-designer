import { describe, expect, it } from "vitest";
import { findSectionAt, schemasInRect } from "../../src/canvas/geometry";
import type { SectionSchema, TextSchema } from "../../src/types";

function makeSection(overrides: Partial<SectionSchema> = {}): SectionSchema {
  return {
    id: "sec1",
    name: "seção",
    type: "section",
    x: 0,
    y: 0,
    width: 50,
    height: 50,
    ...overrides,
  };
}

function makeText(overrides: Partial<TextSchema> = {}): TextSchema {
  return {
    id: "f1",
    name: "campo",
    type: "text",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    content: "",
    fontSize: 10,
    fontColor: "#000000",
    alignment: "left",
    ...overrides,
  };
}

describe("findSectionAt", () => {
  it("centro do campo totalmente dentro de uma seção -> retorna essa seção", () => {
    const section = makeSection({ id: "sec1", x: 0, y: 0, width: 50, height: 50 });
    const other = makeSection({ id: "sec2", x: 100, y: 100, width: 50, height: 50 });
    // campo em x=10,y=10,width=10,height=10 -> centro (15,15), dentro de sec1
    const result = findSectionAt([section, other], 10, 10, 10, 10, "field1");
    expect(result?.id).toBe("sec1");
  });

  it("excludeId igual ao id da própria seção -> não bate nela mesma (cai pra próximo match ou undefined)", () => {
    const section = makeSection({ id: "sec1", x: 0, y: 0, width: 50, height: 50 });
    // Excluindo o próprio id da seção que conteria o centro -> nenhum match.
    const result = findSectionAt([section], 10, 10, 10, 10, "sec1");
    expect(result).toBeUndefined();
  });

  it("excludeId de uma seção diferente da que contém o centro -> ainda encontra a seção correta", () => {
    const section = makeSection({ id: "sec1", x: 0, y: 0, width: 50, height: 50 });
    const other = makeSection({ id: "sec2", x: 100, y: 100, width: 50, height: 50 });
    const result = findSectionAt([section, other], 10, 10, 10, 10, "sec2");
    expect(result?.id).toBe("sec1");
  });

  it("ponto fora de qualquer seção -> undefined", () => {
    const section = makeSection({ id: "sec1", x: 0, y: 0, width: 50, height: 50 });
    // campo em x=200,y=200,width=10,height=10 -> centro (205,205), fora de sec1
    const result = findSectionAt([section], 200, 200, 10, 10, "field1");
    expect(result).toBeUndefined();
  });
});

describe("schemasInRect", () => {
  it("schema totalmente dentro do retângulo -> incluído", () => {
    const field = makeText({ id: "f1", x: 10, y: 10, width: 10, height: 10 });
    const rectMm = { x1: 0, y1: 0, x2: 50, y2: 50 };
    const hit = schemasInRect([field], rectMm);
    expect(hit.map((s) => s.id)).toEqual(["f1"]);
  });

  it("schema totalmente fora do retângulo -> excluído", () => {
    const field = makeText({ id: "f1", x: 100, y: 100, width: 10, height: 10 });
    const rectMm = { x1: 0, y1: 0, x2: 50, y2: 50 };
    const hit = schemasInRect([field], rectMm);
    expect(hit).toEqual([]);
  });

  it("schema que se sobrepõe parcialmente ao retângulo (cruza a borda) -> incluído (overlap parcial conta)", () => {
    // Retângulo vai de x=0..20; campo vai de x=15..25 (cruza a borda direita).
    const field = makeText({ id: "f1", x: 15, y: 5, width: 10, height: 10 });
    const rectMm = { x1: 0, y1: 0, x2: 20, y2: 20 };
    const hit = schemasInRect([field], rectMm);
    expect(hit.map((s) => s.id)).toEqual(["f1"]);
  });

  it("schema que só ENCOSTA na borda do retângulo, sem sobrepor de verdade -> excluído (comparação estrita, não <=)", () => {
    // Retângulo termina em x2=20; campo começa exatamente em x=20 (só toca, não cruza).
    const field = makeText({ id: "f1", x: 20, y: 5, width: 10, height: 10 });
    const rectMm = { x1: 0, y1: 0, x2: 20, y2: 20 };
    const hit = schemasInRect([field], rectMm);
    expect(hit).toEqual([]);
  });

  it("seção só entra na seleção se o retângulo cruzar a faixa do HEADER dela, não o corpo inteiro", () => {
    // Seção alta (100mm) — a faixa do header é bem menor (pxToMm(16) ~ 4.2mm).
    // Retângulo cruza y=30..40, bem abaixo do header, mas ainda dentro do corpo da seção.
    const section = makeSection({ id: "sec1", x: 0, y: 0, width: 50, height: 100 });
    const rectMm = { x1: 0, y1: 30, x2: 50, y2: 40 };
    const hit = schemasInRect([section], rectMm);
    expect(hit).toEqual([]);
  });

  it("seção entra na seleção quando o retângulo cruza a faixa do header dela", () => {
    const section = makeSection({ id: "sec1", x: 0, y: 0, width: 50, height: 100 });
    const rectMm = { x1: 0, y1: 0, x2: 50, y2: 5 };
    const hit = schemasInRect([section], rectMm);
    expect(hit.map((s) => s.id)).toEqual(["sec1"]);
  });
});
