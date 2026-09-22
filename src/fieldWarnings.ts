import type { Binding, Schema } from "./types";
import type { Dict } from "./i18n";
import { en } from "./i18n/locales/en";
import { bindingExpressionErrors, schemaExpressionErrors, type SchemaExpressionError } from "./expressions/schemaExpressions";

// A warning about incomplete configuration — used by the alert icon in the
// field list (FieldList.tsx) and by the tabs of the field's own panel
// (PropertyPanelChart.tsx), to point at WHERE to fix, not merely THAT there
// is a problem. It only covers cases that are always a real mistake — a
// table/text with no binding is deliberately left out (it may be legitimate
// static content, not a half-forgotten section/chart).

// Bound to an array (chart/table/kpi) but some filter condition has a chosen
// column and a blank value — a half-built filter, which would filter
// everything out without the user noticing.
export function filterIncomplete(binding: Binding | undefined): boolean {
  if (!binding || (binding.type !== "chart" && binding.type !== "array" && binding.type !== "kpi")) return false;
  return (binding.filters ?? []).some((group) => group.some((cond) => cond.column && !cond.value.trim()));
}

// A syntactically invalid `{...}` expression (or `visibleWhen` condition) in
// any field of the schema/binding. This warning exists because GENERATION is
// deliberately tolerant: an invalid expression resolves to "" instead of
// bringing the PDF down (see expressions/resolve.ts). Without the warning,
// the field would show up blank and nobody would know why — this is where the
// problem becomes visible, before generating.
export function expressionErrors(schema: Schema, binding: Binding | undefined, t: Dict = en): SchemaExpressionError[] {
  return [...schemaExpressionErrors(schema, t), ...bindingExpressionErrors(binding, t)];
}

// The message for the alert icon in the field list — null if all is well.
export function fieldWarning(schema: Schema, binding: Binding | undefined, t: Dict = en): string | null {
  // It comes first: a syntax error is the only thing here that is already
  // making the report come out wrong (a blank field), not merely "half
  // configured". An error before a warning: one of them guarantees an empty
  // field, the other is only a suspicion (a JSON key with "/" is legitimate).
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
