// Pure table column mutation functions — extracted from Designer.tsx
// (setTableHead/addTableColumn/removeTableColumn/reorderTableColumn/
// setColumnStyle/setColumnFormula). Each action becomes a pair (a table half
// + an array binding half) instead of a single function, because Designer.tsx
// applies the two halves in TWO separate functional calls
// (onChangeTemplate/onChangeBindings, each with its own `prev`) — the two
// setStates live in different React state slots, so each half can only
// guarantee a "fresh read" of ITS own slice of state; combining the two into
// one function would reintroduce the same stale closure window that already
// caused a real bug (see the long comment in Designer.tsx above where these
// functions are called: an "orgao" ended up under the "fatura" label because
// a quick click read bindings from BEFORE the previous click had applied its
// own change).
import type { Binding, DataSourceColumnType, TableColumn, TableColumnStyle, TableSchema } from "../../types";
import { columnLabel } from "../../bindings/bindings";

type ArrayBinding = Extract<Binding, { type: "array" }>;

function move<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const copy = arr.slice();
  const [item] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, item);
  return copy;
}

// --- setTableHead: rewrites the whole head, reindexing the rest by NAME (not position) ---

export function reindexTableForNewHead(table: TableSchema, newHead: string[]): TableSchema {
  const oldHead = table.head;
  function reindex<T>(oldArr: T[], fallback: (name: string) => T): T[] {
    return newHead.map((name) => {
      const oldIndex = oldHead.indexOf(name);
      return oldIndex !== -1 && oldArr[oldIndex] !== undefined ? oldArr[oldIndex] : fallback(name);
    });
  }
  return {
    ...table,
    head: newHead,
    content: table.content.map((row) => reindex(row, () => "")),
    footer: table.footer ? reindex(table.footer, () => "") : undefined,
    columnStyles: table.columnStyles ? reindex(table.columnStyles, () => undefined) : undefined,
    columnWidths: table.columnWidths ? reindex(table.columnWidths, () => undefined) : undefined,
  };
}

export function reindexArrayBindingForNewHead(binding: ArrayBinding, oldHead: string[], newHead: string[]): TableColumn[] {
  return newHead.map((name) => {
    const oldIndex = oldHead.indexOf(name);
    return oldIndex !== -1 && binding.columns[oldIndex] !== undefined ? binding.columns[oldIndex] : name;
  });
}

// --- renameTableColumn: ONLY the label, the reference stays ---
//
// The operation the model was missing, and the cause of the reported bug.
//
// Until now the only way to change a title was `setTableHead`, which rewrites
// the whole head and re-derives every slot by matching the new name against
// the old head (`reindexTableForNewHead`, above). Renaming is, by definition,
// a name that does not exist in the old head — so it fell into the fallback
// and the column lost `content` (the token, which is what the PDF uses),
// `columnStyles`, `columnWidths`, and gained the NEW TITLE as a JSON key in
// the binding. Renaming was indistinguishable from "delete X, insert Y".
//
// Here the index is the identity and nothing else is touched. An empty label
// is deliberately ignored: the old text field did a `filter(Boolean)` over the
// whole list, so clearing the name mid-typing collapsed the table.
export function renameColumnInTable(table: TableSchema, index: number, label: string): TableSchema {
  const trimmed = label.trim();
  if (!trimmed || index < 0 || index >= table.head.length) return table;
  const head = table.head.slice();
  head[index] = trimmed;
  return { ...table, head };
}

// The binding half only exists for a CALCULATED column, where the label is
// its own data (`{label, formula}`). A raw-key column has no label of its own
// — the title lives in the `head` — so there is nothing to update, and
// returning `null` avoids a bindings dispatch that changes nothing.
export function renameColumnInArrayBinding(binding: ArrayBinding, index: number, label: string): TableColumn[] | null {
  const trimmed = label.trim();
  const current = binding.columns[index];
  if (!trimmed || current === undefined || typeof current === "string") return null;
  if (current.label === trimmed) return null;
  const columns = binding.columns.slice();
  columns[index] = { ...current, label: trimmed };
  return columns;
}

