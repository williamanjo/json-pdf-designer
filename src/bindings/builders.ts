import type { Binding, KpiAggregation } from "../types";
import { parseColumnsInput } from "./columnParsing";
import { splitDelimited } from "./splitDelimited";

// Pure applyBinding logic (see BindingEditor.tsx), one function per
// schema.type — each one validates only its own set of fields and
// returns the new Binding (or undefined when validation fails, in which
// case the caller does not update the saved binding). Extracted into a
// module of their own (instead of living inside BindingEditor.tsx) so they
// are testable without mounting the React component, and so Fast Refresh
// does not break (it requires a .tsx file to export components only).

export function buildSectionBinding(schemaName: string, draft: string): Binding | undefined {
  if (!draft.trim()) return undefined;
  return { schemaName, type: "section", path: draft.trim() };
}

export function buildChartBinding(
  schemaName: string,
  draft: string,
  label: string,
  value: string,
  existingBinding: Binding | undefined
): Binding | undefined {
  if (!draft.trim() || !label || !value) return undefined;
  // The filter (its own "Filter" tab in the chart panel, see
  // PropertyPanelChart.tsx) is not edited here — this only preserves what
  // was already saved when the rest of the binding changes (source/column).
  return {
    schemaName,
    type: "chart",
    path: draft.trim(),
    labelColumn: label,
    valueColumn: value,
    filters: existingBinding?.type === "chart" ? existingBinding.filters : undefined,
  };
}

export function buildTableBinding(schemaName: string, draft: string, cols: string, existingBinding: Binding | undefined): Binding | undefined {
  const path = draft.trim();
  if (path) {
    const columns = parseColumnsInput(cols);
    if (columns.length === 0) return undefined;
    // The filter (its own "Filter" tab, see Designer.tsx) is not edited
    // here — this only preserves what was already saved when the rest
    // of the binding changes (source/columns), same rule as the chart above.
    return {
      schemaName,
      type: "array",
      path,
      columns,
      filters: existingBinding?.type === "array" ? existingBinding.filters : undefined,
    };
  }
  const paths = splitDelimited(cols);
  if (paths.length === 0) return undefined;
  return { schemaName, type: "keyvalue", paths };
}

export function buildKpiBinding(
  schemaName: string,
  draft: string,
  value: string,
  aggregation: KpiAggregation,
  existingBinding: Binding | undefined
): Binding | undefined {
  if (!draft.trim()) return undefined;
  if (aggregation !== "count" && !value) return undefined;
  return {
    schemaName,
    type: "kpi",
    path: draft.trim(),
    valueColumn: aggregation === "count" ? undefined : value,
    aggregation,
    filters: existingBinding?.type === "kpi" ? existingBinding.filters : undefined,
  };
}

export function buildTemplateBinding(schemaName: string, draft: string): Binding | undefined {
  if (!draft.trim()) return undefined;
  return { schemaName, type: "template", template: draft };
}
