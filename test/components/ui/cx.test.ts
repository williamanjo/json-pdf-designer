import { describe, expect, it } from "vitest";
import { cx, mergeStyle, readPart } from "../../../src/components/ui/cx";

describe("cx", () => {
  it("junta na ordem recebida — classe própria primeiro, do consumidor por último", () => {
    expect(cx("jpd-btn", "minha-classe")).toBe("jpd-btn minha-classe");
  });

  it("descarta falsy (undefined/null/false/string vazia)", () => {
    expect(cx("jpd-btn", undefined, null, false, "")).toBe("jpd-btn");
  });

  it("devolve undefined quando nada sobra, pro React omitir o atributo", () => {
    // Se devolvesse "", o markup sairia com `class=""`.
    expect(cx()).toBeUndefined();
    expect(cx(undefined, false, "")).toBeUndefined();
  });

  it("deduplica token repetido, primeira ocorrência vence", () => {
    expect(cx("jpd-btn jpd-row", "jpd-btn")).toBe("jpd-btn jpd-row");
  });

  it("é idempotente — passar o resultado de volta não muda nada", () => {
    // É o que garante asserção estável de markup quando a composição passa
    // pelo cx duas vezes (ClearFieldButton -> Button, ou um adapter de slot
    // que embrulha o nosso próprio componente).
    const once = cx("jpd-btn", "minha");
    expect(cx(once)).toBe(once);
    expect(cx(once, "minha")).toBe(once);
  });

  it("normaliza espaço extra dentro de uma mesma string", () => {
    expect(cx("  jpd-btn   jpd-row  ")).toBe("jpd-btn jpd-row");
  });
});

describe("mergeStyle", () => {
  it("style do consumidor ganha do nosso", () => {
    expect(mergeStyle({ opacity: 0.5, zIndex: 1 }, { opacity: 1 })).toEqual({ opacity: 1, zIndex: 1 });
  });

  it("devolve o outro lado intacto quando um dos dois falta", () => {
    const own = { opacity: 0.5 };
    const incoming = { zIndex: 3 };
    expect(mergeStyle(own, undefined)).toBe(own);
    expect(mergeStyle(undefined, incoming)).toBe(incoming);
    expect(mergeStyle(undefined, undefined)).toBeUndefined();
  });
});

describe("readPart", () => {
  it("aceita o atalho de string", () => {
    expect(readPart("minha-classe")).toEqual({ className: "minha-classe" });
  });

  it("aceita a forma de objeto, pra quando precisa de style", () => {
    const part = { className: "x", style: { gap: 4 } };
    expect(readPart(part)).toBe(part);
  });

  it("parte ausente vira objeto vazio — o chamador não precisa de guarda", () => {
    expect(readPart(undefined)).toEqual({});
    // String vazia é "sem classe", não classe "".
    expect(readPart("")).toEqual({});
  });

  it("compõe com cx/mergeStyle sem caso especial", () => {
    const { className, style } = readPart({ className: "minha", style: { zIndex: 2 } });
    expect(cx("jpd-field__label", className)).toBe("jpd-field__label minha");
    expect(mergeStyle({ zIndex: 1, opacity: 0.5 }, style)).toEqual({ zIndex: 2, opacity: 0.5 });
  });
});
