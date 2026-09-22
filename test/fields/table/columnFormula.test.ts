import { describe, expect, it } from "vitest";
import { buildColumnFormula, displayCell, parseColumnFormula } from "../../../src/fields/table/columnFormula";

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

describe("displayCell — os brackets são gravados, mas não mostrados", () => {
  // The bracketed form is what stays in the data (explicit, unambiguous). In
  // the canvas cell it is noise: in a 68-column table that is 68 pairs of
  // brackets to read. Here it is only drawing — the data does not change.
  it("path bracketado simples vira a forma curta", () => {
    expect(displayCell("{[id]}")).toBe("{id}");
  });

  it("segmento com quotes perde as quotes junto", () => {
    expect(displayCell('{["token name"]}')).toBe("{token name}");
    expect(displayCell("{['a b']}")).toBe("{a b}");
  });

  it("cadeia de segmentos vira o caminho com ponto", () => {
    expect(displayCell("{[cliente].[nome]}")).toBe("{cliente.nome}");
  });

  it("função com argumento bracketado esconde os dois", () => {
    expect(displayCell('{CURRENCY([total], "R$", 2)}')).toBe("{total}");
  });

  it("conta com path bracketado fica legível", () => {
    expect(displayCell("{[total] + 1}")).toBe("{total + 1}");
  });

  it("ponto LITERAL dentro do bracket sai igual ao caminho — e é só display", () => {
    // `{[a.b]}` (a literal key) and `{[a].[b]}` (a path) both draw as
    // `{a.b}`. That is acceptable because this does not go back into storage:
    // reconstructing from the drawing is exactly the ambiguity brackets resolve.
    expect(displayCell("{[a.b]}")).toBe("{a.b}");
    expect(displayCell("{[a].[b]}")).toBe("{a.b}");
  });

  it("sem brackets, devolve a célula intacta", () => {
    expect(displayCell("{id}")).toBe("{id}");
    expect(displayCell("PNR0000")).toBe("PNR0000");
    expect(displayCell("FAT-{[fatura]}")).toBe("FAT-{[fatura]}");
  });
});
