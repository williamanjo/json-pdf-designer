import { describe, it, expect } from "vitest";
import {
  ALL_SUGGESTIONS,
  applySuggestion,
  insertAtCaret,
  suggestAt,
  wordAtCaret,
  type Suggestion,
} from "../../src/expressions/suggest";
import { CUSTOM_FIELD_FUNCTIONS } from "../../src/bindings/bindings";
import { expressionError } from "../../src/expressions/resolve";
import { suspiciousOperator } from "../../src/expressions/suspicious";
import { en } from "../../src/i18n/locales/en";
import { ptBR } from "../../src/i18n/locales/pt-BR";

const byName = (name: string): Suggestion => {
  const found = ALL_SUGGESTIONS.find((s) => s.name === name);
  if (!found) throw new Error(`sem sugestão ${name}`);
  return found;
};

describe("a lista de sugestões", () => {
  it("cobre exatamente as funções do formato mais AND/OR/NOT", () => {
    // Se uma função entrar em CUSTOM_FIELD_FUNCTIONS sem aparecer aqui, o
    // autocomplete fica desatualizado em silêncio.
    expect(ALL_SUGGESTIONS.map((s) => s.name)).toEqual([
      ...CUSTOM_FIELD_FUNCTIONS.map((f) => f.name),
      "AND",
      "OR",
      "NOT",
    ]);
  });

  it("função abre parêntese e carrega a chave da dica", () => {
    // A sugestão leva a CHAVE, não o texto: `suggestAt` é puro e não recebe
    // idioma; quem desenha a lista resolve com o `t` que tem à mão.
    const sum = byName("SUM");
    expect(sum.insert).toBe("SUM(");
    expect(sum.hintKey).toBe("sum");
    expect(en.fieldFunctionSnippets[sum.hintKey!]).toBe("SUM(path.column)");
    expect(ptBR.fieldFunctionSnippets[sum.hintKey!]).toBe("SUM(caminho.coluna)");
  });

  it("operador leva espaço e não tem dica", () => {
    expect(byName("AND").insert).toBe("AND ");
    expect(byName("AND").hintKey).toBeUndefined();
  });
});

describe("wordAtCaret", () => {
  it("pega a palavra até o caret, não a palavra inteira", () => {
    // O que já foi digitado é o que filtra; o que vem depois do caret não.
    expect(wordAtCaret("SUMO", 3)).toEqual({ word: "SUM", start: 0, end: 4 });
  });

  it("vazio no começo e depois de pontuação", () => {
    expect(wordAtCaret("", 0).word).toBe("");
    expect(wordAtCaret("SUM(", 4).word).toBe("");
    expect(wordAtCaret("CONCAT(a, ", 10).word).toBe("");
  });

  it("para no ponto — caminho de dado não é nome de função", () => {
    expect(wordAtCaret("faturas.tot", 11)).toEqual({ word: "tot", start: 8, end: 11 });
  });
});

describe("suggestAt", () => {
  it("sem palavra parcial, não sugere nada", () => {
    // A lista abre ao DIGITAR. Despejar as 14 sugestões só porque o cursor
    // entrou num campo vazio (ou passou de um "(") tapa o editor.
    expect(suggestAt("", 0)).toEqual([]);
    expect(suggestAt("SUM(", 4)).toEqual([]);
    expect(suggestAt("CONCAT(a, ", 10)).toEqual([]);
  });

  it("filtra por prefixo, sem ligar pra caixa", () => {
    expect(suggestAt("su", 2).map((s) => s.name)).toEqual(["SUM"]);
    // Ordem é a de CUSTOM_FIELD_FUNCTIONS, não alfabética.
    expect(suggestAt("C", 1).map((s) => s.name)).toEqual(["COUNT", "CONCAT", "CURRENCY"]);
    expect(suggestAt("N", 1).map((s) => s.name)).toEqual(["NUMBER", "NOT"]);
  });

  it("prefixo sem nada não sugere", () => {
    expect(suggestAt("zzz", 3)).toEqual([]);
  });

  it("não sugere dentro de aspas", () => {
    // Ali é texto literal: sugerir SUM no meio de CONCAT("Total s… estorva.
    expect(suggestAt('CONCAT("su', 10)).toEqual([]);
    // Aspas fechadas: volta a sugerir.
    expect(suggestAt('CONCAT("total", su', 18).map((s) => s.name)).toEqual(["SUM"]);
  });
});

describe("applySuggestion", () => {
  it("troca a palavra parcial e devolve o caret dentro do parêntese", () => {
    const { text, caret } = applySuggestion("su", 2, byName("SUM"));
    expect(text).toBe("SUM(");
    expect(caret).toBe(4);
  });

  it("não come o que vem depois do caret", () => {
    const { text, caret } = applySuggestion("cu(total) + 1", 2, byName("CURRENCY"));
    expect(text).toBe("CURRENCY((total) + 1");
    expect(caret).toBe(9);
  });

  it("operador ganha o espaço da esquerda que falta", () => {
    // Sem isto o autocomplete produziria o próprio defeito que
    // suspiciousOperator existe pra avisar: "pagoAND" ou "pago AND" grudado.
    const { text } = applySuggestion("pago an", 7, byName("AND"));
    expect(text).toBe("pago AND ");
    expect(suspiciousOperator(`${text}ativo`)).toBeNull();
  });

  it("não duplica espaço quando já tem um", () => {
    expect(applySuggestion("pago ", 5, byName("AND")).text).toBe("pago AND ");
  });

  it("o resultado de compor pelas sugestões é sintaticamente válido", () => {
    let state = { text: "", caret: 0 };
    state = applySuggestion(state.text, state.caret, byName("SUM"));
    state = insertAtCaret(state.text, state.caret, "faturas.total");
    state = insertAtCaret(state.text, state.caret, ")");
    expect(state.text).toBe("SUM(faturas.total)");
    expect(expressionError(state.text)).toBeNull();
  });
});

describe("insertAtCaret", () => {
  it("insere no meio sem trocar a palavra em volta", () => {
    const { text, caret } = insertAtCaret("SUM()", 4, "total");
    expect(text).toBe("SUM(total)");
    expect(caret).toBe(9);
  });
});
