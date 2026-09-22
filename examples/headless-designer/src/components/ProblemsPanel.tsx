import type { TemplateProblem } from "../lib/templateProblems";
import type { ShellDict } from "../i18n";

type Props = {
  problems: TemplateProblem[];
  // The SHELL's dictionary — only this panel's CHROME (the title, the empty
  // state, the two count summaries). Each problem's MESSAGE already arrives
  // translated by the PACKAGE's dictionary, built in lib/templateProblems.ts
  // with `expressionErrors(..., dictFor(locale))` and `t.warnings.*`: an
  // invalid expression and a missing binding are the package's concepts.
  tt: ShellDict;
  // Clicking a problem takes you to the page AND selects the field. In
  // report-builder the click only gets as far as the page, because there the
  // <Designer> owns the selection and there is no prop to drive it from
  // outside. Here the selection is the App's state, so it can go to the field.
  onGoTo: (pageIndex: number, schemaId: string) => void;
};

// "Template problems" — the other side of generation's tolerance.
//
// The package resolves an invalid expression to empty instead of bringing the
// PDF down (a forgotten comma must not cost a 200-page report). The price is
// that the field comes out blank with no explanation. This panel is where the
// explanation appears, before generating — built with `expressionErrors` +
// `dictFor`, two exports of the `/server` entry (see lib/templateProblems.ts).
export default function ProblemsPanel({ problems, tt, onGoTo }: Props) {
  const willRenderEmpty = problems.filter((p) => p.kind === "expressao").length;
  const suspect = problems.filter((p) => p.kind === "suspeita").length;

  return (
    <div className="panel">
      <div className="panel-title">
        {tt.problems.title}
        {problems.length > 0 && <span className="badge">{problems.length}</span>}
      </div>

      {problems.length === 0 ? (
        <p className="panel-hint">{tt.problems.none}</p>
      ) : (
        <>
          {/* The WHOLE sentence comes from the dictionary, not "a number +
              the rest" glued in the JSX: in the plural Portuguese changes the
              middle of the sentence ("ela compila" → "elas compilam"), not
              only the numeral in front. */}
          {suspect > 0 && <p className="error-text">{tt.problems.suspicious(suspect)}</p>}
          {willRenderEmpty > 0 && <p className="error-text">{tt.problems.willRenderEmpty(willRenderEmpty)}</p>}
          <ul className="problem-list">
            {problems.map((p, i) => (
              <li key={`${p.schemaId}-${p.where ?? "geral"}-${i}`}>
                <button
                  type="button"
                  className={`problem-item problem-item--${p.kind === "config" ? "config" : "error"}`}
                  onClick={() => onGoTo(p.pageIndex, p.schemaId)}
                >
                  <span className="problem-item-name">
                    ⚠ {p.schemaName}
                    {p.where && <code>.{p.where}</code>}
                  </span>
                  <span className="problem-item-message">{p.message}</span>
                  <span className="problem-item-page">{p.pageName}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
