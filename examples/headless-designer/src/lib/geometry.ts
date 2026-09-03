// Geometria do canvas próprio deste example.
//
// Fica num `.ts` e não dentro do `Canvas.tsx` por causa da regra
// `react(only-export-components)` do oxlint: um arquivo de componente que
// também exporta constante/função quebra o Fast Refresh. É a mesma razão do
// split de três arquivos em `src/i18n/` no pacote (context.tsx /
// contextValue.ts / hooks.ts), e do `canvasGeometry.ts` lá.
//
// O `App.tsx` usa `GRID_MM`/`snap` pra posicionar campo novo, e o
// `Canvas.tsx` usa todas as quatro no arrasto/redimensionamento — então elas
// já eram compartilhadas entre dois componentes de verdade.

// Escala fixa do canvas (px por mm) — só pra desenhar a página em tela num
// tamanho razoável; não tem relação com o PDF gerado (que usa pt de verdade
// via pdf-lib, dentro de generatePdf).
export const PX_PER_MM = 3;

export const MIN_WIDTH_MM = 15;
export const MIN_HEIGHT_MM = 8;

// Grade de 5mm — mesmo passo do <Designer> (arrastar/redimensionar trava
// nela por padrão). Sem isso, campo novo nasce sempre no mesmo x/y e fica
// empilhado exatamente em cima do anterior.
export const GRID_MM = 5;

export function snap(mm: number): number {
  return Math.round(mm / GRID_MM) * GRID_MM;
}
