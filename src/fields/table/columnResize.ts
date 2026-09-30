// Dragging the divider between two table columns (TableField.tsx) adjusts
// BOTH at once — the left one grows by the requested delta, the right one
// shrinks by the same amount, keeping the TOTAL width of the two columns
// constant, like a spreadsheet. If the right one hits its minimum, it stops
// shrinking and the left one "gives back" the difference: it only grows by
// what the right one could actually yield, not by the whole requested delta.
export function resizeColumnPair(
  startLeftMm: number,
  startRightMm: number,
  dxMm: number,
  minMm: number
): { left: number; right: number } {
  const nextLeft = Math.max(minMm, startLeftMm + dxMm);
  const grown = nextLeft - startLeftMm;
  const nextRight = Math.max(minMm, startRightMm - grown);
  // If the right column hit its minimum, do not pull more width out of it
  // than it has — readjust how much the left one actually grew.
  const actualGrown = startRightMm - nextRight;
  return { left: startLeftMm + actualGrown, right: nextRight };
}
