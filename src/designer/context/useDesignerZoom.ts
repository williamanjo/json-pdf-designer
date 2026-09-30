import { useContext } from "react";
import { DesignerZoomContext, type DesignerZoomValue } from "./zoomContext";

// A hook in a file of its own because of oxlint's
// `react(only-export-components)` rule — the same three-file split src/i18n/
// and src/components/ui/ use.
export function useDesignerZoom(): DesignerZoomValue {
  const value = useContext(DesignerZoomContext);
  if (value === null) {
    // English, like every `throw` in the package: it is a React COMPOSITION
    // error, read by the developer, and it does not go through describePdfError.
    throw new Error(
      "useDesignerZoom() needs a <DesignerProvider> above it. <Designer> already mounts one; a standalone piece needs its own."
    );
  }
  return value;
}
