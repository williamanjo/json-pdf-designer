import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { clampZoom, ZOOM_FIT_INSET_PX, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../../canvas/zoomScale";
import { mmToPx } from "../../page/units";
import { useDesignerData } from "./hooks";
import { DesignerZoomContext, type DesignerZoomValue } from "./zoomContext";

// Provider do zoom. O POR QUÊ de ele ter contexto próprio está em
// zoomContext.ts, junto do tipo.

export function DesignerZoomProvider({ children }: { children: ReactNode }) {
  const { template } = useDesignerData();
  const [zoom, setZoomBruto] = useState(1);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // A página que o canvas está desenhando. `DesignerCanvas` usa
  // `template.page`, e este cálculo tem que usar a MESMA fonte — medir
  // contra outra página daria um fit que não corresponde ao que está na
  // tela. Numa ref pra `fitWidth`/`fitHeight` não trocarem de identidade a
  // cada edição do template.
  const pagina = useRef(template.page);
  pagina.current = template.page;

  const setZoom = useCallback((proximo: number | ((anterior: number) => number)) => {
    setZoomBruto((anterior) => clampZoom(typeof proximo === "function" ? proximo(anterior) : proximo));
  }, []);

  const ajustar = useCallback((dimensao: "width" | "height") => {
    const el = viewportRef.current;
    // Sem canvas montado não há o que medir. Antes o fallback era
    // `window.innerWidth`, e ele foi a causa de "ajustar largura" dar 113%
    // com 338px de página fora da tela — medir a janela em vez da caixa.
    if (!el) return;
    const disponivel = dimensao === "width" ? el.clientWidth : el.clientHeight;
    const paginaPx = mmToPx(dimensao === "width" ? pagina.current.width : pagina.current.height);
    // `Number.isFinite` e não `<= 0`: `NaN <= 0` é FALSE, então uma página
    // com width/height NaN atravessava esta guarda e o `fitWidth` devolvia
    // NaN. O `clampZoom` hoje absorve isso, mas não fazer a divisão é melhor
    // que depender de quem recebe.
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

