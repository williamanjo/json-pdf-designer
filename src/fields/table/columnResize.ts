// Arrastar o divisor entre duas colunas de tabela (TableField.tsx) ajusta
// as DUAS ao mesmo tempo — cresce a esquerda pelo delta pedido, encolhe a
// direita pelo mesmo tanto, mantendo a largura TOTAL das duas colunas
// constante, igual uma planilha. Se a direita bater no mínimo, ela para de
// encolher e a esquerda "devolve" a diferença: só cresce pelo tanto que a
// direita realmente conseguiu ceder, não pelo delta pedido inteiro.
export function resizeColumnPair(
  startLeftMm: number,
  startRightMm: number,
  dxMm: number,
  minMm: number
): { left: number; right: number } {
  const nextLeft = Math.max(minMm, startLeftMm + dxMm);
  const grown = nextLeft - startLeftMm;
  const nextRight = Math.max(minMm, startRightMm - grown);
  // Se a coluna direita bateu no mínimo, não puxa mais largura dela do
  // que ela tem — reajusta o quanto a esquerda realmente cresceu.
  const actualGrown = startRightMm - nextRight;
  return { left: startLeftMm + actualGrown, right: nextRight };
}
