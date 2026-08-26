import { useEffect } from "react";
import type { Template, Binding } from "json-pdf-designer";
import type { JsonSource } from "../components/DataSourcePanel";

// Autosave no navegador — F5/fechar aba sem querer não perde o que tava
// sendo editado. Só template/bindings/sources (o resto é derivado). Falha
// silenciosa se localStorage não existir/estiver cheio (aba anônima etc) —
// é conveniência, não deve travar o app.
const AUTOSAVE_KEY = "report-builder:autosave-v1";

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

// Salva a cada mudança (debounced) — cobre F5 sem querer, aba fechada sem
// clicar em "Salvar projeto" etc.
export function useAutosave(template: Template, bindings: Binding[], sources: JsonSource[]) {
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ template, bindings, sources }));
      } catch {
        // localStorage cheio/bloqueado — autosave é conveniência, não trava o app.
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [template, bindings, sources]);
}
