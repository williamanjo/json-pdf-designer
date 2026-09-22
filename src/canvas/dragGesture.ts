// Shared wiring for the "drag with the mouse" pattern used by
// KpiField.tsx (move a sub-element) and TableField.tsx (resize a
// column) — both did the SAME thing: synchronous stopPropagation on
// mousedown, register mousemove/mouseup on `window` (not on the element
// nor on `document` — the cursor leaves the field/handle easily during
// the drag), call a callback with the delta (dx, dy) in SCREEN px on
// every mousemove, and remove the listeners on mouseup (calling `onEnd`,
// if there is one). Only the gesture wiring is shared — each caller keeps
// its OWN "value at the start of the drag" state (element offset, column
// width) and decides what to do with the delta.
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
