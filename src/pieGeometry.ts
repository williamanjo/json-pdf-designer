// Matemática pura de fatia de pizza/rosca — usada tanto pelo preview no
// canvas (SVG do navegador) quanto pelo desenho real no PDF (pdf-lib
// aceita a mesma sintaxe de path SVG via drawSvgPath), pra garantir que os
// dois desenhem exatamente a mesma forma.

// Ponto na borda de um círculo, ângulo medido a partir do topo (12h),
// sentido horário — y cresce pra baixo (convenção SVG).
export function pointOnCircle(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

// Path de UMA fatia. innerR <= 0 -> pizza cheia (fatia vai até o centro);
// innerR > 0 -> rosca (fatia vira um "trapézio" curvo entre os dois raios).
// sweepDeg é sempre travado abaixo de 360° — uma fatia sozinha fechando o
// círculo inteiro deixaria início e fim coincidindo, o que o comando de
// arco do SVG não desenha direito (ambíguo) — só acontece quando sobra 1
// categoria só (sem "Outros"), caso raro e sem problema visual perceptível
// perder 0.01° do círculo.
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
