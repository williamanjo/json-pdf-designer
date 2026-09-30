import type { TemplatePage } from "json-pdf-designer/server";
import type { ShellDict } from "../i18n";

type Props = {
  pages: TemplatePage[];
  activeIndex: number;
  // The SHELL's dictionary: "Page N" is a label of this tab bar, which the
  // package does not have (there the page tabs do not exist — `pages` is only
  // an array in the `Template`). The package's `t.tabBar.page` is the name of
  // the page's PROPERTIES TAB, another concept; using it here would be worse
  // than translating by hand.
  tt: ShellDict;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

// Page tabs — each one is an independent TemplatePage inside the SAME
// Template (see lib/pages.ts). The label is always the position in the array
// ("Page N" / "Página N"), not a stored name — which avoids a stale name after
// removing a tab from the middle.
//
// Here the tabs are not "above the <Designer>": they swap the page OUR canvas
// draws (App.tsx::activePage). The engine knows nothing about tabs — `pages`
// is only an array in the Template, and generatePdf generates them all.
export default function PageTabs({ pages, activeIndex, tt, onSelect, onAdd, onRemove }: Props) {
  return (
    <div className="page-tabs">
      {pages.map((p, i) => (
        <div key={p.id} className={`page-tab${i === activeIndex ? " active" : ""}`}>
          <button type="button" onClick={() => onSelect(i)}>
            {tt.pages.tab(i + 1)}
          </button>
          {pages.length > 1 && (
            <button
              type="button"
              className="page-tab-remove"
              aria-label={tt.pages.removeAria(i + 1)}
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
      <button type="button" className="page-tab-add" onClick={onAdd} aria-label={tt.pages.addAria}>
        +
      </button>
    </div>
  );
}
