import { useEffect, useRef } from "react";
import type { Template, Binding } from "json-pdf-designer/server";

type Snapshot = { template: Template; bindings: Binding[] };
type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

// Undo/redo (Ctrl+Z / Ctrl+Shift+Z ou Ctrl+Y) — template e bindings mudam
// juntos em várias operações (ex: "Vincular" sincroniza head/content E
// cria o binding no mesmo clique). Empilhar por SETSTATE individual
// quebraria essas operações em dois passos de undo, desalinhando de novo
// head/binding.columns (o mesmo bug já corrigido antes). Em vez disso, um
// efeito compara o par [template, bindings] contra o último snapshot
// registrado — como o React batching junta as duas chamadas de setState
// de uma mesma ação síncrona num único render, o efeito roda uma vez só
// por AÇÃO, não por setState, e cada entrada do histórico já sai atômica.
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
      // Campo de texto focado (nome de coluna, fórmula, JSON de exemplo
      // etc) — deixa o undo NATIVO do input/textarea agir, sem roubar pra
      // história global do designer.
      if (isEditableTarget(document.activeElement)) return;
      e.preventDefault();
      if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) redo();
      else undo();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [template, bindings, setTemplate, setBindings]);
}
