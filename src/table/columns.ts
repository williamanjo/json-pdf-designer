// Funções puras de mutação de coluna de tabela — extraídas do Designer.tsx
// (setTableHead/addTableColumn/removeTableColumn/reorderTableColumn/
// setColumnStyle/setColumnFormula). Cada ação vira um par (metade tabela +
// metade vínculo array) em vez de uma função só, porque Designer.tsx
// aplica as duas metades em DUAS chamadas funcionais separadas
// (onChangeTemplate/onChangeBindings, cada uma com seu próprio `prev`) — os
// dois setState vivem em slots de estado do React diferentes, então cada
// metade só pode garantir "leitura fresca" da SUA própria fatia de estado;
// combinar os dois numa função só reintroduziria a mesma janela de closure
// velha que já causou um bug real (ver comentário longo em Designer.tsx
// acima de onde essas funções são chamadas: um "orgao" foi parar sob o
// rótulo "fatura" porque um clique rápido leu bindings de ANTES do clique
// anterior aplicar).
import type { Binding, DataSourceColumnType, TableColumn, TableColumnStyle, TableSchema } from "../types";
import { columnLabel } from "../bindings/bindings";

type ArrayBinding = Extract<Binding, { type: "array" }>;

function move<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const copy = arr.slice();
  const [item] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, item);
  return copy;
}

// --- setTableHead: reescreve head inteiro, reindexando o resto por NOME (não posição) ---

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

// --- addTableColumn ---

// Coluna já nasce formatada como moeda (2 casas, R$) se o valor de exemplo
// dessa coluna no JSON é numérico — token cru pra qualquer outro tipo.
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
