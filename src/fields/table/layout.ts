// Column width distribution — shared between the real drawing
// (pdf/render/renderTable.ts, in pt) and the canvas preview (components/FieldBox/
// TableField.tsx, in px) so the two never diverge. It always works in mm (the
// same unit as TableSchema.columnWidths) — the caller converts the result to
// pt/px at the end (mmToPt/mmToPx), not here.
//
// EXPLICIT widths (schema.columnWidths[i] set) are respected as they are;
// whatever is left of `totalMm` is split evenly between the columns WITHOUT a
// width of their own. With no width set anywhere at all, they all fall into
// the split — the usual equal division, behavior identical to what it was
// before columnWidths existed.
export function resolveColumnWidthsMm(
  columnWidths: (number | undefined)[] | undefined,
  colCount: number,
  totalMm: number
): number[] {
  if (colCount === 0) return [];
  const widths = columnWidths ?? [];
  let explicitSum = 0;
  let autoCount = 0;
  for (let i = 0; i < colCount; i++) {
    const w = widths[i];
    if (w !== undefined) explicitSum += w;
    else autoCount++;
  }
  const autoShare = autoCount > 0 ? Math.max(0, totalMm - explicitSum) / autoCount : 0;
  return Array.from({ length: colCount }, (_, i) => widths[i] ?? autoShare);
}
