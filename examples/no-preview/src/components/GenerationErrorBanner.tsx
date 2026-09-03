import { useState } from "react";
import type { Locale } from "json-pdf-designer";
import { t } from "../i18n";
import type { GenerationProblem } from "../lib/generationError";

type Props = {
  problem: GenerationProblem;
  onDismiss: () => void;
  // O MESMO `locale` do <Designer> (ver App.tsx).
  locale: Locale;
};

// A CHAVE (`data`, `template`, `config`, `package`) é o `PdfErrorBlame` do
// PACOTE — identificador, não texto, e por isso em inglês mesmo com a UI em
// português. Só a palavra que aparece na tela sai do dicionário.
// o rótulo que aparece na tela sai do dicionário da casca.
function blameLabel(blame: GenerationProblem["blame"], s: ReturnType<typeof t>): string {
  if (blame === "data") return s.banner.blameData;
  if (blame === "template") return s.banner.blameTemplate;
  if (blame === "config") return s.banner.blameConfig;
  return s.banner.blamePackage;
}

// Banner de falha de geração. O ponto: a mensagem vem de
// `describeGenerationError`, que decide o texto por `instanceof` na classe de
// erro exportada pelo pacote — não por `err.message` cru. É a mesma decisão que
// um backend toma pra escolher entre 413, 400 e 500.
export default function GenerationErrorBanner({ problem, onDismiss, locale }: Props) {
  const s = t(locale);
  const [showDetail, setShowDetail] = useState(false);
  const isBug = problem.blame === "package";

  return (
    <div className={`app-banner ${isBug ? "is-neutral" : "is-danger"}`}>
      <div className="app-banner__text">
        <span className="app-banner__title">
          {problem.title}
          <span className="app-banner__dim">({blameLabel(problem.blame, s)})</span>
          {problem.field && (
            <span className="app-banner__dim">
              {/* O nome do campo é dado (vem do template) — só a palavra que
                  o precede é interface. */}
              {s.banner.field} <code>{problem.field}</code>
            </span>
          )}
        </span>
        <span>{problem.action}</span>
        {/* `detail` é a mensagem crua que o pacote lançou: diagnóstico, não
            interface. Fica como veio, no idioma em que veio. */}
        {showDetail && <code className="app-banner__detail">{problem.detail}</code>}
      </div>
      <div className="app-banner__actions">
        <button type="button" className="app-btn app-btn--quiet" onClick={() => setShowDetail((v) => !v)}>
          {showDetail ? s.banner.hideDetail : s.banner.showDetail}
        </button>
        <button type="button" className="app-icon-btn" onClick={onDismiss} aria-label={s.banner.dismiss}>
          ×
        </button>
      </div>
    </div>
  );
}
