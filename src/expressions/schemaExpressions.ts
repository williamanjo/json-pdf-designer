import type { Binding, Schema } from "../types";
import { en, type Dict } from "../i18n/locales/en";
import { expressionError, templateExpressionErrors } from "./resolve";
import { suspiciousOperator, templateSuspiciousOperators } from "./suspicious";

// Todas as expressões que UM schema carrega, e o erro de sintaxe de cada uma.
//
// Existe porque a geração é tolerante de propósito (expressão inválida vira
// campo vazio, não derruba o PDF — ver resolve.ts). Sem isto, o problema
// ficaria invisível: o campo aparece em branco e ninguém sabe por quê. Aqui é
// o outro lado do acordo — o editor aponta, antes de gerar.

export type SchemaExpressionError = {
  // "error" = a expressão não compila, o campo renderiza vazio com certeza.
  // "warning" = compila, mas quase certamente não é o que o autor quis (ver
  // suspicious.ts) — pode ser chave de JSON legítima, então não é erro.
  severity: "error" | "warning";
  // Onde no schema está a expressão: "content", "visibleWhen", "value",
  // "footer[2]" etc. — pra mensagem dizer ONDE mexer, não só QUE tem erro.
  field: string;
  // O trecho problemático (`{...}` com as chaves, ou a condição nua no caso
  // do visibleWhen).
  expression: string;
  message: string;
};

// Um campo cujo valor é um TEMPLATE (texto com `{...}` no meio) — o erro é
// por token.
function fromTemplate(field: string, template: string | undefined, t: Dict): SchemaExpressionError[] {
  if (!template) return [];
  return [
    ...templateExpressionErrors(template, t).map(
      (e) => ({ field, expression: e.token, message: e.message, severity: "error" }) as const
    ),
    ...templateSuspiciousOperators(template, t).map(
      (e) => ({ field, expression: e.token, message: e.message, severity: "warning" }) as const
    ),
  ];
}

// Um campo cujo valor é uma EXPRESSÃO nua (sem chaves) — hoje só o
// `visibleWhen`.
function fromCondition(field: string, condition: string | undefined, t: Dict): SchemaExpressionError[] {
  const trimmed = condition?.trim();
  if (!trimmed) return [];
  const message = expressionError(trimmed, t);
  if (message) return [{ field, expression: trimmed, message, severity: "error" }];
  const suspicious = suspiciousOperator(trimmed, t);
  return suspicious ? [{ field, expression: trimmed, message: suspicious, severity: "warning" }] : [];
}

export function schemaExpressionErrors(schema: Schema, t: Dict = en): SchemaExpressionError[] {
  const errors = fromCondition("visibleWhen", schema.visibleWhen, t);

  switch (schema.type) {
    case "text":
      errors.push(...fromTemplate("content", schema.content, t));
      break;
    case "kpi":
      errors.push(...fromTemplate("title", schema.title, t));
      errors.push(...fromTemplate("value", schema.value, t));
      errors.push(...fromTemplate("subtitle", schema.subtitle, t));
      break;
    case "table":
      // A linha de totais é um template por célula.
      (schema.footer ?? []).forEach((cell, i) => errors.push(...fromTemplate(`footer[${i}]`, cell, t)));
      break;
    default:
      break;
  }

  return errors;
}

// Fórmula de coluna calculada de tabela — mora no `Binding` ("array"), não no
// schema, então entra por uma função própria. `TableColumn` é ou a chave crua do
// JSON (string) ou `{ label, formula }`.
//
// A fórmula é um TEMPLATE, não uma expressão nua: `resolveRowFromItem` a passa
// por `renderTemplate`, e um `"FAT-{fatura}"` (texto fixo + token) é uso
// legítimo. Validar como expressão nua acusava toda fórmula normal como erro de
// sintaxe — falso positivo pego pelo painel de problemas do example
// report-builder, olhando os templates que já vinham no pacote.
export function bindingExpressionErrors(binding: Binding | undefined, t: Dict = en): SchemaExpressionError[] {
  if (!binding || binding.type !== "array") return [];
  const errors: SchemaExpressionError[] = [];
  binding.columns.forEach((col, i) => {
    if (typeof col === "string") return;
    errors.push(...fromTemplate(`columns[${i}].formula`, col.formula, t));
  });
  return errors;
}
