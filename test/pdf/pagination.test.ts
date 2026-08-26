import { describe, expect, it } from "vitest";
import { computeTableSlice, needsNewPageForItem } from "../../src/pdf/pagination";

describe("needsNewPageForItem", () => {
  it("quebra página quando o item não cabe e a página já tem algo desenhado", () => {
    expect(needsNewPageForItem(50, 30, 20, 0)).toBe(true);
  });

  it("não quebra se o item cabe no espaço disponível", () => {
    expect(needsNewPageForItem(20, 30, 20, 0)).toBe(false);
  });

  it("não quebra no topo da página mesmo sem caber (evita loop infinito de página vazia)", () => {
    expect(needsNewPageForItem(50, 30, 0, 0)).toBe(false);
  });
});

describe("computeTableSlice", () => {
  it("toda a tabela cabe numa fatia só quando há espaço de sobra", () => {
    const decision = computeTableSlice(5, 100, true, false);
    expect(decision).toMatchObject({ rowsToTake: 5, isLastSlice: true, consumesFooter: false });
  });

  it("fatia parcial quando não cabe tudo — não é a última fatia", () => {
    // 100mm / 7mm por linha - 1 (cabeçalho) = 13 linhas de capacidade.
    const decision = computeTableSlice(50, 100, true, false);
    expect(decision.isLastSlice).toBe(false);
    expect(decision.rowsToTake).toBe(decision.capacity);
    expect(decision.rowsToTake).toBeLessThan(50);
  });

  it("reserva 1 linha pro rodapé só na última fatia", () => {
    const withoutFooter = computeTableSlice(5, 100, true, false);
    const withFooter = computeTableSlice(5, 100, true, true);
    expect(withFooter.consumesFooter).toBe(true);
    expect(withFooter.heightMm).toBe(withoutFooter.heightMm + 7);
  });

  it("capacidade zero quando não sobra espaço nem pro cabeçalho", () => {
    const decision = computeTableSlice(5, 0, true, false);
    expect(decision.capacity).toBe(0);
    expect(decision.rowsToTake).toBe(0);
  });
});
