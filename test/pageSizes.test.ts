import { describe, expect, it } from "vitest";
import { applyOrientation, matchPreset, orientationOf, PAGE_SIZE_PRESETS } from "../src/pageSizes";

describe("orientationOf", () => {
  it("width > height é landscape", () => {
    expect(orientationOf({ width: 297, height: 210 })).toBe("landscape");
  });

  it("width <= height é portrait (inclui quadrado)", () => {
    expect(orientationOf({ width: 210, height: 297 })).toBe("portrait");
    expect(orientationOf({ width: 100, height: 100 })).toBe("portrait");
  });
});

describe("applyOrientation", () => {
  it("normaliza pra retrato antes de decidir (entrada já landscape, pedindo portrait)", () => {
    // size chega em landscape (420x297) mas base é o preset a3 (297x420)
    expect(applyOrientation({ width: 420, height: 297 }, "portrait")).toEqual({ width: 297, height: 420 });
  });

  it("inverte width/height só quando orientation pedida é landscape", () => {
    expect(applyOrientation({ width: 210, height: 297 }, "landscape")).toEqual({ width: 297, height: 210 });
  });

  it("não inverte quando orientation pedida é portrait e size já é portrait", () => {
    expect(applyOrientation({ width: 210, height: 297 }, "portrait")).toEqual({ width: 210, height: 297 });
  });

  it("é idempotente quando o size já está na orientação certa", () => {
    const landscape = { width: 297, height: 210 };
    expect(applyOrientation(landscape, "landscape")).toEqual(landscape);

    const portrait = { width: 210, height: 297 };
    expect(applyOrientation(portrait, "portrait")).toEqual(portrait);
  });
});

describe("matchPreset", () => {
  it("bate exatamente com um preset em retrato pelo nome", () => {
    expect(matchPreset({ width: 210, height: 297 })).toBe("a4");
  });

  it("bate quando as dimensões são a forma invertida/landscape de um preset", () => {
    expect(matchPreset({ width: 297, height: 210 })).toBe("a4");
    expect(matchPreset({ width: 420, height: 297 })).toBe("a3");
  });

  it("usa a tolerância numérica exata (< 0.5) pra quase-igualdade", () => {
    // dentro da tolerância (diff 0.49 < 0.5) -> bate
    expect(matchPreset({ width: 210.49, height: 297 })).toBe("a4");
    // exatamente no limite (diff 0.5, não é < 0.5) -> não bate
    expect(matchPreset({ width: 210.5, height: 297 })).toBeUndefined();
  });

  it("tamanho genuinamente customizado não bate com nenhum preset", () => {
    expect(matchPreset({ width: 123, height: 456 })).toBeUndefined();
  });

  it("sanity: todos os presets declarados batem consigo mesmos", () => {
    for (const preset of PAGE_SIZE_PRESETS) {
      expect(matchPreset(preset.size)).toBe(preset.name);
    }
  });
});
