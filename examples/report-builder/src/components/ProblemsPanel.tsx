import { Badge, Card, CardHeader, CardTitle, IconAlertTriangle } from "json-pdf-designer";
import type { Locale } from "json-pdf-designer";
import type { TemplateProblem } from "../lib/templateProblems";
import { t } from "../i18n";

type Props = {
  locale: Locale;
  problems: TemplateProblem[];
  // Clicking a problem takes you to the page and selects the field — the
  // panel only points at it if it can get there.
  onGoTo: (pageIndex: number, schemaId: string) => void;
};

// "Template problems" — the other side of generation's tolerance.
//
// The package resolves an invalid expression to empty instead of bringing the
// PDF down (a forgotten comma must not cost a 200-page report). The price is
// that the field comes out blank with no explanation. This panel is where the
// explanation appears, before generating — built with `expressionErrors` and
// `fieldWarning`, public exports of the package.
export default function ProblemsPanel({ locale, problems, onGoTo }: Props) {
  const tx = t(locale);
  const willRenderEmpty = problems.filter((p) => p.kind === "expressao").length;
  const suspect = problems.filter((p) => p.kind === "suspeita").length;

  return (
    <Card className="flex flex-col gap-2 p-3">
      <CardHeader>
        <CardTitle>{tx.problemsTitle}</CardTitle>
        {problems.length > 0 && (
          <Badge className={willRenderEmpty + suspect > 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>
            {problems.length}
          </Badge>
        )}
      </CardHeader>

      {problems.length === 0 ? (
        <p className="text-[11px] text-slate-500">{tx.problemsNone}</p>
      ) : (
        <>
          {/* The WHOLE sentence (plural included) comes from the dictionary,
              not assembled in the JSX: in English the number does not sit in
              the same place in the clause. */}
          {suspect > 0 && <p className="text-[11px] text-red-700">{tx.problemsSuspect(suspect)}</p>}
          {willRenderEmpty > 0 && <p className="text-[11px] text-red-700">{tx.problemsEmpty(willRenderEmpty)}</p>}
          <ul className="flex flex-col gap-1">
            {problems.map((p, i) => (
              <li key={`${p.schemaId}-${p.where ?? "geral"}-${i}`}>
                <button
                  type="button"
                  onClick={() => onGoTo(p.pageIndex, p.schemaId)}
                  className={`w-full rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors ${
                    p.kind === "config"
                      ? "border-amber-200 bg-amber-50 hover:bg-amber-100"
                      : "border-red-200 bg-red-50 hover:bg-red-100"
                  }`}
                >
                  <span className="flex items-center gap-1 font-semibold text-slate-800">
                    <IconAlertTriangle />
                    {p.schemaName}
                    {p.where && <code className="font-normal text-slate-500">.{p.where}</code>}
                  </span>
                  {/* `p.message` JÁ vem traduzido — sai de `expressionErrors`/
                      `fieldWarning` com `dictFor(locale)` (ver
                      lib/templateProblems.ts). O conceito é do pacote, então o
                      texto é do pacote: nada duplicado aqui.
                      `p.schemaName` acima é nome de campo, dado — não traduz. */}
                  <span className="mt-0.5 block text-slate-600">{p.message}</span>
                  <span className="mt-0.5 block text-[10px] text-slate-400">{p.pageName}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
