import { describe, it, expect } from "vitest";
import { braceError, tokenAtCaret } from "../../src/expressions/templateText";
import { renderTemplate } from "../../src/bindings/bindings";
import { ptBR } from "../../src/i18n/locales/pt-BR";

describe("tokenAtCaret", () => {
  it("dentro das chaves devolve o conteúdo e onde ele começa", () => {
    // "FAT-{fatura}" — caret no meio de "fatura"
    const span = tokenAtCaret("FAT-{fatura}", 8);
    expect(span).toEqual({ start: 5, end: 11, inner: "fatura" });
  });

  it("no texto literal devolve null", () => {
    // É o que faz o autocomplete não sugerir função onde é só texto.
    expect(tokenAtCaret("FAT-{fatura}", 2)).toBeNull();
    expect(tokenAtCaret("FAT-{fatura} fim", 14)).toBeNull();
    expect(tokenAtCaret("", 0)).toBeNull();
  });

  it("logo depois da abertura já conta como dentro", () => {
    expect(tokenAtCaret("{", 1)).toEqual({ start: 1, end: 1, inner: "" });
  });

  it("antes da abertura ainda é fora", () => {
    expect(tokenAtCaret("{a}", 0)).toBeNull();
  });

  it("chave sem fechar vai até o fim", () => {
    expect(tokenAtCaret("FAT-{CURRENCY(total", 19)).toEqual({ start: 5, end: 19, inner: "CURRENCY(total" });
  });

  it("chave sem fechar para na abertura seguinte, sem engolir o token de baixo", () => {
    const span = tokenAtCaret("{a {b}", 2);
    expect(span?.inner).toBe("a ");
  });

  it("segundo token é o do caret, não o primeiro", () => {
    const span = tokenAtCaret("{a} e {b}", 7);
    expect(span).toEqual({ start: 7, end: 8, inner: "b" });
  });
});

describe("braceError", () => {
  it("template balanceado não tem erro", () => {
    for (const ok of ["", "sem chave nenhuma", "FAT-{fatura}", "{a} e {b}", "{CURRENCY(total, \"R$\")}"]) {
      expect(braceError(ok), ok).toBeNull();
    }
  });

  it("acusa chave aberta e não fechada, com a posição", () => {
    // O caso que passava batido: o resolvedor casa /\{([^{}]+)\}/g, então um
    // "{" sem par não casa e o trecho sai como TEXTO no PDF.
    const message = braceError("FAT-{CURRENCY(total");
    expect(message).toContain("4");
    expect(message).toMatch(/never closed/i);
  });

  it("acusa fechamento sem abertura", () => {
    expect(braceError("fatura}")).toMatch(/no "\{" opening/i);
  });

  it("acusa chave dentro de chave", () => {
    expect(braceError("{a {b}")).toMatch(/inside another/i);
  });

  it("segue o idioma do dicionário", () => {
    expect(braceError("FAT-{fatura", ptBR)).toContain("nunca fecha");
  });

  it("é exatamente o caso que renderiza literal", () => {
    // Prova de que o aviso não é teórico: sem o fechamento, o texto sai cru.
    const data = { fatura: "123" };
    expect(renderTemplate("FAT-{fatura", data)).toBe("FAT-{fatura");
    expect(braceError("FAT-{fatura")).not.toBeNull();
    expect(renderTemplate("FAT-{fatura}", data)).toBe("FAT-123");
    expect(braceError("FAT-{fatura}")).toBeNull();
  });
});
