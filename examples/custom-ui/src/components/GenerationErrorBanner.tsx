import { useState } from "react";
import type { Locale } from "json-pdf-designer";
import type { GenerationProblem } from "../lib/generationError";
import { t, type ShellDict } from "../i18n";

type Props = {
  problem: GenerationProblem;
  locale: Locale;
  onDismiss: () => void;
};

// `blame` is the PACKAGE's `PdfErrorBlame` — an identifier, not text, and
// therefore in English even with the UI in Portuguese. Here it becomes a
// label. The mapped `Record` is deliberate: a new blame in the type does not
// compile until it gains an entry here — and the entry can only be a key of
// the dictionary, which in turn exists in both languages.
const BLAME_LABEL: Record<GenerationProblem["blame"], (d: ShellDict) => string> = {
  data: (d) => d.blameData,
  template: (d) => d.blameTemplate,
  config: (d) => d.blameConfig,
  package: (d) => d.blamePackage,
};

// The generation failure banner. The point: the message comes from
// `describeGenerationError`, which delegates the classification to the
// package's `describePdfError` — it does not match a raw `err.message`. It is
// the same decision a backend makes when choosing between 413, 400 and 500,
// and it is `blame` that informs it.
//
// "The package's fault" changes the color: red is "you can fix this", gray is
// "report it". Both tones and both buttons are classes from src/index.css — no
// Button/IconX from the package.
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
              {/* `problem.field` is the field's NAME in the template — data. Only
                  the word labeling it is translated. */}
              {d.errorFieldTag} <code>{problem.field}</code>
            </span>
          )}
        </span>
        <span className="gen-error-action">{problem.action}</span>
        {/* `detail` is the error's RAW message, as the package threw it — it
            stays as it is on purpose: it is what gets copied into a bug report. */}
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
