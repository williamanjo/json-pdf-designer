// Wiring compartilhado do padrão "arrasta com o mouse" usado por
// KpiField.tsx (mover sub-elemento) e TableField.tsx (redimensionar
// coluna) — ambos faziam a MESMA coisa: stopPropagation síncrono no
// mousedown, registra mousemove/mouseup no `window` (não no elemento nem
// no `document` — o cursor sai do campo/handle facilmente durante o
// arrasto), chama um callback com o delta (dx, dy) em px de TELA a cada
// mousemove, e remove os listeners no mouseup (chamando `onEnd`, se
// houver). Só a fiação do gesto é compartilhada — cada chamador guarda
// seu PRÓPRIO estado de "valor no início do arrasto" (offset do
// elemento, largura da coluna) e decide o que fazer com o delta.
export function startDragGesture(
  e: React.MouseEvent,
  onMove: (dx: number, dy: number) => void,
  onEnd?: () => void
): void {
  e.stopPropagation();

  const startClientX = e.clientX;
  const startClientY = e.clientY;

  function onMouseMove(ev: MouseEvent) {
    onMove(ev.clientX - startClientX, ev.clientY - startClientY);
  }
  function onMouseUp() {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    onEnd?.();
  }
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
}
