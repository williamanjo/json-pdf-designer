import { describe, expect, it } from "vitest";
import { formatPtBrNumber } from "../src/numberFormat";

describe("formatPtBrNumber", () => {
  it("opções default: 2 casas forçadas, agrupamento de milhar ligado", () => {
    expect(formatPtBrNumber(1000)).toBe("1.000,00");
  });

  it("decimals: 0 corta as casas decimais", () => {
    expect(formatPtBrNumber(1000.4, { decimals: 0 })).toBe("1.000");
  });

  it("forceDecimals: false num inteiro não força casas (fica sem vírgula)", () => {
    expect(formatPtBrNumber(1000, { forceDecimals: false })).toBe("1.000");
  });

  it("forceDecimals: false num valor fracionário ainda mostra as casas que existem (até o máximo)", () => {
    expect(formatPtBrNumber(1000.5, { forceDecimals: false })).toBe("1.000,5");
  });

  it("grouping: false remove o separador de milhar", () => {
    expect(formatPtBrNumber(1000, { grouping: false })).toBe("1000,00");
  });

  it("números negativos mantêm o sinal", () => {
    expect(formatPtBrNumber(-1000)).toBe("-1.000,00");
    expect(formatPtBrNumber(-1000, { decimals: 0 })).toBe("-1.000");
  });
});
