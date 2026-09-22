import { dictFor, expressionErrors } from "json-pdf-designer/server";
import type { Binding, Locale, Schema, Template, TemplatePage } from "json-pdf-designer/server";
import { shellDict } from "../i18n";

// Everything that is crooked in the template BEFORE generating.
//
// It exists because generation is deliberately tolerant: an invalid expression
// resolves to empty instead of bringing the PDF down. Great for not losing a
// 200-page report over one comma — but without this the problem is invisible
// (the field shows up blank and nobody knows why). This is the other side of
// the bargain.
//
// The expression scan comes from a public export of the package:
// `expressionErrors` returns every expression a field carries (including the
// `visibleWhen` and the column formulas), and `dictFor(locale)` gives the
// dictionary as a VALUE — the `useT()` hook only exists inside a component,
// and this runs outside the React tree.
//
// WHERE THIS FILE DIFFERS FROM report-builder: there the "half-finished
// configuration" part comes from `fieldWarning(schema, binding, t)`. That
// function is exported by the `.` entry (the React one) and NOT by `/server` —
// and this example imports only from `/server`, on purpose. So the two rules
// it applies (a missing binding on a section/chart, and a filter condition
// with no value) are written down here, reusing the package dictionary's

export type TemplateProblem = {
  pageIndex: number;
  pageName: string;
  schemaId: string;
  schemaName: string;
  // "expressao" = it will render empty right now. "config" = half-finished
  // configuration (a missing binding, a filter with no value).
  kind: "expressao" | "suspeita" | "config";
  // Where in the schema: "content", "visibleWhen", "footer[1]", "columns[2].formula".
  where?: string;
  message: string;
};

// `page.name` is DATA (the name the template's author gave the page) and
// comes out as it arrived; the "Page N"/"Página N" fallback is a shell label,
// and it is the SAME one as `PageTabs` — a single dictionary entry serves
// both, otherwise the tab and the problems panel would name the same page two
function pageLabel(page: TemplatePage, index: number, locale: Locale): string {
  return page.name?.trim() || shellDict(locale).pages.tab(index + 1);
}

// Bound to an array (chart/table/kpi) but some filter condition has a chosen
// column and a blank value — a half-built filter, which would filter
// everything out without the user noticing. (A copy of the package's
// `filterIncomplete` rule, which only the React entry exports.)
function filterIncomplete(binding: Binding | undefined): boolean {
  if (!binding || (binding.type !== "chart" && binding.type !== "array" && binding.type !== "kpi")) return false;
  return (binding.filters ?? []).some((group) => group.some((cond) => cond.column && !cond.value.trim()));
}

function problemsOfSchema(
  schema: Schema,
  bindings: Binding[],
  page: TemplatePage,
  pageIndex: number,
  locale: Locale
): TemplateProblem[] {
  const t = dictFor(locale);
  const binding = bindings.find((b) => b.schemaName === schema.name);
  const base = {
    pageIndex,
    pageName: pageLabel(page, pageIndex, locale),
    schemaId: schema.id,
    schemaName: schema.name,
  };

  // A syntax error comes first: it is already producing wrong output (an
  // empty field), while "missing binding" is incomplete configuration.
  // `severity` separates the two: "error" does not compile and the field
  // certainly comes out empty; "warning" compiles but is almost certainly a
  // mistake — an operator with whitespace on one side only (`{fatura /}`)
  // became a key name. The warning exists because that case is no syntax error.
  const syntax = expressionErrors(schema, binding, t).map((e) => ({
    ...base,
    kind: (e.severity === "error" ? "expressao" : "suspeita") as "expressao" | "suspeita",
    where: e.field,
    message: e.message,
  }));
  if (syntax.length > 0) return syntax;

  // It only gets here when there was no expression error at all — what is
  // left is configuration. A section/chart with no binding draws nothing;
  // text/table with no binding are deliberately left out (static content is
  // legitimate use).
  if ((schema.type === "section" || schema.type === "chart") && !binding) {
    return [{ ...base, kind: "config" as const, message: t.warnings.missingBinding }];
  }
  if (filterIncomplete(binding)) {
    return [{ ...base, kind: "config" as const, message: t.warnings.incompleteFilter }];
  }
  return [];
}

export function templateProblems(template: Template, bindings: Binding[], locale: Locale): TemplateProblem[] {
  const pages = template.pages && template.pages.length > 0 ? template.pages : [];
  return pages.flatMap((page, pageIndex) =>
    page.schemas.flatMap((schema) => problemsOfSchema(schema, bindings, page, pageIndex, locale))
  );
}
