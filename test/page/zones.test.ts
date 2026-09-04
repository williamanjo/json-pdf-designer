import { describe, expect, it } from "vitest";
import { classifyZone, clampToZone, isRedZone } from "../../src/page/zones";
import type { Bands } from "../../src/page/zones";
import type { PageSize, TextSchema } from "../../src/types";

function makeField(overrides: Partial<TextSchema> = {}): TextSchema {
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

const page: PageSize = { width: 210, height: 297 };
const bands: Bands = { headerHeight: 20, footerHeight: 20, marginLeft: 15, marginRight: 15 };

describe("classifyZone", () => {
  it("campo totalmente dentro do header vira 'header'", () => {
    const field = makeField({ x: 50, y: 0, width: 30, height: 10 });
    expect(classifyZone(field, page, bands)).toBe("header");
  });

  it("caso de fronteira: y + height === headerHeight ainda é 'header' (usa <=)", () => {
    const field = makeField({ x: 50, y: 10, width: 30, height: 10 }); // 10 + 10 === 20
    expect(classifyZone(field, page, bands)).toBe("header");
  });

  it("campo totalmente dentro do footer vira 'footer'", () => {
    const field = makeField({ x: 50, y: 280, width: 30, height: 10 }); // y >= 297 - 20
    expect(classifyZone(field, page, bands)).toBe("footer");
  });

  it("campo dentro da margem esquerda vira 'marginLeft'", () => {
    const field = makeField({ x: 0, y: 100, width: 10, height: 10 }); // x + width <= 15
    expect(classifyZone(field, page, bands)).toBe("marginLeft");
  });

  it("campo dentro da margem direita vira 'marginRight'", () => {
    const field = makeField({ x: 200, y: 100, width: 10, height: 10 }); // x >= 210 - 15
    expect(classifyZone(field, page, bands)).toBe("marginRight");
  });

  it("campo fora de qualquer faixa vira 'body'", () => {
    const field = makeField({ x: 50, y: 100, width: 30, height: 10 });
    expect(classifyZone(field, page, bands)).toBe("body");
  });

  it("campo que só sobrepõe PARCIALMENTE uma faixa (ex: header) não conta — vira 'body'", () => {
    // y=15, height=10 -> y + height = 25, ultrapassa headerHeight (20): não está
    // totalmente contido no header, então não conta como faixa vermelha.
    const field = makeField({ x: 50, y: 15, width: 30, height: 10 });
    expect(classifyZone(field, page, bands)).toBe("body");
  });
});

describe("isRedZone", () => {
  it("'body' não é faixa vermelha", () => {
    expect(isRedZone("body")).toBe(false);
  });

  it("'header', 'footer', 'marginLeft' e 'marginRight' são faixa vermelha", () => {
    expect(isRedZone("header")).toBe(true);
    expect(isRedZone("footer")).toBe(true);
    expect(isRedZone("marginLeft")).toBe(true);
    expect(isRedZone("marginRight")).toBe(true);
  });
});

describe("clampToZone", () => {
  it("zona 'header': trava y dentro de [0, headerHeight - height]", () => {
    const result = clampToZone("header", 50, 999, 30, 10, page, bands);
    expect(result.y).toBe(10); // headerHeight(20) - height(10)
    expect(result.x).toBe(50);
  });

  it("zona 'footer': trava y dentro de [page.height - footerHeight, page.height - height]", () => {
    const result = clampToZone("footer", 50, 0, 30, 10, page, bands);
    expect(result.y).toBe(277); // page.height(297) - footerHeight(20)
  });

  it("zona 'marginLeft': trava x dentro de [0, marginLeft - width]", () => {
    const result = clampToZone("marginLeft", 999, 100, 10, 10, page, bands);
    expect(result.x).toBe(5); // marginLeft(15) - width(10)
  });

  it("zona 'marginRight': trava x dentro de [page.width - marginRight, page.width - width]", () => {
    const result = clampToZone("marginRight", 0, 100, 10, 10, page, bands);
    expect(result.x).toBe(195); // page.width(210) - marginRight(15)
  });

  it("zona 'body': trava dentro da área central, fora das 4 faixas", () => {
    const result = clampToZone("body", 0, 0, 20, 20, page, bands);
    expect(result.x).toBe(15); // marginLeft
    expect(result.y).toBe(20); // headerHeight
  });

  it("campo mais LARGO que a própria zona (marginLeft) ainda retorna resultado não-invertido", () => {
    // width(50) > marginLeft(15): min seria 0, max seria max(0, 15 - 50) = 0.
    const result = clampToZone("marginLeft", 999, 100, 50, 10, page, bands);
    expect(result.x).toBe(0);
    expect(Number.isFinite(result.x)).toBe(true);
  });

  it("campo mais ALTO que a própria zona (header) ainda retorna resultado não-invertido", () => {
    // height(50) > headerHeight(20): min seria 0, max seria max(0, 20 - 50) = 0.
    const result = clampToZone("header", 50, 999, 30, 50, page, bands);
    expect(result.y).toBe(0);
    expect(Number.isFinite(result.y)).toBe(true);
  });
});
