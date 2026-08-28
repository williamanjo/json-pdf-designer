// Distribuição de largura de coluna — compartilhada entre o desenho real
// (pdf/drawTable.ts, em pt) e o preview do canvas (components/FieldBox/
// TableField.tsx, em px) pra nunca divergir. Opera sempre em mm (mesma
// unidade de TableSchema.columnWidths) — quem chama converte o resultado
// pra pt/px no final (mmToPt/mmToPx), não aqui.
//
// Larguras EXPLÍCITAS (schema.columnWidths[i] definido) são respeitadas
// como estão; o que sobra de `totalMm` é dividido em partes iguais entre
// as colunas SEM largura própria. Sem nenhuma largura definida em lugar
// nenhum, todas caem no rateio — divisão igual de sempre, comportamento
// idêntico a antes de columnWidths existir.
export function resolveColumnWidthsMm(
  columnWidths: (number | undefined)[] | undefined,
  colCount: number,
  totalMm: number
): number[] {
  if (colCount === 0) return [];
  const widths = columnWidths ?? [];
  let explicitSum = 0;
  let autoCount = 0;
  for (let i = 0; i < colCount; i++) {
    const w = widths[i];
    if (w !== undefined) explicitSum += w;
    else autoCount++;
  }
  const autoShare = autoCount > 0 ? Math.max(0, totalMm - explicitSum) / autoCount : 0;
  return Array.from({ length: colCount }, (_, i) => widths[i] ?? autoShare);
}
