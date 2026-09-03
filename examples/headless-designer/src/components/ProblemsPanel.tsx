import type { TemplateProblem } from "../lib/templateProblems";
import type { ShellDict } from "../i18n";

type Props = {
  problems: TemplateProblem[];
  // Dicionário da CASCA — só o CHROME deste painel (título, estado vazio, os
  // dois resumos de contagem). A MENSAGEM de cada problema já vem traduzida
  // pelo dicionário do PACOTE, montada em lib/templateProblems.ts com
  // `expressionErrors(..., dictFor(locale))` e `t.warnings.*`: expressão
  // inválida e vínculo faltando são conceitos do pacote, não deste app.
  tt: ShellDict;
  // Clique num problema leva pra página E seleciona o campo. No
  // report-builder o clique só chega até a página, porque lá o <Designer> é
  // dono da seleção e não há prop pra dirigi-la de fora. Aqui a seleção é
  // estado do App, então dá pra ir até o campo.
  onGoTo: (pageIndex: number, schemaId: string) => void;
};

// "Template problems" — o outro lado da tolerância da geração.
//
// O pacote resolve expressão inválida pra vazio em vez de derrubar o PDF (uma
// vírgula esquecida não pode custar um relatório de 200 páginas). O preço é que
// o campo sai em branco sem explicação. Este painel é onde a explicação
// aparece, antes de gerar — montado com `expressionErrors` + `dictFor`, dois
// exports do entry `/server` (ver lib/templateProblems.ts).
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
          {/* Frase INTEIRA vinda do dicionário, não "número + resto" colado
              no JSX: no plural o português muda o meio da frase ("ela
              compila" → "elas compilam"), não só o numeral na frente. */}
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
