// Resolves a schema's content (text/table) against the real data — pure, with
// no dependency on pdf-lib at all. Used both by the main flow (generate.ts)
// and by the section drawing (render/renderSection.ts).
import type { Binding, TableSchema } from "../types";
import { filteredArrayAt, renderTemplate } from "../bindings/bindings";

export function resolveTableRows(schema: TableSchema, value: string | undefined): string[][] {
  if (!value) return schema.content;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // the value is not row JSON (e.g. a schema with no binding) — it keeps the preview
  }
  return schema.content;
}

// One row (a table bound to an array, one item) — cell by cell. If the design
// cell (content[0][i]) holds a real {token}, that rules: swap the token, swap
// the value pulled, full stop — it does not depend on matching a name/position
// against any separate column list (that is the source of the desync bug:
// shortening the header from outside does not change what that cell
// references). A cell with NO key at all (e.g. "PNR0000", a generic preview of
// a freshly created table) does not count as a template — it falls straight
// through to the binding, otherwise a static sample value would become "the
// same fixed text on every row" forever, ignoring the real data. Empty also
// falls through to the binding (`binding.columns[i]`, a raw path or
// {label,formula}); with none of that, it tries the header's label as a
// direct path into the item.
export function resolveRowFromItem(tableSchema: TableSchema, item: unknown, binding: Extract<Binding, { type: "array" }> | undefined): string[] {
  return tableSchema.head.map((headLabel, i) => {
    const cellTemplate = tableSchema.content[0]?.[i];
    if (cellTemplate && cellTemplate.includes("{")) return renderTemplate(cellTemplate, item);
    const col = binding?.columns[i];
    if (col !== undefined) {
      if (typeof col !== "string") return renderTemplate(col.formula.trim(), item);
      const v = item && typeof item === "object" ? (item as Record<string, unknown>)[col] : undefined;
      return v === undefined || v === null ? "" : String(v);
    }
    const v = item && typeof item === "object" ? (item as Record<string, unknown>)[headLabel] : undefined;
    return v === undefined || v === null ? "" : String(v);
  });
}

export function resolveArrayRows(tableSchema: TableSchema, arr: unknown[], binding: Extract<Binding, { type: "array" }> | undefined): string[][] {
  return arr.map((item) => resolveRowFromItem(tableSchema, item, binding));
}

// The rows of a BODY table (not a section member) bound to an array — the
// same cell-by-cell resolution (the design token rules, binding.columns is
// only the fallback). With no "array" binding (e.g. key/value, or no binding
// at all), it falls back to the usual path (inputs precomputed by buildInputs,
// or the design preview).
export function resolveTopLevelTableRows(tableSchema: TableSchema, bindings: Binding[], data: unknown, inputs: Record<string, string>): string[][] {
  const binding = bindings.find(
    (b): b is Extract<Binding, { type: "array" }> => b.schemaName === tableSchema.name && b.type === "array"
  );
  if (binding) {
    const filtered = filteredArrayAt(data, binding.path, binding.filters);
    if (filtered) return resolveArrayRows(tableSchema, filtered, binding);
  }
  return resolveTableRows(tableSchema, inputs[tableSchema.name]);
}

// The rows of a table that is a section MEMBER — two cases:
// 1) Bound (type "array", a path relative to the ITEM) — real master-detail
//    (e.g. Order -> OrderItems): one row per item of the nested array. Cell by
//    cell, the design TOKEN rules (see resolveRowFromItem) — binding.columns
//    is only used where the cell was left empty.
// 2) Unbound — a SINGLE row, against the current ITEM (the same cell-by-cell
//    resolution, with no column list at all). It only falls back to the pure
//    design preview if not even that resolves anything (an empty item, or one
//    with no fields).
export function resolveNestedTableRows(tableMember: TableSchema, item: unknown, bindings: Binding[]): string[][] {
  const binding = bindings.find(
    (b): b is Extract<Binding, { type: "array" }> => b.schemaName === tableMember.name && b.type === "array"
  );
  if (binding) {
    const filtered = filteredArrayAt(item, binding.path, binding.filters);
    if (filtered) return resolveArrayRows(tableMember, filtered, binding);
  } else if (item && typeof item === "object") {
    const row = resolveRowFromItem(tableMember, item, undefined);
    if (row.some((cell) => cell !== "")) return [row];
  }
  return tableMember.content;
}

// A table's totals row — each cell is a real template (fixed text and/or
// {token}/{SUM(...)}), resolved against the data the caller gives (the whole
// document for a loose table, the current ITEM for a table that is a section
// member — the same distinction as always).
export function resolveFooterRow(tableSchema: TableSchema, resolveData: unknown): string[] | undefined {
  if (!tableSchema.footer || tableSchema.footer.length === 0) return undefined;
  return tableSchema.footer.map((cell) => renderTemplate(cell, resolveData));
}

// Text with no "template"/"scalar" binding uses its own content as the
// template (it resolves {token}/{SUM(...)} and so on against the given data) —
// the same rule ANYWHERE text is drawn: the body before/after a block, a
// repeated header/footer/margin, a section member.
export function resolveTextValue(content: string, binding: Binding | undefined, resolveData: unknown): string {
  if (binding?.type === "template") return renderTemplate(binding.template, resolveData);
  if (binding?.type === "scalar") return renderTemplate(`{${binding.path}}`, resolveData);
  return renderTemplate(content, resolveData);
}
