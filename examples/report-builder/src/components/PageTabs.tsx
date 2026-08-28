import type { TemplatePage } from "json-pdf-designer";

type Props = {
  pages: TemplatePage[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

// Abas acima do Designer — cada uma é uma TemplatePage independente dentro
// do MESMO Template (ver lib/pages.ts). Rótulo é sempre a posição no array
// ("Página N"), não um nome guardado — evita nome desatualizado depois de
// reordenar/remover uma aba do meio.
export default function PageTabs({ pages, activeIndex, onSelect, onAdd, onRemove }: Props) {
  return (
    <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-2 pt-2">
      {pages.map((p, i) => (
        <div
          key={p.id}
          className={`flex items-center gap-1 rounded-t-lg border border-b-0 px-3 py-1.5 text-xs font-medium ${
            i === activeIndex
              ? "border-slate-200 bg-slate-100 text-slate-900"
              : "border-transparent text-slate-500 hover:bg-slate-50"
          }`}
        >
          <button type="button" className="cursor-pointer" onClick={() => onSelect(i)}>
            Página {i + 1}
          </button>
          {pages.length > 1 && (
            <button
              type="button"
              className="rounded px-1 leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              aria-label={`Remover página ${i + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(i);
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        className="rounded-t-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
        onClick={onAdd}
        aria-label="Adicionar página"
      >
        +
      </button>
    </div>
  );
}
