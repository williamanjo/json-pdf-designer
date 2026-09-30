// Pure pie/donut slice math — used both by the canvas preview (the browser's
// SVG) and by the real drawing in the PDF (pdf-lib accepts the same SVG path
// syntax through drawSvgPath), to guarantee that the two draw exactly the
// same shape.

// A point on a circle's edge, with the angle measured from the top (12
// o'clock), clockwise — y grows downward (the SVG convention).
export function pointOnCircle(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

// The path of ONE slice. innerR <= 0 -> a full pie (the slice reaches the
// center); innerR > 0 -> a donut (the slice becomes a curved "trapezoid"
// between the two radii). sweepDeg is always clamped below 360° — a lone
// slice closing the whole circle would leave the start and the end
// coinciding, which the SVG arc command does not draw properly (ambiguous) —
// it only happens when a single category is left (no "Others"), a rare case
// where losing 0.01° of the circle causes no visible problem.
export function pieSlicePath(cx: number, cy: number, outerR: number, innerR: number, startDeg: number, sweepDegRaw: number): string {
  const sweepDeg = Math.min(sweepDegRaw, 359.99);
  const endDeg = startDeg + sweepDeg;
  const largeArc = sweepDeg > 180 ? 1 : 0;
  const o0 = pointOnCircle(cx, cy, outerR, startDeg);
  const o1 = pointOnCircle(cx, cy, outerR, endDeg);
  if (innerR <= 0) {
    return `M ${cx},${cy} L ${o0.x},${o0.y} A ${outerR},${outerR} 0 ${largeArc} 1 ${o1.x},${o1.y} Z`;
  }
  const i1 = pointOnCircle(cx, cy, innerR, endDeg);
  const i0 = pointOnCircle(cx, cy, innerR, startDeg);
  return `M ${o0.x},${o0.y} A ${outerR},${outerR} 0 ${largeArc} 1 ${o1.x},${o1.y} L ${i1.x},${i1.y} A ${innerR},${innerR} 0 ${largeArc} 0 ${i0.x},${i0.y} Z`;
}
