import { useEffect } from "react";
import type { Template, Binding } from "json-pdf-designer/server";
import type { JsonSource } from "../lib/sources";

// Autosave in the browser — an accidental F5/tab close does not lose what was
// being edited. Only template/bindings/sources (the rest is derived). It fails
// silently if localStorage does not exist/is full (a private tab and so on) —
// it is a convenience, it must not break the app.
//
// A key of this example's own: the five examples run on different ports of the
// SAME localhost, and localStorage is per origin (host+port), so in practice
// they do not collide — but the prefix makes it explicit whose entry it is for
// whoever looks at the DevTools.
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

// It deletes the autosave — used by the "Reset" button (otherwise the saved
// state comes back on the next F5 and it looks as though the reset did not work).
export function clearAutosave() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    // likewise: blocked/full is no reason to break anything.
  }
}
