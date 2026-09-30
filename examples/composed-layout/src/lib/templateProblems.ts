import { dictFor, expressionErrors, fieldWarning } from "json-pdf-designer";
import type { Binding, Locale, Schema, Template, TemplatePage } from "json-pdf-designer";
import { t } from "../i18n";

// Everything that is crooked in the template BEFORE generating.
//
// It exists because generation is deliberately tolerant: an invalid expression
// resolves to empty instead of bringing the PDF down. Great for not losing a
// 200-page report over one comma — but without this the problem is invisible
// (the field shows up blank and nobody knows why). This is the other side of
// the bargain.
//
// Everything here comes from a public export of the package: `expressionErrors`
// (every expression a field carries, including the `visibleWhen` and the
// column formulas) and `fieldWarning` (the same message the alert icon in the
// <Designer>'s field list shows).

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

// `page.name` is DATA (the name the person gave the page) and comes out as
// it is in both languages; only the POSITIONAL fallback label is UI, and it
// comes from our dictionary — the same one the page tabs use, so there is no
// "Página 2" in one place and "Page 2" in the other.
function pageLabel(page: TemplatePage, index: number, locale: Locale): string {
  return page.name?.trim() || t(locale).pagina(index + 1);
}

function problemsOfSchema(
  schema: Schema,
  bindings: Binding[],
  page: TemplatePage,
  pageIndex: number,
  locale: Locale
): TemplateProblem[] {
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
  // became a key name. The warning exists because that case is no syntax error
  // at all and used to pass silently.
  // `dictFor(locale)` here too: the parser's message comes from the dictionary.
  const syntax = expressionErrors(schema, binding, dictFor(locale)).map((e) => ({
    ...base,
    kind: (e.severity === "error" ? "expressao" : "suspeita") as "expressao" | "suspeita",
    where: e.field,
    message: e.message,
  }));
  if (syntax.length > 0) return syntax;

  // `fieldWarning` also covers an expression error (it is the first thing it
  // checks), so it only gets here when there was none — what is left is
  // configuration.
  // `dictFor` gives the dictionary as a VALUE — `useT()` only exists inside a
  // component, and this runs outside the React tree.
  const warning = fieldWarning(schema, binding, dictFor(locale));
  return warning ? [{ ...base, kind: "config" as const, message: warning }] : [];
}

export function templateProblems(template: Template, bindings: Binding[], locale: Locale): TemplateProblem[] {
  const pages = template.pages && template.pages.length > 0 ? template.pages : [];
  return pages.flatMap((page, pageIndex) =>
    page.schemas.flatMap((schema) => problemsOfSchema(schema, bindings, page, pageIndex, locale))
  );
}
