import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startDragGesture } from "../../src/components/dragGesture";

// Sem jsdom no projeto (ver test/i18n/withInlineCode.test.tsx) — o
// ambiente padrão do vitest aqui é "node", que não tem `window` global.
// startDragGesture só precisa de um EventTarget com
// addEventListener/removeEventListener/dispatchEvent, então um
// EventTarget nativo do Node (disponível desde o Node 15) serve de
// stand-in fiel pro `window` real do browser.
function fakeMouseEvent(clientX: number, clientY: number) {
  return {
    stopPropagation: vi.fn(),
    clientX,
    clientY,
  } as unknown as React.MouseEvent;
}

function dispatchMouseMove(clientX: number, clientY: number) {
  const ev = new Event("mousemove") as MouseEvent;
  Object.defineProperty(ev, "clientX", { value: clientX, configurable: true });
  Object.defineProperty(ev, "clientY", { value: clientY, configurable: true });
  window.dispatchEvent(ev);
}

function dispatchMouseUp() {
  window.dispatchEvent(new Event("mouseup"));
}

describe("startDragGesture", () => {
  let originalWindow: unknown;

  beforeEach(() => {
    originalWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = new EventTarget();
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).window = originalWindow;
  });

  it("chama stopPropagation sincronamente no mousedown", () => {
    const mouseDownEvent = fakeMouseEvent(100, 50);
    startDragGesture(mouseDownEvent, vi.fn());
    expect(mouseDownEvent.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it("chama onMove com o delta (dx, dy) correto pra cada mousemove no window", () => {
    const onMove = vi.fn();
    startDragGesture(fakeMouseEvent(100, 50), onMove);

    dispatchMouseMove(120, 70);
    expect(onMove).toHaveBeenNthCalledWith(1, 20, 20);

    dispatchMouseMove(90, 130);
    expect(onMove).toHaveBeenNthCalledWith(2, -10, 80);

    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it("chama onEnd no mouseup", () => {
    const onEnd = vi.fn();
    startDragGesture(fakeMouseEvent(0, 0), vi.fn(), onEnd);

    expect(onEnd).not.toHaveBeenCalled();
    dispatchMouseUp();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("não quebra quando onEnd não é passado", () => {
    startDragGesture(fakeMouseEvent(0, 0), vi.fn());
    expect(() => dispatchMouseUp()).not.toThrow();
  });

  it("remove os listeners no mouseup — mousemove depois disso não chama onMove de novo", () => {
    const onMove = vi.fn();
    startDragGesture(fakeMouseEvent(0, 0), onMove);

    dispatchMouseMove(10, 10);
    expect(onMove).toHaveBeenCalledTimes(1);

    dispatchMouseUp();
    dispatchMouseMove(999, 999);
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it("dois arrastos independentes não vazam listener um pro outro", () => {
    const onMoveA = vi.fn();
    const onMoveB = vi.fn();

    startDragGesture(fakeMouseEvent(0, 0), onMoveA);
    dispatchMouseUp();

    startDragGesture(fakeMouseEvent(0, 0), onMoveB);
    dispatchMouseMove(5, 5);

    expect(onMoveA).not.toHaveBeenCalled();
    expect(onMoveB).toHaveBeenCalledTimes(1);
  });
});
