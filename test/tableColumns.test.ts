import { describe, expect, it } from "vitest";
import {
  addColumnToArrayBinding,
  addColumnToTable,
  applyColumnCellToTable,
  buildColumnCell,
  computeColumnFormulaCell,
  extractColumnPath,
  reindexArrayBindingForNewHead,
  reindexTableForNewHead,
  removeColumnFromArrayBinding,
  removeColumnFromTable,
  reorderArrayBindingColumns,
  reorderTableColumn,
  setColumnFormulaOnArrayBinding,
  setColumnStyle,
} from "../src/tableColumns";
import type { Binding, TableSchema } from "../src/types";

function makeTable(overrides: Partial<TableSchema> = {}): TableSchema {
  return {
    id: "t1",
    name: "tabela",
    type: "table",
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    head: ["a", "b"],
    content: [["1", "2"]],
    ...overrides,
  };
}

describe("reindexTableForNewHead / reindexArrayBindingForNewHead — bug real de índice vs nome", () => {
  // Regressão do bug documentado: reduzir de 9 pra 1 coluna ("fatura", que
  // era a 3ª/índice 2) não podia pegar o índice 0 ("orgao") por engano.
  it("reduzir de várias colunas pra uma só busca pelo NOME, não pela posição", () => {
    const oldHead = ["orgao", "processo", "fatura", "valor"];
    const table = makeTable({ head: oldHead, content: [["ORG1", "PROC1", "FAT1", "VAL1"]] });
    const binding: Extract<Binding, { type: "array" }> = {
      schemaName: "tabela",
      type: "array",
      path: "rows",
      columns: ["orgao", "processo", "fatura", "valor"],
    };

    const newTable = reindexTableForNewHead(table, ["fatura"]);
    expect(newTable.content).toEqual([["FAT1"]]);

    const newColumns = reindexArrayBindingForNewHead(binding, oldHead, ["fatura"]);
    expect(newColumns).toEqual(["fatura"]);
  });

  it("nome novo sem correspondência antiga vira coluna crua/vazia", () => {
    const oldHead = ["a", "b"];
    const table = makeTable({ head: oldHead, content: [["1", "2"]] });
    const newTable = reindexTableForNewHead(table, ["a", "novaColuna"]);
    expect(newTable.content).toEqual([["1", ""]]);
  });
});

describe("addColumnToTable / addColumnToArrayBinding — cliques em sequência não se atropelam", () => {
  it("duas adições em SEQUÊNCIA (cada uma sobre o resultado fresco da anterior) preservam as duas", () => {
    // Simula exatamente o que o onChangeTemplate/onChangeBindings funcional
    // do Designer.tsx garante: a 2ª chamada sempre parte do resultado real
    // da 1ª (nunca de uma cópia velha) — por isso os dois clientes clicando
    // rápido em "+" (colunas diferentes) nunca perdem um pro outro.
    let table = makeTable({ head: ["a"], content: [["1"]] });
    const first = addColumnToTable(table, "b", "{b}");
    expect(first).not.toBeNull();
    table = first!;
    const second = addColumnToTable(table, "c", "{c}");
    expect(second).not.toBeNull();
    table = second!;
    expect(table.head).toEqual(["a", "b", "c"]);
    expect(table.content).toEqual([["1", "{b}", "{c}"]]);
  });

  it("não adiciona coluna já presente no head (no-op)", () => {
    const table = makeTable({ head: ["a", "b"] });
    expect(addColumnToTable(table, "b", "{b}")).toBeNull();
  });

  it("coluna numérica já nasce formatada como CURRENCY", () => {
    expect(buildColumnCell("preco", "number")).toBe('{CURRENCY(preco, "R$", 2)}');
    expect(buildColumnCell("nome", "string")).toBe("{nome}");
    expect(buildColumnCell("nome", undefined)).toBe("{nome}");
  });

  it("addColumnToArrayBinding não duplica por label", () => {
    const binding: Extract<Binding, { type: "array" }> = { schemaName: "t", type: "array", path: "rows", columns: ["a"] };
    expect(addColumnToArrayBinding(binding, "a", "a")).toBeNull();
    expect(addColumnToArrayBinding(binding, "b", "b")).toEqual(["a", "b"]);
  });
});

