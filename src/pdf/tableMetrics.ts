// Métricas de tabela — as constantes/contas de geometria que TANTO o layout
// QUANTO o desenho precisam.
//
// Ficam num arquivo à parte de render/renderTable.ts porque esse importa
// pdf-lib como valor (`rgb`), e o layout precisa dessas medidas sem arrastar
// pdf-lib pra dentro do grafo de `layout/` — o layout é matemática pura e
// deve continuar assim (é o que permite reusá-lo num preview em canvas, por
// exemplo).

// Altura fixa de uma linha de tabela. Fixa de propósito: célula TRUNCA o
// texto que não cabe (ver truncateToWidth em textLayout.ts) em vez de
// quebrar linha, então a altura de uma fatia é sempre previsível a partir
// da CONTAGEM de linhas — é isso que deixa o layout calcular onde a tabela
// termina sem desenhar nada.
export const TABLE_ROW_HEIGHT_MM = 7;

// Quantas linhas de corpo cabem numa fatia com essa altura disponível —
// reserva 1 linha pro cabeçalho só se ele for desenhar nessa fatia
// (schema.repeatHeader === false libera essa linha nas fatias de
// continuação, já que o cabeçalho não repete).
export function tableRowsPerSlice(availableHeightMm: number, includeHead = true): number {
  const rows = Math.floor(availableHeightMm / TABLE_ROW_HEIGHT_MM) - (includeHead ? 1 : 0);
  return Math.max(0, rows);
}
