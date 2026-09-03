import { useEffect } from "react";
import type { Template, Binding } from "json-pdf-designer/server";
import type { JsonSource } from "../lib/sources";

// Autosave no navegador — F5/fechar aba sem querer não perde o que tava
// sendo editado. Só template/bindings/sources (o resto é derivado). Falha
// silenciosa se localStorage não existir/estiver cheio (aba anônima etc) —
// é conveniência, não deve travar o app.
//
// Chave própria deste example: os cinco examples rodam em portas diferentes
// do MESMO localhost, e localStorage é por origem (host+porta), então na
// prática não colidem — mas o prefixo deixa explícito de quem é a entrada
// pra quem for olhar o DevTools.
const AUTOSAVE_KEY = "headless-designer:autosave-v1";

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
// clicar em "Save project" etc.
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

// Apaga o autosave — usado pelo botão "Reset" (senão o estado gravado volta
// no próximo F5 e parece que o reset não funcionou).
export function clearAutosave() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // idem: bloqueado/cheio não é motivo pra travar nada.
  }
}