describe("removeColumnFromTable / removeColumnFromArrayBinding — por índice vs por nome", () => {
  it("remove do head/content por índice, do vínculo por NOME", () => {
    const table = makeTable({ head: ["orgao", "fatura"], content: [["ORG1", "FAT1"]] });
    const { table: newTable, removedName } = removeColumnFromTable(table, 0);
    expect(removedName).toBe("orgao");
    expect(newTable.head).toEqual(["fatura"]);
    expect(newTable.content).toEqual([["FAT1"]]);

    const binding: Extract<Binding, { type: "array" }> = {
      schemaName: "t",
      type: "array",
      path: "rows",
      columns: ["orgao", "fatura"],
    };
    expect(removeColumnFromArrayBinding(binding, removedName)).toEqual(["fatura"]);
  });
});

describe("reorderTableColumn / reorderArrayBindingColumns", () => {
  it("move head/content/binding juntos quando o tamanho bate", () => {
    const table = makeTable({ head: ["a", "b", "c"], content: [["1", "2", "3"]] });
    const newTable = reorderTableColumn(table, 0, 2);
    expect(newTable.head).toEqual(["b", "c", "a"]);
    expect(newTable.content).toEqual([["2", "3", "1"]]);

    const binding: Extract<Binding, { type: "array" }> = { schemaName: "t", type: "array", path: "r", columns: ["a", "b", "c"] };
    expect(reorderArrayBindingColumns(binding, 3, 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("não reordena o vínculo se o tamanho não bate com o head (evita embaralhar errado)", () => {
    const binding: Extract<Binding, { type: "array" }> = { schemaName: "t", type: "array", path: "r", columns: ["a", "b"] };
    expect(reorderArrayBindingColumns(binding, 3, 0, 2)).toBeNull();
  });
});

describe("setColumnStyle", () => {
  it("mescla o patch no índice sem mexer nos outros", () => {
    const table = makeTable({ head: ["a", "b"] });
    const withStyle = setColumnStyle(table, 1, { headBackgroundColor: "#fff" });
    expect(withStyle.columnStyles?.[0]).toBeUndefined();
    expect(withStyle.columnStyles?.[1]).toEqual({ headBackgroundColor: "#fff" });
  });
});

describe("extractColumnPath / computeColumnFormulaCell / setColumnFormulaOnArrayBinding", () => {
  it("extrai o path cru de um token simples ou de uma chamada de função", () => {
    expect(extractColumnPath("{fatura}")).toBe("fatura");
    expect(extractColumnPath('{CURRENCY(fatura, "R$", 2)}')).toBe("fatura");
    expect(extractColumnPath("texto livre sem chave")).toBeUndefined();
  });

  it("fórmula vazia volta pro path cru (fallback do cabeçalho)", () => {
    const { cell, rawPath } = computeColumnFormulaCell("", '{CURRENCY(fatura, "R$", 2)}', "fatura");
    expect(rawPath).toBe("fatura");
    expect(cell).toBe("{fatura}");
  });

  it("fórmula nova vira a célula literal", () => {
    const { cell } = computeColumnFormulaCell('{UPPER(nome)}', undefined, "nome");
    expect(cell).toBe("{UPPER(nome)}");
  });

  it("setColumnFormulaOnArrayBinding grava {label, formula} ou volta a path cru", () => {
    const binding: Extract<Binding, { type: "array" }> = { schemaName: "t", type: "array", path: "r", columns: ["fatura"] };
    const withFormula = setColumnFormulaOnArrayBinding(binding, 0, "{UPPER(fatura)}", "fatura", "fatura");
    expect(withFormula[0]).toEqual({ label: "fatura", formula: "{UPPER(fatura)}" });

    const cleared = setColumnFormulaOnArrayBinding(binding, 0, "", "fatura", "fatura");
    expect(cleared[0]).toBe("fatura");
  });

  it("applyColumnCellToTable só troca a célula do índice pedido, em toda linha", () => {
    const table = makeTable({
      head: ["a", "b"],
      content: [
        ["1", "2"],
        ["3", "4"],
      ],
    });
    const updated = applyColumnCellToTable(table, 1, "{X}");
    expect(updated.content).toEqual([
      ["1", "{X}"],
      ["3", "{X}"],
    ]);
  });
});
