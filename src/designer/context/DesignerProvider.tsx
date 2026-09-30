import { useMemo, useRef, useState } from "react";
import { DesignerZoomProvider } from "./zoom";
import type { Dispatch, DragEvent, ReactNode, SetStateAction } from "react";
import type { Binding, DataSourceOption, Template } from "../../types";
import { useT } from "../../i18n";
import { makeDesignerActions, type DesignerActions, type DesignerLatest } from "../actions";
import { useClipboardAndDelete } from "../useClipboardAndDelete";
import { useSelection } from "../useSelection";
import { useTabBar, type TabKey } from "../useTabBar";
import { tabWarningsOf } from "./derived";
import {
  DesignerActionsContext,
  DesignerConfigContext,
  DesignerDataContext,
  DesignerSelectionContext,
  DesignerUiContext,
} from "./contexts";

export type DesignerProviderProps = {
  template: Template;
  // It accepts React's setState directly (functional form included) — this
  // avoids overwriting a concurrent change because of a stale closure (e.g.
  // two fields added in quick succession, before the first render
  // happened).
  onChangeTemplate: Dispatch<SetStateAction<Template>>;
  bindings: Binding[];
  onChangeBindings: Dispatch<SetStateAction<Binding[]>>;
  // A passthrough to the canvas container — used by anyone who wants to drop
  // external fields (e.g. a JSON field explorer) straight onto the page.
  onCanvasDrop?: (e: DragEvent<HTMLDivElement>) => void;
  // Known arrays of the sample JSON — they become the "Data Source" dropdown
  // in the table binding (see BindingEditor). Without it, a freely typed path.
  dataSources?: DataSourceOption[];
  // Grid step in mm (default 5, see units.ts). It aligns dragging, resizing,
  // the birth of a field and pasting.
  gridSizeMm?: number;
  // Clicking a field reopens a collapsed sidebar (default true).
  expandOnSelect?: boolean;
  children: ReactNode;
};

