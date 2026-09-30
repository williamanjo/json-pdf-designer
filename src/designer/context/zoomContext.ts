import { createContext, type MutableRefObject } from "react";

// THE CANVAS ZOOM, IN A CONTEXT OF ITS OWN.
//
// Up to 3.0.1 the zoom was `useState` internal to `<PageCanvas>` and never
// came up. The justification recorded in `DesignerCanvas` was performance:
// "dragging the slider would re-render every part if the value lived in the
// provider". It was right about the PROBLEM and wrong about the SOLUTION —
// what causes a cascading re-render is the value living in one of the five
// contexts every part reads, not the value being in a context.
//
// A SEPARATE context solves both at once:
//
//   - whoever does not call `useDesignerZoom()` does not re-render when the
//     zoom changes — the field list, the inspector and the property panel
//     stay put while the slider is dragged;
//   - whoever does call it (the canvas, and any bar the consumer draws) gets
//     the real value, so there is no second copy to fall out of sync.
//
// It is the same argument that already justified the primitives registry
// having a context of its own (see components/ui/registry.ts).
//
// What was impossible before this: reading the zoom to show it elsewhere,
// firing zoom/fit from a button outside the canvas, and drawing your own bar
// in any React container — the default `.jpd-zoombar` is `position: sticky`
// INSIDE the canvas, so CSS could only move it within that box.

export type DesignerZoomValue = {
  /** The current factor. 1 = 100%. Always within [`min`, `max`]. */
  zoom: number;
  /** The limits and step the canvas uses — the same ones the default bar uses. */
  min: number;
  max: number;
  step: number;
  /**
   * Accepts a value or an updater, like `setState`. The result is always
   * clamped, so passing 12 or -3 breaks nothing: it becomes `max` / `min`.
   */
  setZoom: (proximo: number | ((anterior: number) => number)) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Volta pra 100%. */
  reset: () => void;
  /**
   * Fits to the width/height of the viewport that SCROLLS — the
   * `<DesignerCanvas>`, which registers itself in `viewportRef`. With no
   * canvas mounted it does nothing (instead of measuring the whole window).
   */
  fitWidth: () => void;
  fitHeight: () => void;
  /**
   * The element that scrolls, filled in by the mounted `<DesignerCanvas>`.
   * Public because it is useful for more than the fit — scrolling to a field,
   * for instance. `null` until the canvas mounts.
   *
   * `MutableRefObject` and not `RefObject`, and the reason is the TWO REACT
   * MAJORS that `peerDependencies` accepts: @types/react 19 made `RefObject`
   * mutable and makes `useRef<T|null>(null)` return `RefObject<T|null>`,
   * while in 18 `RefObject<T>` has a READONLY `current` — and a `<div>`'s
   * `ref` prop there does not accept the `RefObject<T|null>` instantiation
   * (TS2322 in DesignerCanvas.tsx, found when CI started running React 18).
   * `MutableRefObject<T|null>` is `{ current: T|null }` in both, and mutable
   * goes where readonly is expected.
   */
  viewportRef: MutableRefObject<HTMLDivElement | null>;
};


export const DesignerZoomContext = createContext<DesignerZoomValue | null>(null);
