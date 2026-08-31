// Path SVG de um retângulo com cantos arredondados (0 a 4 raios
// independentes), pra usar com `page.drawSvgPath` do pdf-lib — que não tem
// uma forma "rounded rect" pronta. Substitui os dois `roundedRectPath`/
// `roundedCornersPath` que existiam duplicados (uniforme em render/renderKpi.ts,
// por-canto em render/renderTable.ts): mesmo algoritmo, mesma saída exata pros dois
// casos (ver comentário de clamp abaixo).
//
// Coordenadas locais (0,0) = canto superior-esquerdo, y cresce pra baixo
// (convenção SVG).
export type RectCornerRadii = { tl: number; tr: number; bl: number; br: number };

export function roundedRectPath(width: number, height: number, radii: number | RectCornerRadii): string {
  // Cada raio é limitado a metade do lado menor, pra não estourar a forma
  // — `Math.min(width, height) / 2` (usado aqui) é matematicamente
  // idêntico a `Math.min(radius, width / 2, height / 2)` (fórmula antiga
  // do render/renderKpi.ts): min(width/2, height/2) === min(width, height) / 2.
  const half = Math.min(width, height) / 2;
  const r: RectCornerRadii = typeof radii === "number" ? { tl: radii, tr: radii, bl: radii, br: radii } : radii;
  const tl = Math.max(0, Math.min(r.tl, half));
  const tr = Math.max(0, Math.min(r.tr, half));
  const bl = Math.max(0, Math.min(r.bl, half));
  const br = Math.max(0, Math.min(r.br, half));
  return `M ${tl},0 H ${width - tr} A ${tr},${tr} 0 0 1 ${width},${tr} V ${height - br} A ${br},${br} 0 0 1 ${width - br},${height} H ${bl} A ${bl},${bl} 0 0 1 0,${height - bl} V ${tl} A ${tl},${tl} 0 0 1 ${tl},0 Z`;
}
