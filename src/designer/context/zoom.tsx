import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { clampZoom, ZOOM_FIT_INSET_PX, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../../canvas/zoomScale";
import { mmToPx } from "../../page/units";
import { useDesignerData } from "./hooks";
import { DesignerZoomContext, type DesignerZoomValue } from "./zoomContext";

// The zoom provider. The WHY of it having a context of its own is in
// zoomContext.ts, next to the type.

export function DesignerZoomProvider({ children }: { children: ReactNode }) {
  const { template } = useDesignerData();
  const [zoom, setZoomBruto] = useState(1);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // The page the canvas is drawing. `DesignerCanvas` uses `template.page`,
  // and this computation has to use the SAME source — measuring against a
  // different page would give a fit that does not match what is on screen.
  // In a ref so `fitWidth`/`fitHeight` do not change identity on every
  // template edit.
  const pagina = useRef(template.page);
  pagina.current = template.page;

  const setZoom = useCallback((proximo: number | ((anterior: number) => number)) => {
    setZoomBruto((anterior) => clampZoom(typeof proximo === "function" ? proximo(anterior) : proximo));
  }, []);

  const ajustar = useCallback((dimensao: "width" | "height") => {
    const el = viewportRef.current;
    // With no canvas mounted there is nothing to measure. The fallback used
    // to be `window.innerWidth`, and it caused "fit width" to give 113% with
    // 338px of page off screen — measuring the window instead of the box.
    if (!el) return;
    const disponivel = dimensao === "width" ? el.clientWidth : el.clientHeight;
    const paginaPx = mmToPx(dimensao === "width" ? pagina.current.width : pagina.current.height);
    // `Number.isFinite` and not `<= 0`: `NaN <= 0` is FALSE, so a page with a
    // NaN width/height went straight through this guard and `fitWidth`
    // returned NaN. `clampZoom` absorbs that today, but not doing the
    // division is better than depending on the receiver.
    if (!Number.isFinite(paginaPx) || paginaPx <= 0) return;
    setZoom((disponivel - ZOOM_FIT_INSET_PX) / paginaPx);
  }, [setZoom]);

  const value = useMemo<DesignerZoomValue>(
    () => ({
      zoom,
      min: ZOOM_MIN,
      max: ZOOM_MAX,
      step: ZOOM_STEP,
      setZoom,
      zoomIn: () => setZoom((z) => z + ZOOM_STEP),
      zoomOut: () => setZoom((z) => z - ZOOM_STEP),
      reset: () => setZoom(1),
      fitWidth: () => ajustar("width"),
      fitHeight: () => ajustar("height"),
      viewportRef,
    }),
    [zoom, setZoom, ajustar]
  );

  return <DesignerZoomContext.Provider value={value}>{children}</DesignerZoomContext.Provider>;
}

