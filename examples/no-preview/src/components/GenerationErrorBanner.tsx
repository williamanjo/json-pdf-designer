import { useState } from "react";
import type { Locale } from "json-pdf-designer";
import { t } from "../i18n";
import type { GenerationProblem } from "../lib/generationError";

type Props = {
  problem: GenerationProblem;
  onDismiss: () => void;
  // The SAME `locale` as the <Designer> (see App.tsx).
  locale: Locale;
};

// The KEY (`data`, `template`, `config`, `package`) is THE PACKAGE's
// `PdfErrorBlame` — an identifier, not text, and therefore in English even
// with the UI in Portuguese. Only the word that appears on screen comes from
// the shell's dictionary.
function blameLabel(blame: GenerationProblem["blame"], s: ReturnType<typeof t>): string {
  if (blame === "data") return s.banner.blameData;
  if (blame === "template") return s.banner.blameTemplate;
  if (blame === "config") return s.banner.blameConfig;
  return s.banner.blamePackage;
}

// The generation failure banner. The point: the message comes from
// `describeGenerationError`, which decides the text by `instanceof` on the
// error class the package exports — not by a raw `err.message`. It is the same
// decision a backend makes when choosing between 413, 400 and 500.
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
