import { useEffect, useState } from "react";
import type { KpiElementKey } from "../types";

// Canvas field selection — extracted from DesignerInner (Designer.tsx) into
// a hook of its own. It lives in a .ts file (not .tsx) because it only
// exports a hook, never a component — a .tsx may only export components (the
// oxlint react(only-export-components) rule, otherwise Fast Refresh breaks),
// same reason as src/bindings/builders.ts and src/canvas/geometry.ts.

export type UseSelectionParams = {
  // Called when the user SELECTS something (a click or the marquee) — never
  // when clearing the selection. The DesignerProvider wires this to "reopen
  // the collapsed sidebar", and `expandOnSelect={false}` simply passes nothing.
  //
  // It used to be `setSidebarCollapsed` directly. Inverted because the
  // selection does not know what a sidebar is: with the decomposition there
  // are layouts with NO sidebar, where "reopen" is not a concept. The hook
  // now only announces activity.
  onActivity?: () => void;
};

export function useSelection({ onActivity }: UseSelectionParams = {}) {
  // Multiple selection (Ctrl/Cmd+click) — the last one clicked is the
  // "primary" (the one that appears in the property panel); the others only
  // get a highlight on the canvas and move along when the primary is dragged.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;
  // The focused KPI sub-element (icon/title/value/subtitle) — it only makes
  // sense with exactly 1 KPI selected (see KpiField.tsx/FieldList.tsx/
  // PropertyPanelKpi.tsx); any change of selection (a different field, or
  // becoming a multiple selection) clears the focus.
  const [selectedKpiElement, setSelectedKpiElement] = useState<KpiElementKey | null>(null);
  useEffect(() => {
    setSelectedKpiElement(null);
  }, [selectedId, selectedIds.length]);

  function handleSelect(id: string | null, additive?: boolean) {
    if (id === null) {
      setSelectedIds([]);
      return;
    }
    // It does not force a tab switch — it stays where the user already was
    // (Fields stays Fields, Style stays Style if the new field also has a
    // Style, and so on). It only reopens if the tab was closed (double
    // click). The guard further down (a useEffect in useTabBar) takes care of
    // leaving a tab that no longer makes sense for the new field's type (e.g.
    // it was on "Filter" and a section was selected).
    onActivity?.();
    if (!additive) {
      setSelectedIds([id]);
      return;
    }
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // The marquee (dragging on the canvas background) — it replaces the
  // selection with the ids that fell inside the box, or adds to it (Ctrl/Cmd held).
  function handleSelectMany(ids: string[], additive?: boolean) {
    if (ids.length > 0) {
      onActivity?.();
    }
    setSelectedIds((prev) => {
      if (!additive) return ids;
      const merged = new Set(prev);
      for (const id of ids) merged.add(id);
      return Array.from(merged);
    });
  }

  return { selectedIds, setSelectedIds, selectedId, selectedKpiElement, setSelectedKpiElement, handleSelect, handleSelectMany };
}
