import { tableRowsPerSlice, TABLE_ROW_HEIGHT_MM } from "./render/renderTable";

// Decisões puras de paginação (mm, sem pdf-lib) — extraídas de generate.ts,
// que antes calculava a mesma conta duas vezes: uma em countBodyPages (dry-
// run, só pra saber {pageCount} antes de desenhar) e outra no loop de
// desenho de verdade. As DUAS passagens continuam existindo (uma precisa
// terminar antes da outra começar, pra {pageCount} sair certo já na página
// 1), mas agora chamam as MESMAS funções abaixo em vez de reimplementar o
// algoritmo cada uma à sua maneira — evita as duas divergirem depois de uma
// mudança feita só numa das cópias.

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

// Quanto de uma tabela cabe na fatia atual, dado o espaço disponível — a
// mesma pergunta é feita duas vezes por tabela que pagina: uma pra CONTAR
// (countBodyPages, sem desenhar nada) e outra pra desenhar de verdade.
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
