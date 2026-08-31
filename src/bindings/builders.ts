import type { Binding, KpiAggregation } from "../types";
import { parseColumnsInput } from "./columnParsing";
import { splitDelimited } from "./splitDelimited";

// Lógica pura de applyBinding (ver BindingEditor.tsx), uma função por
// schema.type — cada uma só valida seu próprio conjunto de campos e
// devolve o Binding novo (ou undefined quando a validação não passa,
// caso em que o chamador não atualiza o vínculo salvo). Extraídas pra um
// módulo próprio (em vez de dentro de BindingEditor.tsx) pra serem
// testáveis sem montar o componente React e pra não quebrar o Fast
// Refresh (que exige que um arquivo .tsx só exporte componentes).

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
  // Filtro (aba própria "Filtro" no painel do gráfico, ver
  // PropertyPanelChart.tsx) não é editado aqui — só preserva o que já
  // tava salvo quando o resto do vínculo muda (fonte/coluna).
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
    // Filtro (aba própria "Filtro", ver Designer.tsx) não é editado
    // aqui — só preserva o que já tava salvo quando o resto do
    // vínculo muda (fonte/colunas), mesma regra do chart acima.
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
