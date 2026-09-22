import type { Locale, TemplatePage } from "json-pdf-designer";
import { t } from "../i18n";

type Props = {
  pages: TemplatePage[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  // The SAME `locale` as the <Designer> (see App.tsx).
  locale: Locale;
};

// Tabs above the Designer — each one is an independent TemplatePage inside
// the SAME Template (see lib/pages.ts). The label is always the position in
// the array ("Page N"), not a stored name — which avoids a stale name after
// reordering/removing a tab from the middle.
//
// CAREFUL: these tabs sit INSIDE `.app-main`, the same container as the
// <Designer>. That is why each button here carries its own `.app-*` class
// instead of relying on an `.app-main button { ... }` rule, which would reach
// (and beat) every button in the editor — see the long comment in
// src/index.css.
export default function PageTabs({ pages, activeIndex, onSelect, onAdd, onRemove, locale }: Props) {
  const s = t(locale);
  return (
    <div className="app-tabs">
      {pages.map((p, i) => (
        <div key={p.id} className={`app-tab ${i === activeIndex ? "is-active" : ""}`}>
          <button type="button" className="app-tab__label" onClick={() => onSelect(i)}>
            {s.pages.label(i + 1)}
          </button>
          {pages.length > 1 && (
            <button
              type="button"
              className="app-tab__close"
              aria-label={s.pages.remove(i + 1)}
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
      <button type="button" className="app-tab__add" onClick={onAdd} aria-label={s.pages.add}>
        +
      </button>
    </div>
  );
}
