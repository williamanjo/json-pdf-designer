import { createContext } from "react";
import type { Dispatch, DragEvent, SetStateAction } from "react";
import type { Binding, DataSourceOption, Template } from "../../types";
import type { DesignerActions } from "../actions";
import type { useSelection } from "../useSelection";
import type { useTabBar, TabKey } from "../useTabBar";

// The editor's five contexts. They live in a .ts (not .tsx) because the file
// exports no component — the oxlint react(only-export-components) rule, the
// same three-file split src/i18n/ uses (context.tsx / contextValue.ts /
// hooks.ts).
//
// WHY FIVE, and not one: each placeable part subscribes only to what it
// reads, and React re-renders a consumer when the VALUE of the context it
// reads changes identity — not when the provider re-renders. A single context
// would make every part re-render on every keystroke in a text field.
//
// The split is by FREQUENCY OF CHANGE, measured by what each thing is:
//
//   data      — changes on every template/binding edit (the hottest)
//   actions   — NEVER changes; stable identity for the provider's lifetime
//   selection — changes on every click on the canvas
//   ui        — changes on every tab switch / collapse / isolated mode
//   config    — changes when the <Designer> props change (almost never)
//
// `actions` is the load-bearing one: it is what lets a memoized part consume
// a mutator without re-rendering when the template changes. It is only stable
// because Phase 0 rewrote every mutator to read from the updater's `prev`
// instead of a closure — see the opening comment of designer/actions.ts.
//
// The default is `null` on all of them, and the access hooks throw with a
// message naming the provider. Unlike I18nContext (whose default is the
// English dictionary, so a kit component works standalone): a designer part
// with no template has no fallback behavior at all — with no state it renders
// nothing, and a silent `null` would become "the part does not show up and
// does not say why".

export type DesignerDataValue = {
  template: Template;
  bindings: Binding[];
};

// Every mutator. `DesignerActions` is already the factory's `ReturnType`, so
// adding an action there shows up here with no edit.
export type DesignerActionsValue = DesignerActions;

export type DesignerSelectionValue = ReturnType<typeof useSelection>;

export type DesignerUiValue = ReturnType<typeof useTabBar> & {
  sidebarTab: TabKey;
  setSidebarTab: Dispatch<SetStateAction<TabKey>>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  tabMenuOpen: boolean;
  setTabMenuOpen: Dispatch<SetStateAction<boolean>>;
  // Isolated mode is UI (what the canvas SHOWS); flipping the switch is an
  // action (`actions.toggleIsolateBands`, which clears the selection too).
  isolateBands: boolean;
  // The error from the last background image upload — `null` when there was
  // none. Written by the mutator, read by the page settings.
  backgroundUploadError: string | null;
};

export type DesignerConfigValue = {
  dataSources: DataSourceOption[] | undefined;
  onCanvasDrop: ((e: DragEvent<HTMLDivElement>) => void) | undefined;
  // Grid step in mm. It aligns dragging, resizing, the birth of a new field
  // and pasting — all four, since 3.0.0.
  gridSizeMm: number | undefined;
  // Selecting a field reopens a collapsed sidebar. Default `true` (it is the
  // 2.x behavior); `false` for a layout where the sidebar is not the answer
  // to "I clicked a field".
  expandOnSelect: boolean;
};

export const DesignerDataContext = createContext<DesignerDataValue | null>(null);
export const DesignerActionsContext = createContext<DesignerActionsValue | null>(null);
export const DesignerSelectionContext = createContext<DesignerSelectionValue | null>(null);
export const DesignerUiContext = createContext<DesignerUiValue | null>(null);
export const DesignerConfigContext = createContext<DesignerConfigValue | null>(null);
