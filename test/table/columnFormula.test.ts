import { describe, expect, it } from "vitest";
import { buildColumnFormula, displayCell, parseColumnFormula } from "../../src/table/columnFormula";

describe("parseColumnFormula / buildColumnFormula round-trip", () => {
  it("string vazia vira {kind: empty} e build com path vazio devolve string vazia", () => {
    expect(parseColumnFormula("")).toEqual({ kind: "empty" });
    expect(parseColumnFormula("   ")).toEqual({ kind: "empty" });
    expect(buildColumnFormula("CURRENCY", "", "R$", "2", "", "")).toBe("");
    expect(buildColumnFormula("", "", "", "", "", "")).toBe("");
  });

  it("CURRENCY: build gera {CURRENCY(path, \"symbol\", decimals)} e parse decompõe de volta", () => {
    const formula = buildColumnFormula("CURRENCY", "preco", "R$", "2", "", "");
    expect(formula).toBe('{CURRENCY(preco, "R$", 2)}');

    const parsed = parseColumnFormula(formula);
    expect(parsed).toEqual({
      kind: "func",
      fn: "CURRENCY",
      path: "preco",
      symbol: "R$",
      decimals: "2",
      outFormat: "",
      inFormat: "",
    });
  });

  it("CURRENCY com símbolo/decimais customizados também sobrevive ao round-trip", () => {
    const formula = buildColumnFormula("CURRENCY", "rows.total", "US$", "0", "", "");
    expect(formula).toBe('{CURRENCY(rows.total, "US$", 0)}');
    expect(parseColumnFormula(formula)).toEqual({
      kind: "func",
      fn: "CURRENCY",
      path: "rows.total",
      symbol: "US$",
      decimals: "0",
      outFormat: "",
      inFormat: "",
    });
  });

  it("NUMBER: build gera {NUMBER(path, decimals)} e parse decompõe de volta", () => {
    const formula = buildColumnFormula("NUMBER", "quantidade", "", "3", "", "");
    expect(formula).toBe("{NUMBER(quantidade, 3)}");

    const parsed = parseColumnFormula(formula);
    expect(parsed).toEqual({
      kind: "func",
      fn: "NUMBER",
      path: "quantidade",
      symbol: "",
      decimals: "3",
      outFormat: "",
      inFormat: "",
    });
  });

  it("DATE: build gera {DATE(path, \"outFormat\", \"inFormat\")} e parse decompõe de volta", () => {
    const formula = buildColumnFormula("DATE", "dataEmissao", "", "", "DD/MM/YYYY", "YYYY-MM-DD");
    expect(formula).toBe('{DATE(dataEmissao, "DD/MM/YYYY", "YYYY-MM-DD")}');

    const parsed = parseColumnFormula(formula);
    expect(parsed).toEqual({
      kind: "func",
      fn: "DATE",
      path: "dataEmissao",
      symbol: "",
      decimals: "",
      outFormat: "DD/MM/YYYY",
      inFormat: "YYYY-MM-DD",
    });
  });

  it("DATE sem inFormat omite o terceiro argumento e parse devolve inFormat vazio", () => {
    const formula = buildColumnFormula("DATE", "dataEmissao", "", "", "YYYY-MM-DD", "");
    expect(formula).toBe('{DATE(dataEmissao, "YYYY-MM-DD")}');

    const parsed = parseColumnFormula(formula);
    expect(parsed).toEqual({
      kind: "func",
      fn: "DATE",
      path: "dataEmissao",
      symbol: "",
      decimals: "",
      outFormat: "YYYY-MM-DD",
      inFormat: "",
    });
  });

  it("path nu (sem função): build gera {path} e parse devolve kind bare", () => {
    const formula = buildColumnFormula("", "cliente.nome", "", "", "", "");
    expect(formula).toBe("{cliente.nome}");
    expect(parseColumnFormula(formula)).toEqual({ kind: "bare", path: "cliente.nome" });
  });

  it('fórmula com prefixo literal misturado (ex: "FAT-{fatura}") cai pra "raw"', () => {
    expect(parseColumnFormula("FAT-{fatura}")).toEqual({ kind: "raw" });
  });

  it("texto solto sem chaves também cai pra raw", () => {
    expect(parseColumnFormula("apenas texto sem chaves")).toEqual({ kind: "raw" });
  });
});

describe("displayCell", () => {
  it("token com função vira só {path}, escondendo a chamada", () => {
    expect(displayCell('{CURRENCY(tarKandir, "R$", 2)}')).toBe("{tarKandir}");
    expect(displayCell("{NUMBER(quantidade, 3)}")).toBe("{quantidade}");
    expect(displayCell('{DATE(dataEmissao, "DD/MM/YYYY", "YYYY-MM-DD")}')).toBe("{dataEmissao}");
  });

  it("texto simples (sem chaves) permanece igual", () => {
    expect(displayCell("texto qualquer")).toBe("texto qualquer");
    expect(displayCell("")).toBe("");
  });

  it('prefixo literal misturado com token (ex: "FAT-{fatura}") permanece igual', () => {
    expect(displayCell("FAT-{fatura}")).toBe("FAT-{fatura}");
  });
});