// All of the editor's state lives here, and each placeable part reads what
// it needs through a hook. The <Designer> is a preset that assembles this
// provider plus a layout; whoever wants their own layout assembles it by hand.
//
// It does NOT require an I18nProvider around it: `useT()` has a default (the
// English dictionary), so the provider works standalone. The <Designer> still
// wraps with I18nProvider to honor the `locale` prop.
export function DesignerProvider({
  template,
  onChangeTemplate,
  bindings,
  onChangeBindings,
  onCanvasDrop,
  dataSources,
  gridSizeMm,
  expandOnSelect = true,
  children,
}: DesignerProviderProps) {
  const t = useT();

  // ---- UI state ----------------------------------------------------------
  // The right sidebar's tab — "Fields" (the list) and "Page"
  // (size/orientation/margin/background) are always reachable; "Data"/
  // "Style"/"Filter" only exist while a field is selected (see the guard
  // inside useTabBar, which switches back to "fields" when the selection
  // disappears). Declared early because useSelection/useTabBar below need
  // the setters ready.
  const [sidebarTab, setSidebarTab] = useState<TabKey>("campos");
  // A double click on the active tab closes (collapses) the content; a
  // single click reopens it — see TabPanel/PropertyPanelChart.tsx.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // The "+" menu (it lists the hidden tabs that would fit the current field).
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  // Isolated mode: it hides the body and shows only header/footer/margin, so
  // those bands can be edited without the rest of the page getting in the way.
  const [isolateBands, setIsolateBands] = useState(false);
  const [backgroundUploadError, setBackgroundUploadError] = useState<string | null>(null);

  // ---- selection ---------------------------------------------------------
  // `onActivity` instead of `setSidebarCollapsed`: the selection does not
  // know what a sidebar is. This provider wires the two, and
  // `expandOnSelect={false}` turns it off — needed where there is no sidebar.
  const selection = useSelection({ onActivity: expandOnSelect ? () => setSidebarCollapsed(false) : undefined });
  const { selectedIds, setSelectedIds, selectedId } = selection;

  // ---- actions -----------------------------------------------------------
  // A ref with everything the actions need to READ — and with the setters
  // themselves — assigned during render, read only at event time. That is
  // what allows creating the actions ONCE, with an empty dependency list;
  // see the opening comment of designer/actions.ts.
  const latest = useRef<DesignerLatest>({
    template,
    bindings,
    selectedId,
    isolateBands,
    t,
    dataSources,
    gridSizeMm,
    onChangeTemplate,
    onChangeBindings,
    setSelectedIds,
    setIsolateBands,
    setBackgroundUploadError,
  });
  latest.current = {
    template,
    bindings,
    selectedId,
    isolateBands,
    t,
    dataSources,
    gridSizeMm,
    onChangeTemplate,
    onChangeBindings,
    setSelectedIds,
    setIsolateBands,
    setBackgroundUploadError,
  };

  // `useRef` with a lazy init, and NOT `useMemo(..., [])`: this object's
  // identity is load-bearing (it goes into the context the parts consume, and
  // an identity change breaks `React.memo` on all of them), and React
  // documents `useMemo` as a performance HINT whose cache may be discarded.
  // `useRef` is a guarantee.
  const actionsRef = useRef<DesignerActions | null>(null);
  actionsRef.current ??= makeDesignerActions(latest);
  const actions = actionsRef.current;

  // ---- keyboard shortcuts ------------------------------------------------
  // Delete/Backspace (removes the selected ones) and Ctrl+C/Ctrl+V
  // (copy/paste). Registered HERE, exactly once: in a part, whoever does not
  // render the canvas would silently lose Delete/Ctrl+V; in two parts, every
  // paste would fire twice.
  useClipboardAndDelete({ template, bindings, selectedIds, setSelectedIds, onChangeTemplate, onChangeBindings, t, gridSizeMm });

  // ---- derivations the tab bar needs -------------------------------------
  // Only what `useTabBar` consumes. The rest of the derivations are selector
  // hooks (see ./hooks.ts) — each part pays for computing what it reads
  // itself, instead of everyone re-rendering over someone else's derivation.
  const selected = template.schemas.find((s) => s.id === selectedId) ?? null;
  const selectedBinding = selected ? bindings.find((b) => b.schemaName === selected.name) : undefined;
  const { dadosWarning, filtroWarning } = tabWarningsOf(selected, selectedBinding);

  const tabBar = useTabBar({ t, selected, dadosWarning, filtroWarning, sidebarTab, setSidebarTab, setSidebarCollapsed, setTabMenuOpen });

  // ---- values ------------------------------------------------------------
  // A `useMemo` per context, with each one's real dependencies: that is what
  // makes the split into five worth it. With no memo, every value would
  // change identity on every render of the provider and the five contexts
  // would re-render all their consumers together — exactly what the split
  // avoids.
  const dataValue = useMemo(() => ({ template, bindings }), [template, bindings]);
  const configValue = useMemo(
    () => ({ dataSources, onCanvasDrop, gridSizeMm, expandOnSelect }),
    [dataSources, onCanvasDrop, gridSizeMm, expandOnSelect]
  );
  const uiValue = useMemo(
    () => ({
      ...tabBar,
      sidebarTab,
      setSidebarTab,
      sidebarCollapsed,
      setSidebarCollapsed,
      tabMenuOpen,
      setTabMenuOpen,
      isolateBands,
      backgroundUploadError,
    }),
    [tabBar, sidebarTab, sidebarCollapsed, tabMenuOpen, isolateBands, backgroundUploadError]
  );

  return (
    // `actions` is deliberately outside the memos: its identity is the same
    // forever (the useRef above), so there is nothing to memoize. `selection`
    // comes out of the hook as a new object on every render — memoizing would
    // not help, because any click really does change `selectedIds`.
    <DesignerConfigContext.Provider value={configValue}>
      <DesignerActionsContext.Provider value={actions}>
        <DesignerDataContext.Provider value={dataValue}>
          <DesignerSelectionContext.Provider value={selection}>
            <DesignerUiContext.Provider value={uiValue}>
              {/* Zoom LAST, inside the data context: it reads `template.page` to
                  compute the "fit width/height", and it is deliberately the
                  innermost context — whoever does not call `useDesignerZoom()`
                  does not re-render when the zoom changes. */}
              <DesignerZoomProvider>{children}</DesignerZoomProvider>
            </DesignerUiContext.Provider>
          </DesignerSelectionContext.Provider>
        </DesignerDataContext.Provider>
      </DesignerActionsContext.Provider>
    </DesignerConfigContext.Provider>
  );
}
