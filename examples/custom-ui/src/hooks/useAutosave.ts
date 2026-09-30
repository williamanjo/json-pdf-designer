import { useEffect } from "react";
import type { Template, Binding } from "json-pdf-designer";
import type { JsonSource } from "../components/DataSourcePanel";

// Autosave in the browser — an accidental F5/tab close does not lose what
// was being edited. Only template/bindings/sources (the rest is derived). It
// fails silently if localStorage does not exist/is full (a private tab and so
// on) — it is a convenience, it must not break the app.
const AUTOSAVE_KEY = "custom-ui:autosave-v1";

export type AutosavedState = { template: Template; bindings: Binding[]; sources: JsonSource[] };

export function loadAutosave(): AutosavedState | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.template || !Array.isArray(parsed?.bindings) || !Array.isArray(parsed?.sources)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// It saves on every change (debounced) — it covers an accidental F5, a tab
// closed without clicking "Save project" and so on.
export function useAutosave(template: Template, bindings: Binding[], sources: JsonSource[]) {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ template, bindings, sources }));
      } catch {
        // localStorage full/blocked — autosave is a convenience, it does not break the app.
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [template, bindings, sources]);
}
