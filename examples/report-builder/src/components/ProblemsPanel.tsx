import { Badge, Card, CardHeader, CardTitle, IconAlertTriangle } from "json-pdf-designer";
import type { TemplateProblem } from "../lib/templateProblems";

type Props = {
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
export default function ProblemsPanel({ problems, onGoTo }: Props) {
  const willRenderEmpty = problems.filter((p) => p.kind === "expressao").length;
  const suspect = problems.filter((p) => p.kind === "suspeita").length;

  return (
    <Card className="flex flex-col gap-2 p-3">
      <CardHeader>
        <CardTitle>Problemas do template</CardTitle>
        {problems.length > 0 && (
          <Badge className={willRenderEmpty + suspect > 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>
            {problems.length}
          </Badge>
        )}
      </CardHeader>

      {problems.length === 0 ? (
        <p className="text-[11px] text-slate-500">
          Nenhum problema. Expressões válidas, vínculos completos.
        </p>
      ) : (
        <>
          {suspect > 0 && (
            <p className="text-[11px] text-red-700">
              {suspect === 1 ? "1 expressão suspeita" : `${suspect} expressões suspeitas`} — compila, mas
              provavelmente não faz o que parece. Veja abaixo.
            </p>
          )}
          {willRenderEmpty > 0 && (
            <p className="text-[11px] text-red-700">
              {willRenderEmpty === 1
                ? "1 campo vai renderizar VAZIO no PDF."
                : `${willRenderEmpty} campos vão renderizar VAZIOS no PDF.`}{" "}
              A geração não falha por isso — por isso este aviso existe.
            </p>
          )}
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
