// Table metrics — the geometry constants/arithmetic that BOTH the layout AND
// the drawing need.
//
// They live in a file apart from render/renderTable.ts because that one
// imports pdf-lib as a value (`rgb`), and the layout needs these measurements
// without dragging pdf-lib into `layout/`'s graph — the layout is pure math
// and should stay that way (it is what allows reusing it in a canvas preview,
// for instance).

// The fixed height of a table row. Fixed on purpose: a cell TRUNCATES the
// text that does not fit (see truncateToWidth in textLayout.ts) instead of
// wrapping, so a slice's height is always predictable from the row COUNT —
// that is what lets the layout compute where the table ends without drawing
// anything.
export const TABLE_ROW_HEIGHT_MM = 7;

// How many body rows fit in a slice with this available height — it reserves
// 1 row for the header only if it is going to be drawn on that slice
// (schema.repeatHeader === false frees that row on the continuation slices,
// since the header does not repeat).
export function tableRowsPerSlice(availableHeightMm: number, includeHead = true): number {
  const rows = Math.floor(availableHeightMm / TABLE_ROW_HEIGHT_MM) - (includeHead ? 1 : 0);
  return Math.max(0, rows);
}
