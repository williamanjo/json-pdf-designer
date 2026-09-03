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

// Abas acima do Designer — cada uma é uma TemplatePage independente dentro
// do MESMO Template (ver lib/pages.ts). Rótulo é sempre a posição no array
// ("Página N" / "Page N"), não um nome guardado — evita nome desatualizado
// depois de reordenar/remover uma aba do meio.
//
// Estas abas são da CASCA, não do editor: as classes são `.page-tab*` de
// src/index.css, não as `.jpd-tab` que o <Designer> usa por dentro. As duas
// barras de abas ficam empilhadas na tela (página aqui, propriedades lá
// dentro), e é de propósito que não pareçam a mesma coisa.
export default function PageTabs({ pages, activeIndex, onSelect, onAdd, onRemove, locale }: Props) {
  const d = t(locale);
  return (
    <div className="page-tabs">
      {pages.map((p, i) => (
        <div key={p.id} className={i === activeIndex ? "page-tab is-active" : "page-tab"}>
          <button type="button" className="page-tab-label" onClick={() => onSelect(i)}>
            {/* A palavra "página" vem do dicionário DO PACOTE (ver
                i18n.ts::pageLabel) — a aba "Página" do painel de propriedades
                logo abaixo usa a mesma, e duas cópias iam dessincronizar. */}
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
