import type { Locale, TemplatePage } from "json-pdf-designer";
import { t } from "../i18n";

type Props = {
  pages: TemplatePage[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  // O MESMO `locale` do <Designer> (ver App.tsx).
  locale: Locale;
};

// Abas acima do Designer — cada uma é uma TemplatePage independente dentro
// do MESMO Template (ver lib/pages.ts). Rótulo é sempre a posição no array
// ("Página N"), não um nome guardado — evita nome desatualizado depois de
// reordenar/remover uma aba do meio.
//
// ATENÇÃO: estas abas ficam DENTRO do `.app-main`, o mesmo container do
// <Designer>. Por isso cada botão aqui carrega a própria classe `.app-*`
// em vez de depender de uma regra `.app-main button { ... }`, que
// alcançaria (e venceria) todo botão do editor — ver o comentário grande
// do src/index.css.
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
