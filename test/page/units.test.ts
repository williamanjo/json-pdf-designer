import { describe, expect, it } from "vitest";
import { GRID_SIZE_MM, mmToPt, mmToPx, ptToMm, ptToPx, pxToMm, snapToGrid } from "../../src/page/units";

describe("mmToPx / pxToMm", () => {
  it("mmToPx converte pelo fator 96dpi (96/25.4)", () => {
    expect(mmToPx(25.4)).toBeCloseTo(96, 10);
    expect(mmToPx(0)).toBe(0);
  });

  it("pxToMm desfaz mmToPx (ida e volta bate com o valor original)", () => {
    const original = 37.6;
    expect(pxToMm(mmToPx(original))).toBeCloseTo(original, 10);
  });

  it("mmToPx desfaz pxToMm (ida e volta bate com o valor original)", () => {
    const original = 123.45;
    expect(mmToPx(pxToMm(original))).toBeCloseTo(original, 10);
  });
});

describe("mmToPt / ptToMm", () => {
  it("mmToPt converte pelo fator de pt (72/25.4)", () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 10);
    expect(mmToPt(0)).toBe(0);
  });

  it("ptToMm desfaz mmToPt (ida e volta bate com o valor original)", () => {
    const original = 42.7;
    expect(ptToMm(mmToPt(original))).toBeCloseTo(original, 10);
  });

  it("mmToPt desfaz ptToMm (ida e volta bate com o valor original)", () => {
    const original = 200;
    expect(mmToPt(ptToMm(original))).toBeCloseTo(original, 10);
  });
});

describe("ptToPx", () => {
  it("converte pt -> mm -> px (72pt = 25.4mm = 1 polegada = 96px)", () => {
    expect(ptToPx(72)).toBeCloseTo(96, 10);
  });

  it("é equivalente a compor mmToPx(ptToMm(pt))", () => {
    const pt = 18;
    expect(ptToPx(pt)).toBeCloseTo(mmToPx(ptToMm(pt)), 10);
  });

  it("zero permanece zero", () => {
    expect(ptToPx(0)).toBe(0);
  });
});

describe("snapToGrid", () => {
  it("arredonda pro múltiplo mais próximo do grid padrão (GRID_SIZE_MM = 5)", () => {
    expect(GRID_SIZE_MM).toBe(5);
    expect(snapToGrid(7)).toBe(5);
    expect(snapToGrid(8)).toBe(10);
    expect(snapToGrid(12.4)).toBe(10);
    expect(snapToGrid(0)).toBe(0);
  });

  it("aceita um gridMm customizado explícito", () => {
    expect(snapToGrid(14, 10)).toBe(10);
    expect(snapToGrid(16, 10)).toBe(20);
    expect(snapToGrid(9, 3)).toBe(9);
  });

  it("gridMm <= 0 é passthrough — devolve o valor original sem arredondar", () => {
    expect(snapToGrid(7.3, 0)).toBe(7.3);
    expect(snapToGrid(7.3, -1)).toBe(7.3);
    expect(snapToGrid(-4.2, -5)).toBe(-4.2);
  });
});
