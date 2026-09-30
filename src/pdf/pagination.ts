import { tableRowsPerSlice, TABLE_ROW_HEIGHT_MM } from "./tableMetrics";

// Pure pagination decisions (mm, no pdf-lib) — the atomic questions ("does it
// fit?", "how many rows fit?") the layout asks while walking the body.
//
// They were born extracted from generate.ts, when pagination was still
// computed TWICE: a dry run (countBodyPages) only to learn {pageCount} before
// drawing, and the real drawing loop. Sharing these functions was what kept
// the two copies from diverging. Today there is a single traversal
// (layout/layoutDocument.ts), so divergence is no longer possible — but the
// decisions stay here, pure and tested separately.

// A field/section does not paginate on its own: if not even its own height
// fits in what is left of the page (and the page is not "empty" yet, otherwise
// it would never fit anywhere), the whole item goes to a new page.
export function needsNewPageForItem(itemHeightMm: number, availableMm: number, cursorTopMm: number, headerHeight: number): boolean {
  return itemHeightMm > availableMm && cursorTopMm > headerHeight;
}

export type TableSliceDecision = {
  // How many data rows this slice consumes.
  rowsToTake: number;
  // The slice's raw capacity (before subtracting the footer row) — used by
  // the caller only to detect "not even 1 row fits" (capacity <= 0).
  capacity: number;
  // Is this slice the LAST one (does everything remaining fit in it)? Only
  // the last one draws the footer, if there is one.
  isLastSlice: boolean;
  // Does this slice draw the footer (totals) row?
  consumesFooter: boolean;
  // The height (mm) this slice takes: the header (if any) + rows + the footer (if any).
  heightMm: number;
};

// How much of a table fits in the current slice, given the space available.
export function computeTableSlice(remainingRows: number, availableMm: number, includeHead: boolean, hasFooter: boolean): TableSliceDecision {
  const baseCapacity = Math.max(tableRowsPerSlice(availableMm, includeHead), 0);
  // The footer never repeats per page — it only counts in the arithmetic of
  // the slice that will consume ALL the rest (it reserves 1 row for it only then).
  const capacityWithFooter = hasFooter ? Math.max(0, baseCapacity - 1) : baseCapacity;
  const isLastSlice = remainingRows <= capacityWithFooter;
  const capacity = isLastSlice ? capacityWithFooter : baseCapacity;
  const rowsToTake = Math.max(Math.min(capacity, remainingRows), 0);
  const consumesFooter = isLastSlice && hasFooter;
  const heightMm = (rowsToTake + (includeHead ? 1 : 0) + (consumesFooter ? 1 : 0)) * TABLE_ROW_HEIGHT_MM;
  return { rowsToTake, capacity, isLastSlice, consumesFooter, heightMm };
}