// --- addTableColumn ---

// A column is born formatted as currency (2 decimals, R$) if that column's
// sample value in the JSON is numeric — a raw token for any other type.
export function buildColumnCell(column: string, columnType: DataSourceColumnType | undefined): string {
  return columnType === "number" ? `{CURRENCY(${column}, "R$", 2)}` : `{${column}}`;
}

// null = no-op (coluna já existe no cabeçalho).
export function addColumnToTable(table: TableSchema, column: string, cell: string): TableSchema | null {
  if (table.head.includes(column)) return null;
  return {
    ...table,
    head: [...table.head, column],
    content: table.content.map((row) => [...row, cell]),
    footer: table.footer ? [...table.footer, ""] : undefined,
    columnStyles: table.columnStyles ? [...table.columnStyles, undefined] : undefined,
    // Sem largura própria — cai no rateio do espaço restante (ver
    // resolveColumnWidthsMm em tableLayout.ts), igual sempre foi antes de
    // colunas com largura explícita existirem.
    columnWidths: table.columnWidths ? [...table.columnWidths, undefined] : undefined,
  };
}

// null = no-op (coluna já presente no vínculo, por label).
export function addColumnToArrayBinding(binding: ArrayBinding, column: string, newColumn: TableColumn): TableColumn[] | null {
  if (binding.columns.some((c) => columnLabel(c) === column)) return null;
  return [...binding.columns, newColumn];
}

// --- removeTableColumn: por ÍNDICE no head/content, por NOME no vínculo ---

export function removeColumnFromTable(table: TableSchema, index: number): { table: TableSchema; removedName: string | undefined } {
  const removedName = table.head[index];
  return {
    table: {
      ...table,
      head: table.head.filter((_, i) => i !== index),
      content: table.content.map((row) => row.filter((_, i) => i !== index)),
      footer: table.footer ? table.footer.filter((_, i) => i !== index) : undefined,
      columnStyles: table.columnStyles ? table.columnStyles.filter((_, i) => i !== index) : undefined,
      columnWidths: table.columnWidths ? table.columnWidths.filter((_, i) => i !== index) : undefined,
    },
    removedName,
  };
}

// null = no-op.
export function removeColumnFromArrayBinding(binding: ArrayBinding, removedName: string | undefined): TableColumn[] | null {
  if (removedName === undefined) return null;
  return binding.columns.filter((c) => columnLabel(c) !== removedName);
}

// --- reorderTableColumn ---

export function reorderTableColumn(table: TableSchema, fromIndex: number, toIndex: number): TableSchema {
  return {
    ...table,
    head: move(table.head, fromIndex, toIndex),
    content: table.content.map((row) => move(row, fromIndex, toIndex)),
    footer: table.footer ? move(table.footer, fromIndex, toIndex) : undefined,
    columnStyles: table.columnStyles ? move(table.columnStyles, fromIndex, toIndex) : undefined,
    columnWidths: table.columnWidths ? move(table.columnWidths, fromIndex, toIndex) : undefined,
  };
}

// null = não reordena o vínculo (tamanho não bate com o head — mais seguro
// não arriscar embaralhar valor errado sob rótulo errado).
export function reorderArrayBindingColumns(binding: ArrayBinding, headLength: number, fromIndex: number, toIndex: number): TableColumn[] | null {
  if (binding.columns.length !== headLength) return null;
  return move(binding.columns, fromIndex, toIndex);
}

// --- setColumnStyle ---

export function setColumnStyle(table: TableSchema, index: number, patch: Partial<TableColumnStyle>): TableSchema {
  const styles = (table.columnStyles ?? table.head.map(() => undefined)).slice();
  styles[index] = { ...styles[index], ...patch };
  return { ...table, columnStyles: styles };
}

// --- setColumnWidth ---

