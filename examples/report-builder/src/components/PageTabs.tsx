import type { Locale, TemplatePage } from "json-pdf-designer";
import { t } from "../i18n";

type Props = {
  locale: Locale;
  pages: TemplatePage[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

// Tabs above the Designer — each one is an independent TemplatePage inside
// the SAME Template (see lib/pages.ts). The label is always the position in
// the array ("Page N"), not a stored name — which avoids a stale name after
// reordering/removing a tab from the middle.
export default function PageTabs({ locale, pages, activeIndex, onSelect, onAdd, onRemove }: Props) {
  const tx = t(locale);
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
            {tx.pageLabel(i + 1)}
          </button>
          {pages.length > 1 && (
            <button
              type="button"
              className="rounded px-1 leading-none text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              aria-label={tx.pageRemoveAria(i + 1)}
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
        aria-label={tx.pageAddAria}
      >
        +
      </button>
    </div>
  );
}
