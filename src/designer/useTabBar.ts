import { useEffect, useState } from "react";
import type { Dict } from "../i18n";
import type { Schema } from "../types";

// State/logic of the side panel's tab bar (Fields/Data/Style/Filter/Page) —
// extracted from DesignerInner (Designer.tsx) into a hook of its own. It
// lives in a .ts file (not .tsx) because it only exports a hook/types/a pure
// function, never a component — a .tsx may only export components (the oxlint
// react(only-export-components) rule, otherwise Fast Refresh breaks), same
// reason as src/bindings/builders.ts and src/canvas/geometry.ts.

// Does the selected field's type have a "Style" tab of its own? Text/table/
// chart/KPI have visual content to separate from "Data" — an image (just a
// data URI) and a section (just a group + binding) have nothing to put there.
function hasEstiloTab(type: Schema["type"]): boolean {
  return type === "text" || type === "table" || type === "chart" || type === "kpi";
}

// Field types that can get the "Filter" tab — all of them with an array
// binding behind (chart/table directly, kpi when bound). Exported:
// Designer.tsx also uses it to compute filtroWarning/filterColumns and to
// decide whether to show the "Filter" tab in the JSX, outside this hook.
export const FILTERABLE_TYPES = ["chart", "table", "kpi"] as const;

export type OptionalTab = "dados" | "estilo" | "filtro";
export type TabKey = "campos" | OptionalTab | "pagina" | "inspetor";
// Tabs that can be pinned/hidden on the "×" — the three field-editing ones
// plus "Page"/"Inspector". "Fields" is left out (there always has to be a way
// to select/add a field, otherwise nothing can be reopened).
export type HideableTab = OptionalTab | "pagina" | "inspetor";

// The tab order and which ones are pinned/hidden — a user preference, it
// survives a reload (localStorage). It tries to read; if the browser blocks
// (private mode) or there is no `localStorage` (SSR), it falls back to the
// default without breaking — it is only a UI preference, not report data.
const ALL_TAB_KEYS: TabKey[] = ["campos", "dados", "estilo", "filtro", "pagina", "inspetor"];
const TAB_ORDER_STORAGE_KEY = "json-pdf-designer:tab-order";
const HIDDEN_TABS_STORAGE_KEY = "json-pdf-designer:hidden-tabs";

