import { useState } from "react";
import type { GenerationProblem } from "../lib/generationError";
import type { ShellDict } from "../i18n";

type Props = {
  problem: GenerationProblem;
  // The SHELL's dictionary, and it now carries LESS than it used to: the
  // labels around it ("a problem in the data", "see detail") are still ours,
  // but each failure's title and action come inside the `problem` — resolved
  // by the package for its errors, by the shell's `failures.*` for ours.
  tt: ShellDict;
  onDismiss: () => void;
};

// The generation failure banner.
//
// What this component no longer does, and it is the change that matters: it
// does not choose text. It used to have a `switch` over nine codes with two
// special cases (the page ceiling and the character outside the font carried a
// `titleArg` to interpolate), and each code needed an entry in `genErrors` in
// both languages — nine titles and nine actions maintained here, duplicating
// what the package already knew how to say.
//
// In 3.0.0 `describePdfError` returns `{ code, blame, title, action?, field?,
// detail }` with the title and action ALREADY LOCALIZED, so the interpolation
// (and the `titleArg` that existed only for it) lives on the side that has the
// number. What is left here is rendering.
//
// The translation still happens at RENDER time, not in the `catch`: the App's
// state holds the RAW error and calls `describeGenerationError(err, locale)`
// while rendering, so switching the language with the banner open retranslates
// the banner without generating the PDF again.
export default function GenerationErrorBanner({ problem, tt, onDismiss }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  // `blame: "package"` is the only blame that paints the banner another
  // color: it is the one that says "it is not your template, it is our bug".
  const isBug = problem.blame === "package";

  return (
    <div className={`gen-banner${isBug ? " gen-banner--bug" : ""}`}>
      <div className="gen-banner-body">
        <span className="gen-banner-title">
          {problem.title}
          {/* O enum de culpa é do pacote (data/template/config/package); o
              RÓTULO dele é etiqueta de UI, então a tradução é nossa. Índice
              direto em vez de `switch`: valor novo no enum do pacote para de
              compilar aqui, porque o objeto não teria a chave. */}
          <span className="gen-banner-blame">({tt.banner.blame[problem.blame]})</span>
          {problem.field && (
            <span className="gen-banner-blame">
              {/* O NOME do campo é dado do template — não se traduz. */}
              {tt.banner.fieldLabel} <code>{problem.field}</code>
            </span>
          )}
        </span>
        {/* `action` é opcional no contrato do pacote: há erro pra qual não
            existe nada útil pra pedir. */}
        {problem.action && <span>{problem.action}</span>}
        {/* `detail` é a mensagem CRUA, em inglês, de propósito: é o texto que
            a pessoa cola num issue. Fica escondido atrás do toggle porque não
            é pra ela ter que ler. */}
        {showDetail && <code className="gen-banner-detail">{problem.detail}</code>}
      </div>
      <div className="gen-banner-actions">
        <button type="button" onClick={() => setShowDetail((v) => !v)}>
          {showDetail ? tt.banner.hideDetail : tt.banner.showDetail}
        </button>
        <button type="button" className="remove-btn" aria-label={tt.banner.dismiss} onClick={onDismiss}>
          ×
        </button>
      </div>
    </div>
  );
}
