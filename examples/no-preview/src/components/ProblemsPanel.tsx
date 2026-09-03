import type { Locale } from "json-pdf-designer";
import { t } from "../i18n";
import type { TemplateProblem } from "../lib/templateProblems";

type Props = {
  problems: TemplateProblem[];
  // Clique num problema leva pra página do campo — o painel só aponta se
  // der pra chegar lá.
  onGoTo: (pageIndex: number, schemaId: string) => void;
  // O MESMO `locale` do <Designer> (ver App.tsx).
  locale: Locale;
};

// "Problemas do template" — o outro lado da tolerância da geração.
//
// O pacote resolve expressão inválida pra vazio em vez de derrubar o PDF (uma
// vírgula esquecida não pode custar um relatório de 200 páginas). O preço é que
// o campo sai em branco sem explicação. Este painel é onde a explicação
// aparece, antes de gerar — montado com `expressionErrors` e `fieldWarning`,
// exports públicos do pacote (ver lib/templateProblems.ts).
export default function ProblemsPanel({ problems, onGoTo, locale }: Props) {
  const s = t(locale);
  const willRenderEmpty = problems.filter((p) => p.kind === "expressao").length;
  const suspect = problems.filter((p) => p.kind === "suspeita").length;

  return (
    <section className="app-panel">
      <div className="app-panel__head">
        <span className="app-panel__title">{s.problems.title}</span>
        {problems.length > 0 && (
          <span className={`app-badge ${willRenderEmpty + suspect > 0 ? "is-danger" : "is-warn"}`}>{problems.length}</span>
        )}
      </div>

      {problems.length === 0 ? (
        <p className="app-hint">{s.problems.none}</p>
      ) : (
        <>
          {/* Singular/plural inteiros na entrada do dicionário: em português o
              verbo da frase seguinte concorda com o número ("compila" /
              "compilam"), então quebrar a frase em pedaços de JSX obrigaria
              cada idioma a usar a MESMA divisão. */}
          {suspect > 0 && <p className="app-error-text">{s.problems.suspicious(suspect)}</p>}
          {willRenderEmpty > 0 && <p className="app-error-text">{s.problems.empty(willRenderEmpty)}</p>}
          <ul className="app-problem-list">
            {problems.map((p, i) => (
              <li key={`${p.schemaId}-${p.where ?? "geral"}-${i}`}>
                <button
                  type="button"
                  onClick={() => onGoTo(p.pageIndex, p.schemaId)}
                  className={`app-problem ${p.kind === "config" ? "is-warn" : "is-danger"}`}
                >
                  <span className="app-problem__name">
                    <span aria-hidden="true">⚠</span>
                    {p.schemaName}
                    {p.where && <code className="app-problem__where">.{p.where}</code>}
                  </span>
                  {/* `p.message` e `p.pageName` vêm de lib/templateProblems.ts:
                      a mensagem é do PACOTE (`expressionErrors`/`fieldWarning`
                      com `dictFor(locale)`) e o nome da página cai no
                      dicionário da casca só quando a página não tem nome
                      próprio — nome dado pela pessoa é dado. */}
                  <span className="app-problem__message">{p.message}</span>
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
