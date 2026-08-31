import { describe, expect, it } from "vitest";
import { CHART_PALETTES, resolveChartColors, resolveChartPalette } from "../../src/chart/colors";

describe("resolveChartPalette", () => {
  it("nome desconhecido cai pra CHART_PALETTES.default", () => {
    expect(resolveChartPalette("nomeQueNaoExiste")).toEqual(CHART_PALETTES.default);
  });

  it("undefined cai pra CHART_PALETTES.default", () => {
    expect(resolveChartPalette(undefined)).toEqual(CHART_PALETTES.default);
  });

  it("nome conhecido retorna o array correspondente", () => {
    expect(resolveChartPalette("classic")).toEqual(CHART_PALETTES.classic);
    expect(resolveChartPalette("vibrant")).toEqual(CHART_PALETTES.vibrant);
  });
});

describe("resolveChartColors", () => {
  it('"custom" com customColors não-vazio retorna customColors como estão', () => {
    const customColors = ["#111111", "#222222", "#333333"];
    expect(resolveChartColors("custom", customColors)).toEqual(customColors);
    expect(resolveChartColors("custom", customColors)).toBe(customColors);
  });

  it('"custom" com customColors vazio cai pro duplo fallback: resolveChartPalette("custom") -> CHART_PALETTES.default', () => {
    // "custom" não é chave de CHART_PALETTES, então resolveChartPalette("custom")
    // já cai sozinho pro default — resolveChartColors precisa preservar isso.
    expect(resolveChartPalette("custom")).toEqual(CHART_PALETTES.default);
    expect(resolveChartColors("custom", [])).toEqual(CHART_PALETTES.default);
  });

  it('"custom" com customColors undefined cai pro mesmo duplo fallback (CHART_PALETTES.default)', () => {
    expect(resolveChartColors("custom", undefined)).toEqual(CHART_PALETTES.default);
  });

  it("nome de preset normal (não custom) ignora customColors e usa o preset", () => {
    const customColors = ["#111111"];
    expect(resolveChartColors("classic", customColors)).toEqual(CHART_PALETTES.classic);
  });
});
