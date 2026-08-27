import type { Binding, Schema } from "./types";
import type { Dict } from "./i18n";

// Aviso de configuração incompleta — usado no ícone de alerta da lista de
// campos (FieldList.tsx) e nas abas do próprio painel do campo
// (PropertyPanelChart.tsx), pra apontar ONDE mexer, não só QUE tem
// problema. Só cobre casos que sempre são erro de verdade — tabela/texto
// sem vínculo fica de fora de propósito (pode ser conteúdo estático
// legítimo, não uma seção/gráfico esquecido pela metade).

// Vinculado a um array (ChartSchema) mas alguma condição de filtro tem
// coluna escolhida e valor em branco — filtro montado pela metade, que
// filtraria tudo fora sem o usuário perceber.
export function chartFilterIncomplete(binding: Binding | undefined): boolean {
  if (!binding || binding.type !== "chart") return false;
  return (binding.filters ?? []).some((group) => group.some((cond) => cond.column && !cond.value.trim()));
}

// Mensagem pro ícone de alerta na lista de campos — null se tá tudo certo.
export function fieldWarning(schema: Schema, binding: Binding | undefined, t: Dict): string | null {
  if ((schema.type === "section" || schema.type === "chart") && !binding) {
    return t.warnings.missingBinding;
  }
  if (chartFilterIncomplete(binding)) {
    return t.warnings.incompleteFilter;
  }
  return null;
}
