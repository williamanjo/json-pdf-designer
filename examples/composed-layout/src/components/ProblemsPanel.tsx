import { IconAlertTriangle } from "json-pdf-designer";
import type { Locale } from "json-pdf-designer";
import { t } from "../i18n";
import type { TemplateProblem } from "../lib/templateProblems";

type Props = {
  problems: TemplateProblem[];
  // Clique num problema leva pra PÁGINA do campo — o painel só aponta se
  // der pra chegar lá.
  onGoTo: (pageIndex: number, schemaId: string) => void;
  locale: Locale;
};

// "Problemas do template" — o outro lado da tolerância da geração.
//
// O pacote resolve expressão inválida pra vazio em vez de derrubar o PDF (uma
// vírgula esquecida não pode custar um relatório de 200 páginas). O preço é que
// o campo sai em branco sem explicação. Este painel é onde a explicação
// aparece, antes de gerar — montado com `expressionErrors` e `fieldWarning`,
// exports públicos do pacote.
//
// Ele fica no FIM da pilha da direita, depois do Inspetor: é o único cartão
// que fala do template INTEIRO (todas as páginas), enquanto os cinco de cima
// falam do campo selecionado ou da página atual.
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
          {/* Singular/plural mora na ENTRADA do dicionário, não no JSX: a
              regra de plural muda de idioma pra idioma, e a frase inteira
              vinha montada em três pedaços concatenados aqui. */}
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
