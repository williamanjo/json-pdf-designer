import { useState } from "react";
import { Button, IconX } from "json-pdf-designer";
import type { Locale } from "json-pdf-designer";
import type { GenerationProblem } from "../lib/generationError";
import { t, type AppDict } from "../i18n";

type Props = {
  locale: Locale;
  problem: GenerationProblem;
  onDismiss: () => void;
};

// A CHAVE (`data`, `template`...) é o `blame` que o PACOTE devolve — é
// discriminante, não texto de tela, então não muda com o idioma. Só o rótulo
// muda. `Record` completo (e não `labels[blame] ?? ""`): se o pacote ganhar um
// blame novo, isto para de compilar até alguém escrever o rótulo.
function blameLabel(blame: GenerationProblem["blame"], tx: AppDict): string {
  const labels: Record<GenerationProblem["blame"], string> = {
    data: tx.blameData,
    template: tx.blameTemplate,
    config: tx.blameConfig,
    package: tx.blamePackage,
  };
  return labels[blame];
}

// Banner de falha de geração. O ponto: a mensagem vem de `describeGenerationError`,
// que classifica pelo `code`/`blame` que o pacote devolve em `describePdfError` —
// não por `err.message` cru, nem por regex na frase. É a mesma decisão que um
// backend toma pra escolher entre 413, 400 e 500.
export default function GenerationErrorBanner({ locale, problem, onDismiss }: Props) {
  const tx = t(locale);
  const [showDetail, setShowDetail] = useState(false);
  const isBug = problem.blame === "package";

  return (
    <div className={`px-5 py-2.5 text-xs ${isBug ? "bg-slate-100 text-slate-800" : "bg-red-50 text-red-800"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-semibold">
            {problem.title}
            <span className="ml-2 font-normal opacity-70">({blameLabel(problem.blame, tx)})</span>
            {problem.field && (
              <span className="ml-2 font-normal opacity-70">
                {/* O NOME do campo é dado — só o rótulo em volta traduz. */}
                {tx.bannerFieldLabel} <code>{problem.field}</code>
              </span>
            )}
          </span>
          {/* `action` é opcional: bug do pacote não tem "o que fazer" além de
              reportar, e isso o título já diz. Sem o guard, renderizaria uma
              linha vazia. */}
          {problem.action && <span className="opacity-90">{problem.action}</span>}
          {/* `problem.detail` é a mensagem CRUA do erro (a camada técnica) —
              não passa por dicionário nenhum, nem o nosso nem o do pacote. */}
          {showDetail && (
            <code className="mt-1 block whitespace-pre-wrap break-words rounded bg-white/60 p-1.5 text-[10px] opacity-80">
              {problem.detail}
            </code>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <Button variant="ghost" onClick={() => setShowDetail((v) => !v)}>
            {showDetail ? tx.bannerHideDetail : tx.bannerShowDetail}
          </Button>
          <Button variant="ghost" size="icon" onClick={onDismiss}>
            <IconX />
          </Button>
        </div>
      </div>
    </div>
  );
}
