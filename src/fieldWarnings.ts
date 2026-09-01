import type { Binding, Schema } from "./types";
import type { Dict } from "./i18n";
import { en } from "./i18n/en";
import { bindingExpressionErrors, schemaExpressionErrors, type SchemaExpressionError } from "./expressions/schemaExpressions";

// Aviso de configuração incompleta — usado no ícone de alerta da lista de
// campos (FieldList.tsx) e nas abas do próprio painel do campo
// (PropertyPanelChart.tsx), pra apontar ONDE mexer, não só QUE tem
// problema. Só cobre casos que sempre são erro de verdade — tabela/texto
// sem vínculo fica de fora de propósito (pode ser conteúdo estático
// legítimo, não uma seção/gráfico esquecido pela metade).

// Vinculado a um array (chart/table/kpi) mas alguma condição de filtro tem
// coluna escolhida e valor em branco — filtro montado pela metade, que
// filtraria tudo fora sem o usuário perceber.
export function filterIncomplete(binding: Binding | undefined): boolean {
  if (!binding || (binding.type !== "chart" && binding.type !== "array" && binding.type !== "kpi")) return false;
  return (binding.filters ?? []).some((group) => group.some((cond) => cond.column && !cond.value.trim()));
}

// Expressão `{...}` (ou condição de `visibleWhen`) sintaticamente inválida em
// qualquer campo do schema/vínculo. Este aviso existe porque a GERAÇÃO é
// tolerante de propósito: expressão inválida resolve pra "" em vez de derrubar
// o PDF (ver expressions/resolve.ts). Sem o aviso, o campo apareceria em
// branco e ninguém saberia por quê — é aqui que o problema fica visível, antes
// de gerar.
export function expressionErrors(schema: Schema, binding: Binding | undefined, t: Dict = en): SchemaExpressionError[] {
  return [...schemaExpressionErrors(schema, t), ...bindingExpressionErrors(binding, t)];
}

// Mensagem pro ícone de alerta na lista de campos — null se tá tudo certo.
export function fieldWarning(schema: Schema, binding: Binding | undefined, t: Dict = en): string | null {
  // Vem primeiro: erro de sintaxe é a única coisa aqui que já está fazendo o
  // relatório sair errado (campo em branco), não só "configuração pela metade".
  // Erro antes de aviso: um deles já garante campo vazio, o outro só é
  // suspeita (chave de JSON com "/" no nome é uso legítimo).
  const problems = expressionErrors(schema, binding, t);
  const error = problems.find((p) => p.severity === "error");
  if (error) {
    return t.warnings.expressionSyntax(error.field, error.message);
  }
  const [suspicious] = problems;
  if (suspicious) {
    return t.warnings.expressionSuspicious(suspicious.field, suspicious.message);
  }
  if ((schema.type === "section" || schema.type === "chart") && !binding) {
    return t.warnings.missingBinding;
  }
  if (filterIncomplete(binding)) {
    return t.warnings.incompleteFilter;
  }
  return null;
}
