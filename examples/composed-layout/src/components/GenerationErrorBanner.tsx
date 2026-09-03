import { useState } from "react";
import { IconX } from "json-pdf-designer";
import type { Locale } from "json-pdf-designer";
import { t } from "../i18n";
import type { Ui } from "../i18n";
import type { GenerationProblem } from "../lib/generationError";

type Props = {
  problem: GenerationProblem;
  onDismiss: () => void;
  locale: Locale;
};

// A CULPA (`blame`) é o enum do PACOTE — quatro valores, os mesmos que um
// backend usaria pra escolher entre 4xx e 500. O pacote não localiza esse
// RÓTULO (ele é uma etiqueta de UI, e nem toda UI mostra), então a tradução é
// nossa. `switch` exaustivo: valor novo no enum do pacote para de compilar
// aqui, em vez de renderizar vazio.
function blameLabel(ui: Ui, blame: GenerationProblem["blame"]): string {
  switch (blame) {
    case "data":
      return ui.culpaDado;
    case "template":
      return ui.culpaTemplate;
    case "config":
      return ui.culpaConfiguracao;
    case "package":
      return ui.culpaPacote;
  }
}

// Banner de falha de geração, logo abaixo do header. O ponto: a mensagem vem
// de `describeGenerationError`, que delega a classificação a
// `describePdfError` do pacote (`code` + `blame` estruturados) em vez de olhar
// `err.message`. É a mesma decisão que um backend toma pra escolher entre 413,
// 400 e 500.
//
// Substituiu o `.app-error` de uma linha que este example tinha antes (que
// mostrava `err.message` direto).
export default function GenerationErrorBanner({ problem, onDismiss, locale }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const isBug = problem.blame === "package";
  const ui = t(locale);

  return (
    <div className={`app-banner${isBug ? " app-banner--bug" : ""}`} role="alert">
      <div className="app-banner__body">
        <span className="app-banner__title">
          {problem.title}
          <span className="app-banner__blame">({blameLabel(ui, problem.blame)})</span>
          {problem.field && (
            // `problem.field` é o NOME do campo no template — dado, sai cru.
            <span className="app-banner__blame">
              {ui.bannerCampo} <code>{problem.field}</code>
            </span>
          )}
        </span>
        {/* `action` é opcional: o pacote omite quando não há o que fazer
            (bug dele — a "ação" é reportar, e o título já pede isso). Sem o
            gate, o banner ficaria com uma linha vazia embaixo do título. */}
        {problem.action && <span>{problem.action}</span>}
        {showDetail && <code className="app-banner__detail">{problem.detail}</code>}
      </div>
      <div className="app-banner__actions">
        <button type="button" className="app-btn app-btn--ghost" onClick={() => setShowDetail((v) => !v)}>
          {showDetail ? ui.esconderDetalhe : ui.verDetalhe}
        </button>
        <button type="button" className="app-icon-btn" onClick={onDismiss} aria-label={ui.fecharAviso}>
          <IconX />
        </button>
      </div>
    </div>
  );
}
