import { useContext } from "react";
import { DesignerZoomContext, type DesignerZoomValue } from "./zoomContext";

// Hook num arquivo próprio pela regra `react(only-export-components)` do
// oxlint — mesmo split de três arquivos que src/i18n/ e src/components/ui/
// usam.
export function useDesignerZoom(): DesignerZoomValue {
  const value = useContext(DesignerZoomContext);
  if (value === null) {
    // Inglês, como todo `throw` do pacote: é erro de COMPOSIÇÃO React, lido
    // por quem escreve o código, e não passa por describePdfError.
    throw new Error(
      "useDesignerZoom() needs a <DesignerProvider> above it. <Designer> already mounts one; a standalone piece needs its own."
    );
  }
  return value;
}
