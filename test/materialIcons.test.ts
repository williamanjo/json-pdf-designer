import { describe, expect, it } from "vitest";
import {
  MATERIAL_ICON_LABELS_EN,
  MATERIAL_ICON_LABELS_PT_BR,
  MATERIAL_ICON_PATHS,
  materialIconLabels,
} from "../src/materialIcons";

describe("materialIconLabels", () => {
  it('"pt-BR" retorna o mapa de rótulos PT-BR', () => {
    expect(materialIconLabels("pt-BR")).toBe(MATERIAL_ICON_LABELS_PT_BR);
  });

  it('qualquer outro locale (ex: "en") retorna o mapa de rótulos EN', () => {
    expect(materialIconLabels("en")).toBe(MATERIAL_ICON_LABELS_EN);
  });
});

describe("integridade de dados — MATERIAL_ICON_PATHS vs mapas de rótulo", () => {
  it("toda chave de MATERIAL_ICON_PATHS tem entrada correspondente em AMBOS os mapas de rótulo, e vice-versa", () => {
    const pathKeys = new Set(Object.keys(MATERIAL_ICON_PATHS));
    const enKeys = new Set(Object.keys(MATERIAL_ICON_LABELS_EN));
    const ptBrKeys = new Set(Object.keys(MATERIAL_ICON_LABELS_PT_BR));

    expect(enKeys).toEqual(pathKeys);
    expect(ptBrKeys).toEqual(pathKeys);
  });
});
