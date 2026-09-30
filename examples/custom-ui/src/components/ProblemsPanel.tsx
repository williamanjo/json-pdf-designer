import type { Locale } from "json-pdf-designer";
import type { TemplateProblem } from "../lib/templateProblems";
import { t } from "../i18n";

type Props = {
  problems: TemplateProblem[];
  locale: Locale;
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
//
// The markup is native HTML + classes from src/index.css: no Card/Badge/icon
// from the package, which is this example's premise.
export default function ProblemsPanel({ problems, locale, onGoTo }: Props) {
  const d = t(locale);
  const willRenderEmpty = problems.filter((p) => p.kind === "expressao").length;
  const suspect = problems.filter((p) => p.kind === "suspeita").length;

  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">{d.problemsTitle}</h2>
        {problems.length > 0 && (
          <span className={willRenderEmpty + suspect > 0 ? "count-badge is-alert" : "count-badge is-warn"}>
            {problems.length}
          </span>
        )}
      </div>

      {problems.length === 0 ? (
        <p className="hint">{d.problemsNone}</p>
      ) : (
        <>
          {/* The whole sentence comes from the dictionary's function. The
              previous version concatenated "1 expressão suspeita" + " —
              compila, mas..." in the JSX; that ties the order of the parts to
              Portuguese, and English has to inflect the verb along with the
              number ("it compiles" / "they compile"), which cannot be done by
              stitching pieces together. */}
          {suspect > 0 && <p className="problem-note">{d.suspectNote(suspect)}</p>}
          {willRenderEmpty > 0 && <p className="problem-note">{d.willRenderEmptyNote(willRenderEmpty)}</p>}
          <ul className="problem-list">
            {problems.map((p, i) => (
              <li key={`${p.schemaId}-${p.where ?? "geral"}-${i}`}>
                <button
                  type="button"
                  onClick={() => onGoTo(p.pageIndex, p.schemaId)}
                  className={p.kind === "config" ? "problem-btn is-config" : "problem-btn is-error"}
                >
                  <span className="problem-btn-head">
                    <span className="problem-icon" aria-hidden="true">
                      ⚠
                    </span>
                    {/* `schemaName` e `where` são DADO: nome do campo no
                        template e o caminho dentro dele ("columns[2].formula").
                        Não trocam de idioma. */}
                    {p.schemaName}
                    {p.where && <code className="problem-where">.{p.where}</code>}
                  </span>
                  {/* `message` já vem traduzida do dicionário DO PACOTE
                      (lib/templateProblems.ts usa `dictFor(locale)`) — erro de
                      expressão e aviso de vínculo são conceitos dele. */}
                  <span className="problem-msg">{p.message}</span>
                  <span className="problem-page">{p.pageName}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
