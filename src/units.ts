// Conversões de unidade — modelo de dados fica em mm (docs/ARCHITECTURE.md).
const PX_PER_MM = 96 / 25.4; // 96dpi
const PT_PER_MM = 72 / 25.4;

export function mmToPx(mm: number): number {
  return mm * PX_PER_MM;
}

export function pxToMm(px: number): number {
  return px / PX_PER_MM;
}

export function mmToPt(mm: number): number {
  return mm * PT_PER_MM;
}

export function ptToMm(pt: number): number {
  return pt / PT_PER_MM;
}

// Tamanho em pt (mesma unidade do PDF, ver pdf/render/renderKpi.ts, pdf/render/renderChart.ts)
// convertido pra px do canvas — usado pelo preview de campos com tamanho de
// fonte/ícone configurável, pra bater com o tamanho real do PDF gerado.
export function ptToPx(pt: number): number {
  return mmToPx(ptToMm(pt));
}

// Tamanho (mm) da grade do canvas (PageCanvas.tsx desenha o quadriculado e
// trava arrastar/redimensionar nesse passo) — mesmo valor usado aqui pra
// QUALQUER posição calculada por código (soltar chip de coluna, próximo Y
// livre, posição padrão de campo novo) também cair na grade, não só o que
// o mouse arrasta.
export const GRID_SIZE_MM = 5;

export function snapToGrid(value: number, gridMm: number = GRID_SIZE_MM): number {
  if (gridMm <= 0) return value;
  return Math.round(value / gridMm) * gridMm;
}
