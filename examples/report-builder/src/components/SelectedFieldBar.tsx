import {
  useDesignerActions,
  useDesignerBulkEdit,
  useDesignerSelectedSchema,
  useDesignerSelection,
  useLocale,
  useT,
} from "json-pdf-designer";
import { t } from "../i18n";

// Barra de contexto do campo selecionado, desenhada pela CASCA DO APP (não
// pelo editor) e com Tailwind próprio deste projeto.
//
// Antes da 3.0.0 isto era IMPOSSÍVEL: o `<Designer>` era dono da seleção e não
// havia como ler de fora — o comentário em App.tsx dizia exatamente isso ("o
// <Designer> é dono da seleção, não há prop pra dirigi-la de fora"). Agora o
// estado mora no `<DesignerProvider>`, então qualquer parte do app que esteja
// dentro dele pode ler por hook.
//
// É a demonstração mais curta possível dos hooks públicos, e a única coisa
// que a migração deste example pras peças COMPROU de verdade — o layout de
// duas colunas continua idêntico ao do preset.
export default function SelectedFieldBar() {
  // Esta barra não recebe prop nenhuma, e o idioma também não precisa virar
  // uma: ela vive DENTRO do `<I18nProvider>` que o DesignerPanel monta, então
  // `useLocale()` devolve exatamente o mesmo `locale` do estado do App. Uma
  // fonte, duas camadas — `useT()` pro que é do pacote, `t()` pro que é nosso.
  const locale = useLocale();
  const tx = t(locale);
  const tPkg = useT();
  const { selected } = useDesignerSelectedSchema();
  const { selectedIds } = useDesignerSelection();
  const { bulkEditActive } = useDesignerBulkEdit();
  // `useDesignerActions()` nunca troca de identidade — é o contexto que foi
  // desenhado pra ser estável, pra uma peça memoizada poder consumir mutador
  // sem re-renderizar quando o template muda.
  const { removeSchema, bringToFront, sendToBack } = useDesignerActions();

  if (!selected) {
    return (
      <div className="flex h-8 flex-shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-400">
        {tx.selectedNone}
      </div>
    );
  }

  return (
    <div className="flex h-8 flex-shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs">
      {/* NOME do campo: dado do usuário, sai como está (por isso a fonte
          mono). TIPO do campo: conceito do PACOTE, e o pacote já traduz —
          `useT().fieldTypeLabels` em vez de uma cópia nossa pra
          dessincronizar. Antes disto saía cru ("text"/"table"), em inglês
          mesmo com a UI em português. */}
      <span className="font-mono font-medium text-slate-700">{selected.name}</span>
      <span className="text-slate-400">{tPkg.fieldTypeLabels[selected.type]}</span>
      <span className="text-slate-300">·</span>
      <span className="text-slate-500">
        {Math.round(selected.x)},{Math.round(selected.y)} mm · {Math.round(selected.width)}×{Math.round(selected.height)} mm
      </span>
      {selectedIds.length > 1 && (
        <span className="rounded bg-sky-50 px-1.5 py-0.5 text-sky-700">
          {bulkEditActive ? tx.selectedBulkEditing(selectedIds.length) : tx.selectedCount(selectedIds.length)}
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => bringToFront(selected.id)}
          className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          {tx.selectedBringToFront}
        </button>
        <button
          type="button"
          onClick={() => sendToBack(selected.id)}
          className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        >
          {tx.selectedSendToBack}
        </button>
        <button
          type="button"
          onClick={() => removeSchema(selected.id)}
          className="rounded px-1.5 py-0.5 text-red-600 hover:bg-red-50"
        >
          {tx.selectedRemove}
        </button>
      </div>
    </div>
  );
}
