// CANVAS ZOOM SCALE, in a file that holds nothing but values.
//
// It used to live inside PageCanvas.tsx. It moved out for two reasons, in
// the order that matters:
//
//   1. The zoom context (src/designer/context/zoom.tsx) clamps with the SAME
//      numbers. Two copies would diverge the day someone touched one of
//      them, and the symptom would be the consumer's slider letting a value
//      through that the canvas then refuses — or the other way around.
//   2. Exporting a constant from a file that also exports a component breaks
//      oxlint's `react(only-export-components)` rule (fast refresh only works
//      when a file exports components only). Same reason as the three-file
//      split in src/i18n/.

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.1;

/**
 * Prende `z` em [ZOOM_MIN, ZOOM_MAX]. `Infinity` vira ZOOM_MAX, `-Infinity`
 * vira ZOOM_MIN, e **NaN vira 1** (100%).
 */
export function clampZoom(z: number): number {
  // The NaN case is not theoretical and it is not cosmetic. `Math.max(0.25,
  // NaN)` is NaN, and the NaN SURVIVES `Math.min` — so without this line a
  // NaN zoom reached `transform: scale(NaN)` and the whole sheet vanished,
  // with no console error and nothing in the DOM looking wrong.
  //
  // Two real paths get here: `fitWidth()` over a page whose `width` is NaN
  // (the same broken template that raises InvalidPageSizeError on
  // generation), and the slider the consumer draws passing `Number(empty)`.
  //
  // It falls back to 1, not to ZOOM_MIN, because NaN means "there is no
  // value" — and the least surprising result for that is 100%, which keeps
  // the sheet readable. ZOOM_MIN would turn a typo into a 25% stamp.
  // `Infinity` still clamps to the maximum, which is the right behavior:
  // there a value does exist, it is merely large.
  if (Number.isNaN(z)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

// Ruler (16px) plus breathing room (32px) subtracted from the viewport on
// "fit width/height". It lives here, and not in the two callers, because
// PageCanvas's `fitTo` and the context's `fitWidth()` have to land on the
// SAME zoom — otherwise the result depends on which button was clicked.
export const ZOOM_FIT_INSET_PX = 16 + 32;