// `widthMm` undefined = volta a dividir o espaço restante em partes iguais
// com as outras colunas sem largura própria (ver resolveColumnWidthsMm em
// tableLayout.ts) — mesmo "resetar pro default" que outros campos opcionais
// do pacote já usam.
export function setColumnWidth(table: TableSchema, index: number, widthMm: number | undefined): TableSchema {
  const widths = (table.columnWidths ?? table.head.map(() => undefined)).slice();
  widths[index] = widthMm;
  return { ...table, columnWidths: widths };
}

// --- setColumnFormula ---

// Path cru (chave do JSON) por trás de um template de célula tipo
// "{tarKandir}" ou "{CURRENCY(tarKandir, "R$", 2)}" — usado só pra decidir
// pra que campo voltar quando o usuário limpa uma fórmula. Label de
// exibição (ex: "Tar. Kandir") NÃO serve aqui: colunas com fórmula autoral
// podem ter label bem diferente da chave real.
export function extractColumnPath(cellOrFormula: string | undefined): string | undefined {
  const wrapped = (cellOrFormula ?? "").trim().match(/^\{(.*)\}$/s);
  if (!wrapped) return undefined;
  const inner = wrapped[1];
  const call = inner.match(/^[A-Za-z]+\((.*)\)$/s);
  if (call) return call[1].split(",")[0]?.trim() || undefined;
  return /^[\w.]+$/.test(inner) ? inner : undefined;
}

export function computeColumnFormulaCell(
  formula: string,
  currentCell: string | undefined,
  headFallback: string | undefined
): { cell: string; rawPath: string | undefined } {
  const rawPath = extractColumnPath(formula) ?? extractColumnPath(currentCell) ?? headFallback;
  const cell = formula.trim() || (rawPath ? `{${rawPath}}` : "");
  return { cell, rawPath };
}

export function applyColumnCellToTable(table: TableSchema, index: number, cell: string): TableSchema {
  return { ...table, content: table.content.map((row) => row.map((c, i) => (i === index ? cell : c))) };
}

export function setColumnFormulaOnArrayBinding(
  binding: ArrayBinding,
  index: number,
  formula: string,
  rawPath: string | undefined,
  headFallback: string | undefined
): TableColumn[] {
  const label = columnLabel(binding.columns[index] ?? headFallback ?? "");
  const columns = binding.columns.slice();
  columns[index] = formula.trim() ? { label, formula: formula.trim() } : rawPath ?? label;
  return columns;
}

// --- espelho do sentido contrário: célula editada no canvas -> vínculo ---

// A célula da tabela É a fórmula da coluna: `generate.ts` resolve a linha a
// partir de `schema.content`, e `setColumnFormula` (o botão "ƒx" do painel)
// grava nos dois lugares justamente por isso. Faltava o inverso — editar a
// célula direto no canvas gravava só o `content`, então o painel continuava
// mostrando a fórmula ANTIGA do vínculo, que não é a que sai no PDF. Dois
// valores diferentes pra mesma coisa na tela, e o errado em evidência.
//
// Devolve as colunas atualizadas, ou null quando nenhuma célula mudou (aí
// quem chama não toca no estado dos vínculos — evita re-render por nada).
export function mirrorCellsToArrayBinding(
  binding: ArrayBinding,
  head: string[],
  before: string[] | undefined,
  after: string[] | undefined
): TableColumn[] | null {
  if (!after) return null;
  let columns: TableColumn[] | null = null;
  for (let i = 0; i < after.length; i++) {
    const cell = after[i];
    if (cell === before?.[i]) continue;
    // Mesmas regras do "ƒx": célula vazia devolve a coluna crua (só o nome),
    // célula com texto vira { label, formula }.
    const rawPath = extractColumnPath(cell) ?? extractColumnPath(before?.[i]) ?? head[i];
    columns = setColumnFormulaOnArrayBinding({ ...binding, columns: columns ?? binding.columns }, i, cell, rawPath, head[i]);
  }
  return columns;
}
