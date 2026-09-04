import { describe, expect, it } from "vitest";
import { resizeColumnPair } from "../../../src/fields/table/columnResize";

describe("resizeColumnPair", () => {
  it("caso normal: as duas colunas deslocam pelo dx, largura total preservada", () => {
    const result = resizeColumnPair(50, 50, 10, 10);
    expect(result).toEqual({ left: 60, right: 40 });
    expect(result.left + result.right).toBe(100);
  });

  it("caso normal com dx negativo (encolhe a esquerda, cresce a direita)", () => {
    const result = resizeColumnPair(50, 50, -15, 10);
    expect(result).toEqual({ left: 35, right: 65 });
    expect(result.left + result.right).toBe(100);
  });

  it("dx empurra a direita abaixo do mínimo: direita trava no mínimo e a esquerda só recebe o quanto sobrou", () => {
    // direita começa em 20, mínimo 10 -> só há 10mm disponíveis pra ceder,
    // mesmo pedindo um dx de 25mm.
    const result = resizeColumnPair(50, 20, 25, 10);
    expect(result.right).toBe(10);
    expect(result.left).toBe(60); // 50 + (20 - 10), não 50 + 25
    expect(result.left + result.right).toBe(70); // total preservado (50 + 20)
  });

  it("dx negativo empurra a esquerda abaixo do mínimo: esquerda trava no mínimo, direita absorve o resto", () => {
    const result = resizeColumnPair(15, 50, -20, 10);
    expect(result.left).toBe(10);
    expect(result.right).toBe(55); // 50 + (15 - 10)
    expect(result.left + result.right).toBe(65); // total preservado (15 + 50)
  });
});
