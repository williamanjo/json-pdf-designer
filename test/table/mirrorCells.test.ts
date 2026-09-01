import { describe, it, expect } from "vitest";
import { mirrorCellsToArrayBinding } from "../../src/table/columns";
import type { Binding } from "../../src/types";

type ArrayBinding = Extract<Binding, { type: "array" }>;

// A célula da tabela É a fórmula da coluna — `generate.ts` resolve a linha a
// partir de `schema.content`. Editar a célula no canvas gravava só o content,
// e o painel "ƒx" seguia mostrando a fórmula antiga do vínculo: dois valores
// pra mesma coisa, com o do painel sendo o que NÃO sai no PDF.

const HEAD = ["Fatura", "Vencto.", "Total"];

const binding: ArrayBinding = {
  schemaName: "tabela",
  type: "array",
  path: "faturas",
  columns: [{ label: "Fatura", formula: "FAT-{fatura}" }, "vencto", { label: "Total", formula: "{CURRENCY(total)}" }],
};

describe("mirrorCellsToArrayBinding", () => {
  it("leva a célula editada pra fórmula da coluna", () => {
    const columns = mirrorCellsToArrayBinding(binding, HEAD, ["FAT-{fatura}", "{vencto}", "{CURRENCY(total)}"], [
      "FAT-{fatura /}",
      "{vencto}",
      "{CURRENCY(total)}",
    ]);
    expect(columns?.[0]).toEqual({ label: "Fatura", formula: "FAT-{fatura /}" });
    // As colunas que não mudaram ficam idênticas — incluindo a coluna crua.
    expect(columns?.[1]).toBe("vencto");
    expect(columns?.[2]).toEqual({ label: "Total", formula: "{CURRENCY(total)}" });
  });

  it("devolve null quando nada mudou", () => {
    const same = ["FAT-{fatura}", "{vencto}", "{CURRENCY(total)}"];
    expect(mirrorCellsToArrayBinding(binding, HEAD, same, [...same])).toBeNull();
  });

  it("espelha mais de uma célula na mesma mudança", () => {
    const columns = mirrorCellsToArrayBinding(binding, HEAD, ["a", "b", "c"], ["{x}", "b", "{y}"]);
    expect(columns?.[0]).toEqual({ label: "Fatura", formula: "{x}" });
    expect(columns?.[2]).toEqual({ label: "Total", formula: "{y}" });
  });

  it("célula limpa volta a ser coluna crua, igual o ƒx", () => {
    const columns = mirrorCellsToArrayBinding(binding, HEAD, ["FAT-{fatura}", "{vencto}", "{CURRENCY(total)}"], [
      "",
      "{vencto}",
      "{CURRENCY(total)}",
    ]);
    // Sem fórmula, sobra o path cru por trás da célula anterior — e
    // "FAT-{fatura}" não é um token isolado, então `extractColumnPath` não
    // decompõe e o fallback é o cabeçalho. Mesma cadeia do ƒx
    // (computeColumnFormulaCell), de propósito.
    expect(columns?.[0]).toBe("Fatura");
  });

  it("não estoura com content mais curto que as colunas", () => {
    expect(mirrorCellsToArrayBinding(binding, HEAD, undefined, undefined)).toBeNull();
    const columns = mirrorCellsToArrayBinding(binding, HEAD, undefined, ["{z}"]);
    expect(columns?.[0]).toEqual({ label: "Fatura", formula: "{z}" });
    expect(columns).toHaveLength(3);
  });
});
