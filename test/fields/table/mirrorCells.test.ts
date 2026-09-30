import { describe, it, expect } from "vitest";
import { mirrorCellsToArrayBinding } from "../../../src/fields/table/columns";
import type { Binding } from "../../../src/types";

type ArrayBinding = Extract<Binding, { type: "array" }>;

// The table cell IS the column's formula — `generate.ts` resolves the row
// from `schema.content`. Editing the cell on the canvas wrote only the
// content, and the "ƒx" panel kept showing the binding's old formula: two
// values for the same thing, with the panel's being the one that does NOT
// come out in the PDF.

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
    // The columns that did not change stay identical — including the raw column.
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
    // With no formula, what is left is the raw path behind the previous cell
    // — and "FAT-{fatura}" is not a lone token, so `extractColumnPath` does
    // not decompose it and the fallback is the header. The same chain as the
    // ƒx (computeColumnFormulaCell), on purpose.
    expect(columns?.[0]).toBe("Fatura");
  });

  it("não estoura com content mais curto que as colunas", () => {
    expect(mirrorCellsToArrayBinding(binding, HEAD, undefined, undefined)).toBeNull();
    const columns = mirrorCellsToArrayBinding(binding, HEAD, undefined, ["{z}"]);
    expect(columns?.[0]).toEqual({ label: "Fatura", formula: "{z}" });
    expect(columns).toHaveLength(3);
  });
});
