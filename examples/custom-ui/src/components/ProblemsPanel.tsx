import type { Locale } from "json-pdf-designer";
import type { TemplateProblem } from "../lib/templateProblems";
import { t } from "../i18n";

type Props = {
  problems: TemplateProblem[];
  locale: Locale;
  // Clique num problema leva pra página e seleciona o campo — o painel só
  // aponta se der pra chegar lá.
  onGoTo: (pageIndex: number, schemaId: string) => void;
};

// "Problemas do template" — o outro lado da tolerância da geração.
//
// O pacote resolve expressão inválida pra vazio em vez de derrubar o PDF (uma
// vírgula esquecida não pode custar um relatório de 200 páginas). O preço é que
// o campo sai em branco sem explicação. Este painel é onde a explicação
// aparece, antes de gerar — montado com `expressionErrors` e `fieldWarning`,
// exports públicos do pacote.
//
// Marcação em HTML nativo + classes de src/index.css: nenhum Card/Badge/ícone
// do pacote, que é a premissa deste example.
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
          {/* A frase inteira sai da função do dicionário. A versão anterior
              concatenava "1 expressão suspeita" + " — compila, mas..." no
              JSX; isso amarra a ordem das partes ao português e o inglês tem
              de flexionar o verbo junto com o número ("it compiles" /
              "they compile"), o que não dá pra fazer costurando pedaços. */}
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
