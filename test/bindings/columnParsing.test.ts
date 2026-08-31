import { describe, expect, it } from "vitest";
import { parseColumnsInput, stringifyColumns } from "../../src/bindings/columnParsing";

describe("parseColumnsInput", () => {
  it("coluna crua (sem '=') fica como string", () => {
    expect(parseColumnsInput("produto")).toEqual(["produto"]);
    expect(parseColumnsInput("produto, qtd")).toEqual(["produto", "qtd"]);
  });

  it("'Rótulo=FÓRMULA' vira {label, formula}, ambos aparados", () => {
    expect(parseColumnsInput("Total (R$) = CURRENCY(total_amount)")).toEqual([
      { label: "Total (R$)", formula: "CURRENCY(total_amount)" },
    ]);
  });

  it("fórmula com vírgula dentro de aspas/parênteses não é quebrada errado (via splitDelimited)", () => {
    expect(parseColumnsInput('Total=CURRENCY(total, "R$", 2)')).toEqual([
      { label: "Total", formula: 'CURRENCY(total, "R$", 2)' },
    ]);
    expect(parseColumnsInput('Nome=CONCAT(a, ", ", b)')).toEqual([
      { label: "Nome", formula: 'CONCAT(a, ", ", b)' },
    ]);
  });

  it("fórmula que contém seu próprio '=' quebra só no PRIMEIRO '='", () => {
    expect(parseColumnsInput("Igual=a == b")).toEqual([{ label: "Igual", formula: "a == b" }]);
  });

  it("mistura de colunas cruas e calculadas na mesma lista", () => {
    expect(parseColumnsInput('produto, Total=CURRENCY(total, "R$", 2)')).toEqual([
      "produto",
      { label: "Total", formula: 'CURRENCY(total, "R$", 2)' },
    ]);
  });
});

describe("stringifyColumns", () => {
  it("coluna crua (string) permanece igual", () => {
    expect(stringifyColumns(["produto", "qtd"])).toBe("produto, qtd");
  });

  it("{label, formula} vira 'label=formula'", () => {
    expect(stringifyColumns([{ label: "Total", formula: "SUM(total)" }])).toBe("Total=SUM(total)");
  });

  it("múltiplas colunas são unidas com ', '", () => {
    expect(stringifyColumns(["produto", { label: "Total", formula: "SUM(total)" }])).toBe("produto, Total=SUM(total)");
  });

  it("round-trip com parseColumnsInput preserva o conteúdo", () => {
    const original = 'produto, Total=CURRENCY(total, "R$", 2)';
    const roundTripped = stringifyColumns(parseColumnsInput(original));
    expect(parseColumnsInput(roundTripped)).toEqual(parseColumnsInput(original));
  });
});
