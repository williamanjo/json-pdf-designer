import { Badge, Card, CardHeader, CardTitle, IconAlertTriangle } from "json-pdf-designer";
import type { Locale } from "json-pdf-designer";
import type { TemplateProblem } from "../lib/templateProblems";
import { t } from "../i18n";

type Props = {
  locale: Locale;
  problems: TemplateProblem[];
  // Clique num problema leva pra página e seleciona o campo — o painel só
  // aponta se der pra chegar lá.
  onGoTo: (pageIndex: number, schemaId: string) => void;
};

// "Problemas do template" — o outro lado da tolerância da geração.
//
// O pacote resolve expressão inválida pra vazio em vez de derrubar o PDF (uma
// vírgula esquecida não pode custar um relatório de 200 páginas). O preço é que
// o campo sai em branco sem explicação. Este painel é onde a explicação
// aparece, antes de gerar — montado com `expressionErrors` e `fieldWarning`,
// exports públicos do pacote.
export default function ProblemsPanel({ locale, problems, onGoTo }: Props) {
  const tx = t(locale);
  const willRenderEmpty = problems.filter((p) => p.kind === "expressao").length;
  const suspect = problems.filter((p) => p.kind === "suspeita").length;

  return (
    <Card className="flex flex-col gap-2 p-3">
      <CardHeader>
        <CardTitle>{tx.problemsTitle}</CardTitle>
        {problems.length > 0 && (
          <Badge className={willRenderEmpty + suspect > 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>
            {problems.length}
          </Badge>
        )}
      </CardHeader>

      {problems.length === 0 ? (
        <p className="text-[11px] text-slate-500">{tx.problemsNone}</p>
      ) : (
        <>
          {/* Frase INTEIRA (plural incluído) vem do dicionário, não montada
              no JSX: em inglês o número não fica no mesmo lugar da oração. */}
          {suspect > 0 && <p className="text-[11px] text-red-700">{tx.problemsSuspect(suspect)}</p>}
          {willRenderEmpty > 0 && <p className="text-[11px] text-red-700">{tx.problemsEmpty(willRenderEmpty)}</p>}
          <ul className="flex flex-col gap-1">
            {problems.map((p, i) => (
              <li key={`${p.schemaId}-${p.where ?? "geral"}-${i}`}>
                <button
                  type="button"
                  onClick={() => onGoTo(p.pageIndex, p.schemaId)}
                  className={`w-full rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors ${
                    p.kind === "config"
                      ? "border-amber-200 bg-amber-50 hover:bg-amber-100"
                      : "border-red-200 bg-red-50 hover:bg-red-100"
                  }`}
                >
                  <span className="flex items-center gap-1 font-semibold text-slate-800">
                    <IconAlertTriangle />
                    {p.schemaName}
                    {p.where && <code className="font-normal text-slate-500">.{p.where}</code>}
                  </span>
                  {/* `p.message` JÁ vem traduzido — sai de `expressionErrors`/
                      `fieldWarning` com `dictFor(locale)` (ver
                      lib/templateProblems.ts). O conceito é do pacote, então o
                      texto é do pacote: nada duplicado aqui.
                      `p.schemaName` acima é nome de campo, dado — não traduz. */}
                  <span className="mt-0.5 block text-slate-600">{p.message}</span>
                  <span className="mt-0.5 block text-[10px] text-slate-400">{p.pageName}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
