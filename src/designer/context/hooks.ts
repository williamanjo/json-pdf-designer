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

// Hooks de acesso e hooks SELETORES. Ficam num .ts porque não exportam
// componente — regra oxlint react(only-export-components), mesmo split de
// três arquivos que src/i18n/ usa.
//
// A diferença entre os dois grupos importa:
//
//   acesso   — `useDesignerData()` e cia. Devolvem o value do contexto cru.
//   seletor  — `useDesignerSelectedSchema()` e cia. DERIVAM do value.
//
// Derivado é seletor, e não entrada de contexto, porque cada peça paga só
// pelo que ela lê. Se `selected`/`bulkEditActive`/`fieldListSchemas`
// morassem no contexto de dados, o value trocaria de identidade sempre que
// QUALQUER um deles mudasse, e toda peça que lê dados re-renderizaria por
// causa de um derivado que ela nem usa.

function required<T>(value: T | null, hook: string): T {
  if (value === null) {
    // Mensagem nomeando o provider, e não um `null` silencioso: peça do
    // designer sem estado não tem comportamento de fallback nenhum — ela
    // simplesmente não renderizaria, e o desenvolvedor ficaria olhando um
    // buraco na tela sem pista de por quê.
    // Inglês, como todo `throw` do pacote (ver o topo de src/errors.ts): isto
    // é erro de COMPOSIÇÃO React, lido por quem escreve o código, e não passa
    // por describePdfError — não há nada pra o usuário final fazer.
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
