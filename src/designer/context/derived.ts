import { filterIncomplete } from "../../fieldWarnings";
import { classifyZone, isRedZone } from "../../page/zones";
import type { Binding, Schema, Template } from "../../types";
import { FILTERABLE_TYPES } from "../useTabBar";

// Pure derivations of the editor state. They are kept apart from the hooks
// because the provider ALSO needs some of them (to feed `useTabBar`), and a
// hook file cannot be called from inside another hook without becoming a hook
// rule. Here it is only `(state) => derived` functions.

// The page's "red" band (header/footer/left/right margin), with the
// template's `undefined` already normalized to 0.
export function bandsOf(template: Template) {
  return {
    headerHeight: template.headerHeight ?? 0,
    footerHeight: template.footerHeight ?? 0,
    marginLeft: template.marginLeft ?? 0,
    marginRight: template.marginRight ?? 0,
  };
}

// The list mirrors what the canvas shows: in isolated mode only the red
// band; outside it, only the body. Otherwise the list would show a field
// hidden on the canvas, with no way to click it.
export function fieldListSchemasOf(template: Template, isolateBands: boolean): Schema[] {
  const bands = bandsOf(template);
  return template.schemas.filter((s) => {
    const inRedZone = isRedZone(classifyZone(s, template.page, bands));
    return isolateBands ? inRedZone : !inRedZone;
  });
}

// Bulk editing: several fields of the SAME type selected together (text with
// text, KPI with KPI, chart with chart) — only for those 3 types, which
// already have a clear separation between what is a "style" field (applies to
// all with no problem) and what is "data" (each has its own content/binding,
// locked for individual editing). A mixed type, or table/image/section, keeps
// the usual behavior (only the last selected one is edited).
const BULK_EDIT_TYPES = ["text", "kpi", "chart"] as const;

export function bulkEditOf(template: Template, selectedIds: string[]) {
  const selectedSchemas = template.schemas.filter((s) => selectedIds.includes(s.id));
  const bulkEditActive =
    selectedIds.length > 1 &&
    selectedSchemas.length > 1 &&
    (BULK_EDIT_TYPES as readonly string[]).includes(selectedSchemas[0].type) &&
    selectedSchemas.every((s) => s.type === selectedSchemas[0].type);
  return { selectedSchemas, bulkEditActive };
}

// A warning icon on the tab itself — the same rule as FieldList.tsx
// (fieldWarnings.ts), only split per tab: a missing binding shows up in
// "Data", an incomplete filter shows up in "Filter".
export function tabWarningsOf(selected: Schema | null, selectedBinding: Binding | undefined) {
  return {
    dadosWarning: !!selected && (selected.type === "section" || selected.type === "chart") && !selectedBinding,
    filtroWarning: !!selected && (FILTERABLE_TYPES as readonly string[]).includes(selected.type) && filterIncomplete(selectedBinding),
  };
}
