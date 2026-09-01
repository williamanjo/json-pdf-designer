import { useState } from "react";
import { Button, IconX } from "json-pdf-designer";
import type { GenerationProblem } from "../lib/generationError";

type Props = {
  problem: GenerationProblem;
  onDismiss: () => void;
};

const BLAME_LABEL: Record<GenerationProblem["blame"], string> = {
  dado: "problema no dado",
  template: "problema no template",
  configuracao: "problema de configuração",
  pacote: "erro inesperado",
};

// Banner de falha de geração. O ponto: a mensagem vem de `describeGenerationError`,
// que decide o texto por `instanceof` na classe de erro exportada pelo pacote —
// não por `err.message` cru. É a mesma decisão que um backend toma pra escolher
// entre 413, 400 e 500.
export default function GenerationErrorBanner({ problem, onDismiss }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const isBug = problem.blame === "pacote";

  return (
    <div className={`px-5 py-2.5 text-xs ${isBug ? "bg-slate-100 text-slate-800" : "bg-red-50 text-red-800"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-semibold">
            {problem.title}
            <span className="ml-2 font-normal opacity-70">({BLAME_LABEL[problem.blame]})</span>
            {problem.field && (
              <span className="ml-2 font-normal opacity-70">
                campo <code>{problem.field}</code>
              </span>
            )}
          </span>
          <span className="opacity-90">{problem.action}</span>
          {showDetail && (
            <code className="mt-1 block whitespace-pre-wrap break-words rounded bg-white/60 p-1.5 text-[10px] opacity-80">
              {problem.detail}
            </code>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          <Button variant="ghost" onClick={() => setShowDetail((v) => !v)}>
            {showDetail ? "esconder detalhe" : "ver detalhe"}
          </Button>
          <Button variant="ghost" size="icon" onClick={onDismiss}>
            <IconX />
          </Button>
        </div>
      </div>
    </div>
  );
}
