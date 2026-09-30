import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Dict } from "../i18n";
import { uid } from "../schemaFactory";
import type { Binding, Schema, Template } from "../types";
import { uniqueSchemaName } from "./helpers";
import { GRID_SIZE_MM, snapToGrid } from "../page/units";

// Delete/copy/paste for the canvas — extracted from DesignerInner
// (Designer.tsx) into a hook of its own. It lives in a .ts file (not .tsx)
// because it only exports a hook, never a component — a .tsx may only export
// components (the oxlint react(only-export-components) rule, otherwise Fast
// Refresh breaks), same reason as src/bindings/builders.ts.

// Where a pasted field is born: one grid step below/right of the original,
// clamped inside the page.
//
// Extracted from the handler to be TESTABLE: the rest of the hook is two
// `useEffect` that register keyboard listeners, and exercising that would
// require jsdom (which the whole suite avoids — see test/components/ui/,
// which uses renderToStaticMarkup). The position rule is the part that can
// be wrong, and it is now a pure function.
export function pastePosition(
  s: Pick<Schema, "x" | "y" | "width" | "height">,
  page: { width: number; height: number },
  gridMm: number
): { x: number; y: number } {
  // It shifts by +1 grid step (not a raw +8mm — dragging ALWAYS lands on a
  // multiple of gridMm through snapToGrid; pasting without aligning leaves it
  // off the grid until the user drags by hand to "put it back"). It clamps
  // inside the page on top of that — a field already against the edge (a wide
  // table with x+width near the end) does not leave the grid.
  //
  // It rounds the limit DOWN (not snapToGrid, which rounds to the nearest and
  // could overflow the page by up to half a step).
  const maxX = Math.floor(Math.max(0, page.width - s.width) / gridMm) * gridMm;
  const maxY = Math.floor(Math.max(0, page.height - s.height) / gridMm) * gridMm;
  return {
    x: Math.min(snapToGrid(s.x + gridMm, gridMm), maxX),
    y: Math.min(snapToGrid(s.y + gridMm, gridMm), maxY),
  };
}

export type UseClipboardAndDeleteParams = {
  template: Template;
  bindings: Binding[];
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  onChangeTemplate: Dispatch<SetStateAction<Template>>;
  onChangeBindings: Dispatch<SetStateAction<Binding[]>>;
  // The i18n dictionary (useT()) — only for the "paste" name suffix
  // (t.schemaDefaults.pasteSuffix).
  t: Dict;
  // The grid step, coming from the <Designer> config. Optional: without it
  // pasting used GRID_SIZE_MM directly, so a consumer with `gridSizeMm={2}`
  // had dragging aligned to 2mm and pasting to 5mm — the pasted field was
  // born off their grid.
  gridSizeMm?: number;
};

// It only registers the 2 keyboard listeners (delete and copy/paste) — it
// returns nothing, the two effects are self-contained (the clipboard itself
// is an internal useRef, it never needed to leak out of the original component).
export function useClipboardAndDelete({
  template,
  bindings,
  selectedIds,
  setSelectedIds,
  onChangeTemplate,
  onChangeBindings,
  t,
  gridSizeMm = GRID_SIZE_MM,
}: UseClipboardAndDeleteParams): void {
  // Delete/Backspace removes ALL the selected fields — only when focus is not
  // in an input/textarea/select/contenteditable, otherwise it would eat the
  // backspace/delete of normal typing (field name, inline editing and so on).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (selectedIds.length === 0) return;
      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isEditable) return;
      e.preventDefault();
      const removedIds = new Set(selectedIds);
      const removedNames = template.schemas.filter((s) => removedIds.has(s.id)).map((s) => s.name);
      onChangeTemplate((prev) => ({
        ...prev,
        schemas: prev.schemas
          .filter((s) => !removedIds.has(s.id))
          .map((s) => (s.sectionId && removedIds.has(s.sectionId) ? { ...s, sectionId: undefined } : s)),
      }));
      onChangeBindings((prev) => prev.filter((b) => !removedNames.includes(b.schemaName)));
      setSelectedIds([]);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, template.schemas, onChangeTemplate, onChangeBindings, setSelectedIds]);

  // Copy/paste (Ctrl+C / Ctrl+V) — a clipboard of our own kept in a ref (it
  // does not use the system clipboard, so no browser permission is asked).
  // Pasting creates a copy with a new id/name, offset (+8mm) from the
  // original, already selected so it can be dragged right away. A field that
  // is a section member keeps the SAME sectionId as the original section (it
  // still exists, it was not duplicated) — it is only remapped to the new
  // section when that one was ALSO selected at copy time (a whole copied
  // group stays together in the copy, without joining the old section).
  const clipboardRef = useRef<{ schemas: Schema[]; bindings: Binding[] } | null>(null);
  useEffect(() => {
    function isEditable(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;
    }

    function onKeyDown(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (!mod || (key !== "c" && key !== "v")) return;
      if (isEditable(document.activeElement)) return;

      if (key === "c") {
        if (selectedIds.length === 0) return;
        e.preventDefault();
        const idSet = new Set(selectedIds);
        const schemas = template.schemas.filter((s) => idSet.has(s.id));
        if (schemas.length === 0) return;
        const names = new Set(schemas.map((s) => s.name));
        const copiedBindings = bindings.filter((b) => names.has(b.schemaName));
        clipboardRef.current = JSON.parse(JSON.stringify({ schemas, bindings: copiedBindings }));
        return;
      }

      const clip = clipboardRef.current;
      if (!clip || clip.schemas.length === 0) return;
      e.preventDefault();
      const idMap = new Map<string, string>();
      clip.schemas.forEach((s) => idMap.set(s.id, uid()));
      const usedNames = new Set(template.schemas.map((s) => s.name));
      const nameMap = new Map<string, string>();
      const pasted = clip.schemas.map((s) => {
        const newName = uniqueSchemaName(s.name, usedNames, t.schemaDefaults.pasteSuffix);
        nameMap.set(s.name, newName);
        return {
          ...s,
          id: idMap.get(s.id) as string,
          name: newName,
          ...pastePosition(s, template.page, gridSizeMm),
          sectionId: s.sectionId && idMap.has(s.sectionId) ? idMap.get(s.sectionId) : s.sectionId,
        };
      });
      const pastedBindings = clip.bindings
        .filter((b) => nameMap.has(b.schemaName))
        .map((b) => ({ ...b, schemaName: nameMap.get(b.schemaName) as string }));
      onChangeTemplate((prev) => ({ ...prev, schemas: [...prev.schemas, ...pasted] }));
      onChangeBindings((prev) => [...prev, ...pastedBindings]);
      setSelectedIds(pasted.map((s) => s.id));
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // The whole `template.page`, and not `.width`/`.height` separately: the
    // handler passes the object to `pastePosition`. It does not really widen
    // anything — every path that changes the page (setPagePreset/
    // setPageOrientation) swaps the object, so identity changes with values.
  }, [selectedIds, template.schemas, template.page, bindings, onChangeTemplate, onChangeBindings, t, setSelectedIds, gridSizeMm]);
}
