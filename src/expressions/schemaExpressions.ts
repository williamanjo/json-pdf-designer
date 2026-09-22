import type { Binding, Schema } from "../types";
import { en, type Dict } from "../i18n/locales/en";
import { expressionError, templateExpressionErrors } from "./resolve";
import { suspiciousOperator, templateSuspiciousOperators } from "./suspicious";

// Every expression ONE schema carries, and each one's syntax error.
//
// It exists because generation is deliberately tolerant (an invalid
// expression becomes an empty field, it does not bring the PDF down — see
// resolve.ts). Without this, the problem would be invisible: the field shows
// up blank and nobody knows why. Here is the other side of the bargain.

export type SchemaExpressionError = {
  // "error" = the expression does not compile, the field will certainly
  // render empty. "warning" = it compiles, but is almost certainly not what
  // the author meant (see suspicious.ts) — it may be a legitimate JSON key.
  severity: "error" | "warning";
  // Where in the schema the expression is: "content", "visibleWhen", "value",
  // "footer[2]" and so on — so the message says WHERE to fix, not only THAT.
  field: string;
  // The problematic stretch (the `{...}` with its braces, or the bare
  // condition in the case of visibleWhen).
  expression: string;
  message: string;
};

// A field whose value is a TEMPLATE (text with `{...}` in the middle) — the
// error is per token.
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

// A field whose value is a bare EXPRESSION (no braces) — today only
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
      // The totals row is a template per cell.
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
