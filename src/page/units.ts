// Unit conversions — the data model stays in mm (docs/ARCHITECTURE.md).
const PX_PER_MM = 96 / 25.4; // 96dpi
const PT_PER_MM = 72 / 25.4;

export function mmToPx(mm: number): number {
  return mm * PX_PER_MM;
}

export function pxToMm(px: number): number {
  return px / PX_PER_MM;
}

export function mmToPt(mm: number): number {
  return mm * PT_PER_MM;
}

export function ptToMm(pt: number): number {
  return pt / PT_PER_MM;
}

// A size in pt (the same unit as the PDF, see pdf/render/renderKpi.ts, pdf/render/renderChart.ts)
// converted to canvas px — used by the preview of fields with a configurable
// font/icon size, so it matches the real size of the generated PDF.
export function ptToPx(pt: number): number {
  return mmToPx(ptToMm(pt));
}

// The canvas grid's size (mm) (PageCanvas.tsx draws the grid and snaps
// dragging/resizing to that step) — the same value is used here so that ANY
// position computed by code (dropping a column chip, the next free Y, a new
// field's default position) also lands on the grid, not only what the mouse
// drags.
export const GRID_SIZE_MM = 5;

export function snapToGrid(value: number, gridMm: number = GRID_SIZE_MM): number {
  if (gridMm <= 0) return value;
  return Math.round(value / gridMm) * gridMm;
}
