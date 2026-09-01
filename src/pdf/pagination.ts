import { tableRowsPerSlice, TABLE_ROW_HEIGHT_MM } from "./tableMetrics";

// Decisões puras de paginação (mm, sem pdf-lib) — as perguntas atômicas
// ("cabe?", "quantas linhas cabem?") que o layout faz enquanto percorre o
// corpo.
//
// Elas nasceram extraídas de generate.ts, quando a paginação ainda era
// calculada DUAS vezes: um dry-run (countBodyPages) só pra saber {pageCount}
// antes de desenhar, e o laço de desenho de verdade. Compartilhar estas
// funções era o que impedia as duas cópias de divergirem. Hoje existe uma
// travessia só (layout/layoutDocument.ts), então a divergência deixou de ser
// possível — mas as decisões continuam aqui, puras e testadas à parte.

// Campo/seção não pagina sozinho: se nem a própria altura cabe no que
// resta da página (e a página não tá "vazia" ainda, senão nunca ia caber
// nunca), o item inteiro vai pra página nova.
export function needsNewPageForItem(itemHeightMm: number, availableMm: number, cursorTopMm: number, headerHeight: number): boolean {
  return itemHeightMm > availableMm && cursorTopMm > headerHeight;
}

export type TableSliceDecision = {
  // Quantas linhas de dado essa fatia consome.
  rowsToTake: number;
  // Capacidade bruta da fatia (antes de descontar linha de rodapé) — usada
  // por quem chama só pra detectar "não cabe nem 1 linha" (capacity <= 0).
  capacity: number;
  // Essa fatia é a ÚLTIMA (todo o restante cabe nela)? Só a última desenha
  // o rodapé, se houver.
  isLastSlice: boolean;
  // Essa fatia desenha a linha de rodapé (totais)?
  consumesFooter: boolean;
  // Altura (mm) que essa fatia ocupa: cabeçalho (se houver) + linhas + rodapé (se houver).
  heightMm: number;
};

// Quanto de uma tabela cabe na fatia atual, dado o espaço disponível.
export function computeTableSlice(remainingRows: number, availableMm: number, includeHead: boolean, hasFooter: boolean): TableSliceDecision {
  const baseCapacity = Math.max(tableRowsPerSlice(availableMm, includeHead), 0);
  // Footer nunca repete por página — só cabe na conta da fatia que vai
  // consumir TODO o resto (reserva 1 linha pra ele só aí).
  const capacityWithFooter = hasFooter ? Math.max(0, baseCapacity - 1) : baseCapacity;
  const isLastSlice = remainingRows <= capacityWithFooter;
  const capacity = isLastSlice ? capacityWithFooter : baseCapacity;
  const rowsToTake = Math.max(Math.min(capacity, remainingRows), 0);
  const consumesFooter = isLastSlice && hasFooter;
  const heightMm = (rowsToTake + (includeHead ? 1 : 0) + (consumesFooter ? 1 : 0)) * TABLE_ROW_HEIGHT_MM;
  return { rowsToTake, capacity, isLastSlice, consumesFooter, heightMm };
}
