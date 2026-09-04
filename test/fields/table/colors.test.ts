import { describe, expect, it } from "vitest";
import { resolveTablePreset, TABLE_PALETTES } from "../../../src/fields/table/colors";

describe("resolveTablePreset", () => {
  it("undefined vira undefined (sem preset escolhido)", () => {
    expect(resolveTablePreset(undefined)).toBeUndefined();
  });

  it('"custom" vira undefined (sinal pra usar os campos manuais em vez de preset)', () => {
    expect(resolveTablePreset("custom")).toBeUndefined();
  });

  it("nome de preset conhecido resolve pro objeto real de TABLE_PALETTES", () => {
    expect(resolveTablePreset("blueLight")).toEqual(TABLE_PALETTES.blueLight);
    expect(resolveTablePreset("blueLight")).toEqual({
      headBackgroundColor: "#ffffff",
      headTextColor: "#1d4ed8",
      bandColor: "#eff6ff",
      borderColor: "#93c5fd",
    });

    expect(resolveTablePreset("default")).toEqual(TABLE_PALETTES.default);
    expect(resolveTablePreset("purpleMedium")).toEqual(TABLE_PALETTES.purpleMedium);
  });

  it("nome desconhecido/obsoleto (template salvo com preset removido) vira undefined sem lançar erro", () => {
    expect(() => resolveTablePreset("nomeQueNaoExisteMais")).not.toThrow();
    expect(resolveTablePreset("nomeQueNaoExisteMais")).toBeUndefined();
  });
});
