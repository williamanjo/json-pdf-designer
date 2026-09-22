import { IconAlertTriangle } from "json-pdf-designer";
import type { Locale } from "json-pdf-designer";
import { t } from "../i18n";
import type { TemplateProblem } from "../lib/templateProblems";

type Props = {
  problems: TemplateProblem[];
  // Clicking a problem takes you to the field's PAGE — the panel only points
  // at it if it can get there.
  onGoTo: (pageIndex: number, schemaId: string) => void;
  locale: Locale;
};

// "Template problems" — the other side of generation's tolerance.
//
// The package resolves an invalid expression to empty instead of bringing the
// PDF down (a forgotten comma must not cost a 200-page report). The price is
// that the field comes out blank with no explanation. This panel is where the
// explanation appears, before generating — built with `expressionErrors` and
// `fieldWarning`, public exports of the package.
//
// It sits at the END of the right-hand stack, after the Inspector: it is the
// only card that speaks about the WHOLE template (every page), while the five
// above speak about the selected field or the current page.
export default function ProblemsPanel({ problems, onGoTo, locale }: Props) {
  const willRenderEmpty = problems.filter((p) => p.kind === "expressao").length;
  const suspect = problems.filter((p) => p.kind === "suspeita").length;
  const ui = t(locale);

  return (
    <section className="app-card">
      <div className="app-card__head">
        <h2 className="app-h2">{ui.problemasTitulo}</h2>
        {problems.length > 0 && <span className="app-badge">{problems.length}</span>}
      </div>

      {problems.length === 0 ? (
        <p className="app-note">{ui.semProblemas}</p>
      ) : (
        <>
          {/* Singular/plural lives in the dictionary ENTRY, not in the JSX:
              the plural rule changes from language to language, and the whole
              sentence used to be assembled from three concatenated pieces here. */}
          {suspect > 0 && <p className="app-alert">{ui.suspeitas(suspect)}</p>}
          {willRenderEmpty > 0 && <p className="app-alert">{ui.vaoRenderizarVazio(willRenderEmpty)}</p>}
          <ul className="app-problem-list">
            {problems.map((p, i) => (
              <li key={`${p.schemaId}-${p.where ?? "geral"}-${i}`}>
                <button
                  type="button"
                  onClick={() => onGoTo(p.pageIndex, p.schemaId)}
                  className={`app-problem${p.kind === "config" ? " app-problem--config" : ""}`}
                >
                  <span className="app-problem__title">
                    <IconAlertTriangle />
                    {p.schemaName}
                    {p.where && <code>.{p.where}</code>}
                  </span>
                  <span className="app-problem__msg">{p.message}</span>
                  <span className="app-problem__page">{p.pageName}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
