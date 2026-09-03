import { useEffect, useState } from "react";
import type { KpiElementKey } from "../types";

// Seleção de campos do canvas — extraído de DesignerInner (Designer.tsx)
// pra um hook próprio. Fica num arquivo .ts (não .tsx) porque só exporta
// hook, nunca componente — um .tsx só pode exportar componente (regra
// oxlint react(only-export-components), quebra o Fast Refresh senão),
// mesmo motivo de src/bindingBuilders.ts e src/canvasGeometry.ts.

export type UseSelectionParams = {
  // Chamado quando o usuário SELECIONA algo (clique ou caixa de seleção) —
  // nunca ao limpar a seleção. O DesignerProvider liga isto em
  // "reabre a sidebar colapsada", e a config `expandOnSelect={false}`
  // simplesmente não passa nada.
  //
  // Antes era `setSidebarCollapsed` direto. Invertido porque seleção não
  // sabe o que é sidebar: com a decomposição existe layout SEM sidebar, e
  // ali "reabrir" não é um conceito. O hook agora só anuncia atividade.
  onActivity?: () => void;
};

export function useSelection({ onActivity }: UseSelectionParams = {}) {
  // Seleção múltipla (Ctrl/Cmd+clique) — o último clicado é o "principal"
  // (quem aparece no painel de propriedades); os demais só ganham
  // destaque no canvas e movem junto quando o principal é arrastado.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedId = selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;
  // Sub-elemento de KPI focado (ícone/título/valor/legenda) — só faz
  // sentido com exatamente 1 KPI selecionado (ver KpiField.tsx/
  // FieldList.tsx/PropertyPanelKpi.tsx); qualquer troca de seleção
  // (campo diferente, ou virando seleção múltipla) limpa o foco.
  const [selectedKpiElement, setSelectedKpiElement] = useState<KpiElementKey | null>(null);
  useEffect(() => {
    setSelectedKpiElement(null);
  }, [selectedId, selectedIds.length]);

  function handleSelect(id: string | null, additive?: boolean) {
    if (id === null) {
      setSelectedIds([]);
      return;
    }
    // Não força troca de aba — fica onde o usuário já estava (Campos
    // continua Campos, Estilo continua Estilo se o novo campo também tem
    // Estilo, etc.). Só reabre se a aba tava fechada (duplo clique). A
    // guarda mais abaixo (useEffect em useTabBar) cuida de sair de uma
    // aba que não faz mais sentido pro tipo do novo campo (ex: tava em
    // "Filtro" e selecionou uma seção).
    onActivity?.();
    if (!additive) {
      setSelectedIds([id]);
      return;
    }
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Caixa de seleção (arrastar no fundo do canvas) — substitui a seleção
  // pelos ids que caíram dentro da caixa, ou soma (Ctrl/Cmd segurado).
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
