// The SVG path of a rectangle with rounded corners (0 to 4 independent radii),
// to use with pdf-lib's `page.drawSvgPath` — which has no ready-made "rounded
// rect" shape. It replaces the two duplicated `roundedRectPath`/
// `roundedCornersPath` (uniform in render/renderKpi.ts, per-corner in
// render/renderTable.ts): the same algorithm, the same exact output for both
// cases (see the clamp comment below).
//
// Local coordinates (0,0) = the top-left corner, y grows downward (the SVG
// convention).
export type RectCornerRadii = { tl: number; tr: number; bl: number; br: number };

export function roundedRectPath(width: number, height: number, radii: number | RectCornerRadii): string {
  // Each radius is capped at half the shorter side, so as not to overflow
  // the shape — `Math.min(width, height) / 2` (used here) is mathematically
  // identical to `Math.min(radius, width / 2, height / 2)` (render/renderKpi.ts's
  // old formula): min(width/2, height/2) === min(width, height) / 2.
  const half = Math.min(width, height) / 2;
  const r: RectCornerRadii = typeof radii === "number" ? { tl: radii, tr: radii, bl: radii, br: radii } : radii;
  const tl = Math.max(0, Math.min(r.tl, half));
  const tr = Math.max(0, Math.min(r.tr, half));
  const bl = Math.max(0, Math.min(r.bl, half));
  const br = Math.max(0, Math.min(r.br, half));
  return `M ${tl},0 H ${width - tr} A ${tr},${tr} 0 0 1 ${width},${tr} V ${height - br} A ${br},${br} 0 0 1 ${width - br},${height} H ${bl} A ${bl},${bl} 0 0 1 0,${height - bl} V ${tl} A ${tl},${tl} 0 0 1 ${tl},0 Z`;
}
