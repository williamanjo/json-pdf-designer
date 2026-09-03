import { useState } from "react";
import type { Locale } from "json-pdf-designer";
import type { GenerationProblem } from "../lib/generationError";
import { t, type ShellDict } from "../i18n";

type Props = {
  problem: GenerationProblem;
  locale: Locale;
  onDismiss: () => void;
};

// `blame` é o `PdfErrorBlame` do PACOTE — identificador, não texto, e por isso
// em inglês mesmo com a UI em português. Aqui ele vira rótulo. O `Record`
// mapeado é de propósito: uma culpa nova no tipo não compila até ganhar
// entrada aqui — e a entrada só pode ser uma chave do dicionário, que por sua
// vez existe nos dois idiomas.
const BLAME_LABEL: Record<GenerationProblem["blame"], (d: ShellDict) => string> = {
  data: (d) => d.blameData,
  template: (d) => d.blameTemplate,
  config: (d) => d.blameConfig,
  package: (d) => d.blamePackage,
};

// Banner de falha de geração. O ponto: a mensagem vem de `describeGenerationError`,
// que delega a classificação pro `describePdfError` do pacote — não casa
// `err.message` cru. É a mesma decisão que um backend toma pra escolher entre
// 413, 400 e 500, e é o `blame` que a informa.
//
// "Culpa do pacote" muda a cor: vermelho é "você pode consertar", cinza é
// "reporte". Os dois tons e os dois botões são classes de src/index.css —
// nenhum Button/IconX do pacote.
export default function GenerationErrorBanner({ problem, locale, onDismiss }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const isBug = problem.blame === "package";
  const d = t(locale);

  return (
    <div className={isBug ? "gen-error is-bug" : "gen-error"}>
      <div className="gen-error-main">
        <span className="gen-error-title">
          {problem.title}
          <span className="gen-error-tag">({BLAME_LABEL[problem.blame](d)})</span>
          {problem.field && (
            <span className="gen-error-tag">
              {/* `problem.field` é o NOME do campo no template — dado. Só a
                  palavra que o rotula é traduzida. */}
              {d.errorFieldTag} <code>{problem.field}</code>
            </span>
          )}
        </span>
        <span className="gen-error-action">{problem.action}</span>
        {/* `detail` é a mensagem CRUA do erro, como o pacote a lançou — fica
            como está de propósito: é o que se copia num relato de bug. */}
        {showDetail && <code className="gen-error-detail">{problem.detail}</code>}
      </div>
      <div className="gen-error-actions">
        <button type="button" className="btn btn-banner" onClick={() => setShowDetail((v) => !v)}>
          {showDetail ? d.hideDetail : d.showDetail}
        </button>
        <button type="button" className="btn-icon btn-icon-banner" onClick={onDismiss} aria-label={d.dismissErrorAria}>
          ×
        </button>
      </div>
    </div>
  );
}
