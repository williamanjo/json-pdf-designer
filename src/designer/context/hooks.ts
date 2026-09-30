import { useContext } from "react";
import type { Binding, Schema } from "../../types";
import { FILTERABLE_TYPES } from "../useTabBar";
import {
  DesignerActionsContext,
  DesignerConfigContext,
  DesignerDataContext,
  DesignerSelectionContext,
  DesignerUiContext,
  type DesignerActionsValue,
  type DesignerConfigValue,
  type DesignerDataValue,
  type DesignerSelectionValue,
  type DesignerUiValue,
} from "./contexts";
import { bulkEditOf, fieldListSchemasOf, tabWarningsOf } from "./derived";

// Access hooks and SELECTOR hooks. They live in a .ts because they export no
// component — the oxlint react(only-export-components) rule, the same
// three-file split src/i18n/ uses.
//
// The difference between the two groups matters:
//
//   access   — `useDesignerData()` and friends. They return the raw value.
//   selector — `useDesignerSelectedSchema()` and friends. They DERIVE from it.
//
// A derivation is a selector, and not a context entry, because each part pays
// only for what it reads. If `selected`/`bulkEditActive`/`fieldListSchemas`
// lived in the data context, the value would change identity whenever ANY of
// them changed, and every part that reads data would re-render because of a
// derivation it does not even use.

function required<T>(value: T | null, hook: string): T {
  if (value === null) {
    // A message naming the provider, and not a silent `null`: a designer part
    // with no state has no fallback behavior at all — it simply would not
    // render, and the developer would be staring at a hole on screen with no
    // clue why.
    // English, like every `throw` in the package (see the top of src/errors.ts):
    // this is a React COMPOSITION error, read by whoever writes the code, and
    // it does not go through describePdfError — nothing for an end user to do.
    throw new Error(`${hook} needs a <DesignerProvider> above it. <Designer> already mounts one; a standalone piece needs its own.`);
  }
  return value;
}

export function useDesignerData(): DesignerDataValue {
  return required(useContext(DesignerDataContext), "useDesignerData()");
}

export function useDesignerActions(): DesignerActionsValue {
  return required(useContext(DesignerActionsContext), "useDesignerActions()");
}

export function useDesignerSelection(): DesignerSelectionValue {
  return required(useContext(DesignerSelectionContext), "useDesignerSelection()");
}

export function useDesignerUi(): DesignerUiValue {
  return required(useContext(DesignerUiContext), "useDesignerUi()");
}

export function useDesignerConfig(): DesignerConfigValue {
  return required(useContext(DesignerConfigContext), "useDesignerConfig()");
}

// ---- seletores -----------------------------------------------------------

// O campo "principal" da seleção (o último clicado) e o vínculo dele. É o
// que o painel de propriedades edita.
export function useDesignerSelectedSchema(): { selected: Schema | null; selectedBinding: Binding | undefined } {
  const { template, bindings } = useDesignerData();
  const { selectedId } = useDesignerSelection();
  const selected = template.schemas.find((s) => s.id === selectedId) ?? null;
  return { selected, selectedBinding: selected ? bindings.find((b) => b.schemaName === selected.name) : undefined };
}

// Os campos que a lista deve mostrar — espelha o que o canvas mostra (ver
// fieldListSchemasOf).
export function useDesignerFieldListSchemas(): Schema[] {
  const { template } = useDesignerData();
  const { isolateBands } = useDesignerUi();
  return fieldListSchemasOf(template, isolateBands);
}

// Edição em bloco (vários campos do mesmo tipo).
export function useDesignerBulkEdit(): { selectedSchemas: Schema[]; bulkEditActive: boolean } {
  const { template } = useDesignerData();
  const { selectedIds } = useDesignerSelection();
  return bulkEditOf(template, selectedIds);
}

// Avisos por aba ("Dados" sem vínculo, "Filtro" incompleto).
export function useDesignerTabWarnings(): { dadosWarning: boolean; filtroWarning: boolean } {
  const { selected, selectedBinding } = useDesignerSelectedSchema();
  return tabWarningsOf(selected, selectedBinding);
}

// Colunas disponíveis pro painel de filtro — saem da fonte de dados que o
// vínculo aponta, não do schema. Vazio quando o tipo não filtra ou o
// vínculo ainda não tem path.
export function useDesignerFilterColumns(): string[] {
  const { dataSources } = useDesignerConfig();
  const { selected, selectedBinding } = useDesignerSelectedSchema();
  if (!selected || !(FILTERABLE_TYPES as readonly string[]).includes(selected.type)) return [];
  if (selectedBinding?.type !== "chart" && selectedBinding?.type !== "array" && selectedBinding?.type !== "kpi") return [];
  return dataSources?.find((d) => d.path === selectedBinding.path)?.columns ?? [];
}
