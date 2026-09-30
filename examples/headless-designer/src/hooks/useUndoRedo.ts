import { useEffect, useRef } from "react";
import type { Template, Binding } from "json-pdf-designer/server";

type Snapshot = { template: Template; bindings: Binding[] };
type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

// Undo/redo (Ctrl+Z / Ctrl+Shift+Z or Ctrl+Y) — template and bindings change
// together in several operations (e.g. "Bind" syncs head/content AND creates
// the binding in the same click). Stacking per individual SETSTATE would break
// those operations into two undo steps, throwing head/binding.columns out of
// alignment again (the same bug fixed before). Instead, an effect compares the
// pair [template, bindings] against the last recorded snapshot — since React
// batching joins the two setState calls of the same synchronous action into a
// single render, the effect runs once per ACTION, not per setState, and each
// history entry comes out atomic.
export function useUndoRedo(template: Template, bindings: Binding[], setTemplate: Setter<Template>, setBindings: Setter<Binding[]>) {
  const undoStackRef = useRef<Snapshot[]>([]);
  const redoStackRef = useRef<Snapshot[]>([]);
  const skipHistoryRef = useRef(false);
  const lastSnapshotRef = useRef<Snapshot>({ template, bindings });

  useEffect(() => {
    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      lastSnapshotRef.current = { template, bindings };
      return;
    }
    if (template !== lastSnapshotRef.current.template || bindings !== lastSnapshotRef.current.bindings) {
      undoStackRef.current.push(lastSnapshotRef.current);
      if (undoStackRef.current.length > 100) undoStackRef.current.shift();
      redoStackRef.current = [];
      lastSnapshotRef.current = { template, bindings };
    }
  }, [template, bindings]);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    }

    function undo() {
      const prev = undoStackRef.current.pop();
      if (!prev) return;
      redoStackRef.current.push({ template, bindings });
      skipHistoryRef.current = true;
      setTemplate(prev.template);
      setBindings(prev.bindings);
    }

    function redo() {
      const next = redoStackRef.current.pop();
      if (!next) return;
      undoStackRef.current.push({ template, bindings });
      skipHistoryRef.current = true;
      setTemplate(next.template);
      setBindings(next.bindings);
    }

    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || (e.key.toLowerCase() !== "z" && e.key.toLowerCase() !== "y")) return;
      // A focused text field (a column name, a formula, the sample JSON and so
      // on) — it lets the input/textarea's NATIVE undo act, without stealing it
      // for the designer's global history.
      if (isEditableTarget(document.activeElement)) return;
      e.preventDefault();
      if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) redo();
      else undo();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [template, bindings, setTemplate, setBindings]);
}
