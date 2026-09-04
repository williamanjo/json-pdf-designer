// ESCALA DE ZOOM DO CANVAS, num arquivo só de valores.
//
// Estava dentro do PageCanvas.tsx. Saiu por dois motivos, na ordem em que
// importam:
//
//   1. O contexto de zoom (src/designer/context/zoom.tsx) clampa com os
//      MESMOS números. Duas cópias divergiriam no dia em que alguém mexesse
//      numa delas, e o sintoma seria a barra do consumidor deixando passar
//      um valor que o canvas depois recusa — ou o contrário.
//   2. Exportar constante de um arquivo que também exporta componente
//      derruba a regra `react(only-export-components)` do oxlint (fast
//      refresh só funciona quando o arquivo exporta apenas componentes). É a
//      mesma razão do split de três arquivos em src/i18n/.

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 3;
export const ZOOM_STEP = 0.1;

/**
 * Prende `z` em [ZOOM_MIN, ZOOM_MAX]. `Infinity` vira ZOOM_MAX, `-Infinity`
 * vira ZOOM_MIN, e **NaN vira 1** (100%).
 */
export function clampZoom(z: number): number {
  // O caso NaN não é teórico e não é cosmético. `Math.max(0.25, NaN)` é NaN,
  // e o NaN SOBREVIVE ao `Math.min` — então sem esta linha um zoom NaN
  // chegava em `transform: scale(NaN)` e a folha inteira desaparecia, sem
  // erro no console e sem nada no DOM parecendo errado.
  //
  // Dois caminhos reais até aqui: `fitWidth()` sobre uma página cujo `width`
  // é NaN (o mesmo template torto que dá InvalidPageSizeError na geração), e
  // a barra que o consumidor desenha passando `Number(campoVazio)`.
  //
  // Volta 1, e não ZOOM_MIN, porque NaN significa "não há valor" — e o
  // resultado menos surpreendente pra isso é 100%, que deixa a folha
  // legível. ZOOM_MIN transformaria um erro de digitação num selo de 25%.
  // `Infinity` continua clampando pro máximo, que é o comportamento certo:
  // ali existe valor, ele só é grande.
  if (Number.isNaN(z)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

// Régua (16px) + respiro (32px) descontados do viewport ao "ajustar
// largura/altura". Mora aqui, e não nos dois chamadores, porque o
// `fitTo` do PageCanvas e o `fitWidth()` do contexto têm que chegar no MESMO
// zoom — senão o resultado depende de qual botão a pessoa clicou.
export const ZOOM_FIT_INSET_PX = 16 + 32;
