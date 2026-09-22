// The geometry of this example's own canvas.
//
// It lives in a `.ts` and not inside `Canvas.tsx` because of oxlint's
// `react(only-export-components)` rule: a component file that also exports a
// constant/function breaks Fast Refresh. It is the same reason as the
// three-file split in the package's `src/i18n/` (context.tsx /
// contextValue.ts / hooks.ts), and as `canvasGeometry.ts` there.
//
// `App.tsx` uses `GRID_MM`/`snap` to position a new field, and `Canvas.tsx`
// uses all four in the drag/resize — so they were already shared between two
// real components.

// The canvas's fixed scale (px per mm) — only to draw the page on screen at
// a reasonable size; it has no relation to the generated PDF (which uses real
// pt through pdf-lib, inside generatePdf).
export const PX_PER_MM = 3;

export const MIN_WIDTH_MM = 15;
export const MIN_HEIGHT_MM = 8;

// A 5mm grid — the same step as the <Designer> (dragging/resizing snaps to
// it by default). Without it, a new field is always born at the same x/y and
// ends up stacked exactly on top of the previous one.
export const GRID_MM = 5;

export function snap(mm: number): number {
  return Math.round(mm / GRID_MM) * GRID_MM;
}
