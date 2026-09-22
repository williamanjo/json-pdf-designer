import type { Locale, TemplatePage } from "json-pdf-designer";
import { t } from "../i18n";

type Props = {
  pages: TemplatePage[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  // `locale` arrives as a prop, and not from `useLocale()`, because this app's
  // shell cannot depend on being inside the `<I18nProvider>` — the header and
  // the error banner sit OUTSIDE it (see App.tsx). The value is the same state
  // that feeds the provider; there is only one picker.
  locale: Locale;
};

// PAGE tabs, above the canvas — each one is an independent TemplatePage
// inside the SAME Template (see lib/pages.ts). The label is always the
// position in the array ("Page N"), not a stored name — which avoids a stale
// name after removing a tab from the middle.
//
// CAREFUL, and this is this example's point: this is NOT the editor's tab
// bar. The package's `<DesignerTabBar>` swaps which PANEL of the sidebar
// appears, and this example does not use it (which is what makes the five
// right-hand panels render together). These tabs here swap which PAGE of the
// document is being edited — another dimension, this app's state, and the only
// tab-like thing on screen.
export default function PageTabs({ pages, activeIndex, onSelect, onAdd, onRemove, locale }: Props) {
  const ui = t(locale);

  return (
    <div className="app-pagetabs">
      {pages.map((p, i) => (
        <div key={p.id} className={`app-pagetab${i === activeIndex ? " is-active" : ""}`}>
          <button type="button" className="app-pagetab__label" onClick={() => onSelect(i)}>
            {ui.pagina(i + 1)}
          </button>
          {pages.length > 1 && (
            <button
              type="button"
              className="app-pagetab__close"
              aria-label={ui.removerPagina(i + 1)}
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
      <button type="button" className="app-pagetab__add" onClick={onAdd} aria-label={ui.adicionarPagina}>
        +
      </button>
    </div>
  );
}
