import type { Locale, TemplatePage } from "json-pdf-designer";
import { pageLabel, t } from "../i18n";

type Props = {
  pages: TemplatePage[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  locale: Locale;
};

// Tabs above the Designer — each one is an independent TemplatePage inside
// the SAME Template (see lib/pages.ts). The label is always the position in
// the array ("Página N" / "Page N"), not a stored name — which avoids a stale
// name after reordering/removing a tab from the middle.
//
// These tabs belong to the SHELL, not to the editor: the classes are
// `.page-tab*` from src/index.css, not the `.jpd-tab` the <Designer> uses
// internally. The two tab bars sit stacked on screen (the page one here, the
// properties one in there), and it is deliberate that they do not look alike.
export default function PageTabs({ pages, activeIndex, onSelect, onAdd, onRemove, locale }: Props) {
  const d = t(locale);
  return (
    <div className="page-tabs">
      {pages.map((p, i) => (
        <div key={p.id} className={i === activeIndex ? "page-tab is-active" : "page-tab"}>
          <button type="button" className="page-tab-label" onClick={() => onSelect(i)}>
            {/* The word "page" comes from the PACKAGE's dictionary (see
                i18n.ts::pageLabel) — the "Page" tab of the property panel just
                below uses the same one, and two copies would fall out of sync. */}
            {pageLabel(locale, i + 1)}
          </button>
          {pages.length > 1 && (
            <button
              type="button"
              className="page-tab-close"
              aria-label={d.removePageAria(i + 1)}
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
      <button type="button" className="page-tab-add" onClick={onAdd} aria-label={d.addPageAria}>
        +
      </button>
    </div>
  );
}