function loadTabOrder(): TabKey[] {
  try {
    const raw = localStorage.getItem(TAB_ORDER_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return [...ALL_TAB_KEYS];
    const valid = parsed.filter((k): k is TabKey => ALL_TAB_KEYS.includes(k));
    // A new key that a future version adds goes at the end, instead of
    // vanishing because the saved order predates it.
    const missing = ALL_TAB_KEYS.filter((k) => !valid.includes(k));
    return [...valid, ...missing];
  } catch {
    return [...ALL_TAB_KEYS];
  }
}

function loadHiddenTabs(): ReadonlySet<HideableTab> {
  try {
    const raw = localStorage.getItem(HIDDEN_TABS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((k): k is HideableTab => k === "dados" || k === "estilo" || k === "filtro" || k === "pagina" || k === "inspetor")
    );
  } catch {
    return new Set();
  }
}

export type UseTabBarParams = {
  // The i18n dictionary (useT()) — only for the tab labels.
  t: Dict;
  // The currently selected field (null = none) — it decides eligibility for
  // Data/Style/Filter.
  selected: Schema | null;
  // The warning icon for the "Data"/"Filter" tab — computed in Designer.tsx
  // (it depends on selectedBinding/dataSources, outside this hook's scope).
  dadosWarning: boolean;
  filtroWarning: boolean;
  // The side panel's active tab — the state itself lives in DesignerInner (it
  // is read/set by much more than the tab bar: TabPanel, each panel's JSX and
  // so on), this hook only reads/writes it.
  sidebarTab: TabKey;
  setSidebarTab: (tab: TabKey) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  // The "+" menu (the list of hidden tabs) — its state also lives in
  // DesignerInner, closed by this hook when reopening/restoring a tab.
  setTabMenuOpen: (open: boolean) => void;
};

export function useTabBar({
  t,
  selected,
  dadosWarning,
  filtroWarning,
  sidebarTab,
  setSidebarTab,
  setSidebarCollapsed,
  setTabMenuOpen,
}: UseTabBarParams) {
  // "Data"/"Style"/"Filter" tabs the user closed on the "×" (see the button
  // on the tab itself) — it stays off the bar until they reopen it through
  // the "+", even for other fields whose type would normally show that tab.
  // It is a simple "pin/unpin": it is not per field, it is global to the
  // whole designer (a preference of "I do not use the Style tab", not a
  // per-field memory).
  const [hiddenOptionalTabs, setHiddenOptionalTabs] = useState<ReadonlySet<HideableTab>>(loadHiddenTabs);
  // Display order of the 5 tabs — dragging one onto another swaps their
  // positions (see reorderTabs), whether or not it is visible at the moment
  // (a hidden tab keeps its place for when it reappears).
  const [tabOrder, setTabOrder] = useState<TabKey[]>(loadTabOrder);
  const [draggedTab, setDraggedTab] = useState<TabKey | null>(null);
  // The tab hovered during a drag — it shows the indicator bar (the dragged
  // one will land BEFORE it, see reorderTabs).
  const [dragOverTab, setDragOverTab] = useState<TabKey | null>(null);

  function reorderTabs(from: TabKey, to: TabKey) {
    if (from === to) return;
    setTabOrder((prev) => {
      const next = prev.filter((k) => k !== from);
      next.splice(next.indexOf(to), 0, from);
      return next;
    });
  }

  useEffect(() => {
    try {
      localStorage.setItem(TAB_ORDER_STORAGE_KEY, JSON.stringify(tabOrder));
    } catch {
      // Private mode, full storage, or no localStorage (SSR) — the preference
      // simply does not persist, without breaking the designer.
    }
  }, [tabOrder]);
  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_TABS_STORAGE_KEY, JSON.stringify([...hiddenOptionalTabs]));
    } catch {
      // Idem.
    }
  }, [hiddenOptionalTabs]);

  // The "×" on the tab itself — it pins it as hidden (the guard below moves
  // the user off it if it was the active one). The "+" reopens it by calling
  // back with the same name.
  function hideOptionalTab(tab: HideableTab) {
    setHiddenOptionalTabs((prev) => new Set(prev).add(tab));
  }
  function showOptionalTab(tab: HideableTab) {
    setHiddenOptionalTabs((prev) => {
      const next = new Set(prev);
      next.delete(tab);
      return next;
    });
    setSidebarTab(tab);
    setSidebarCollapsed(false);
    setTabMenuOpen(false);
  }

  // A guard against an orphan tab — "Fields" always exists and never needs a
  // guard; "Page" only has to check that the user has not hidden it;
  // "Data"/"Style"/"Filter" also depend on having a selected field of the
  // right type. Any tab that stops being valid for the current situation (the
  // selection is gone, the type changed, or the user closed the active one on
  // the "×") falls back to "Fields" — it is never left with no tab marked.
  useEffect(() => {
    if (sidebarTab === "campos") return;
    if (sidebarTab === "pagina") {
      if (hiddenOptionalTabs.has("pagina")) setSidebarTab("campos");
      return;
    }
    if (sidebarTab === "inspetor") {
      if (hiddenOptionalTabs.has("inspetor")) setSidebarTab("campos");
      return;
    }
    if (!selected) {
      setSidebarTab("campos");
      return;
    }
    const stillEligible =
      (sidebarTab === "dados" && !hiddenOptionalTabs.has("dados")) ||
      (sidebarTab === "estilo" && hasEstiloTab(selected.type) && !hiddenOptionalTabs.has("estilo")) ||
      (sidebarTab === "filtro" && FILTERABLE_TYPES.includes(selected.type as (typeof FILTERABLE_TYPES)[number]) && !hiddenOptionalTabs.has("filtro"));
    if (!stillEligible) setSidebarTab("campos");
  }, [selected, sidebarTab, hiddenOptionalTabs, setSidebarTab]);

  // "Fields" is the only genuinely fixed one (no "×") — there has to be an
  // always-available way to select/add a field. The other four come and go
  // according to the selected field's type (Data/Style/Filter) and what the
  // user has already hidden (hiddenOptionalTabs, which includes "Page").
  // "removable" only marks which ones can get the "×" while active.
  const tabDefs: Record<TabKey, { label: string; eligible: boolean; warning: boolean; removable: boolean }> = {
    campos: { label: t.tabBar.fields, eligible: true, warning: false, removable: false },
    dados: { label: t.tabBar.data, eligible: !!selected, warning: dadosWarning, removable: true },
    estilo: { label: t.tabBar.style, eligible: !!selected && hasEstiloTab(selected.type), warning: false, removable: true },
    filtro: {
      label: t.tabBar.filter,
      eligible: !!selected && (FILTERABLE_TYPES as readonly string[]).includes(selected.type),
      warning: filtroWarning,
      removable: true,
    },
    pagina: { label: t.tabBar.page, eligible: true, warning: false, removable: true },
    inspetor: { label: t.tabBar.inspector, eligible: true, warning: false, removable: true },
  };
  const orderedVisibleTabs = tabOrder
    .map((key) => ({ key, ...tabDefs[key] }))
    .filter((tab) => tab.eligible && !(tab.removable && hiddenOptionalTabs.has(tab.key as HideableTab)));
  const addableOptionalTabs = (["dados", "estilo", "filtro", "pagina", "inspetor"] as const)
    .map((key) => ({ key, ...tabDefs[key] }))
    .filter((tab) => tab.eligible && hiddenOptionalTabs.has(tab.key));
  const tabsCustomized = hiddenOptionalTabs.size > 0 || tabOrder.some((k, i) => k !== ALL_TAB_KEYS[i]);

  function restoreDefaultTabs() {
    setTabOrder([...ALL_TAB_KEYS]);
    setHiddenOptionalTabs(new Set());
    setTabMenuOpen(false);
  }

  return {
    orderedVisibleTabs,
    addableOptionalTabs,
    tabsCustomized,
    reorderTabs,
    hideOptionalTab,
    showOptionalTab,
    restoreDefaultTabs,
    draggedTab,
    setDraggedTab,
    dragOverTab,
    setDragOverTab,
  };
}
