import type { Locale, TemplatePage } from "json-pdf-designer";
import { t } from "../i18n";

type Props = {
  pages: TemplatePage[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  // `locale` chega por prop, e não de `useLocale()`, porque a casca deste app
  // não pode depender de estar dentro do `<I18nProvider>` — o header e o
  // banner de erro ficam FORA dele (ver App.tsx). O valor é o mesmo estado
  // que alimenta o provider; é um seletor só.
  locale: Locale;
};

// Abas de PÁGINA, acima do canvas — cada uma é uma TemplatePage
// independente dentro do MESMO Template (ver lib/pages.ts). Rótulo é
// sempre a posição no array ("Página N"), não um nome guardado — evita
// nome desatualizado depois de remover uma aba do meio.
//
// ATENÇÃO, e é o ponto deste example: isto NÃO é a barra de abas do
// editor. A `<DesignerTabBar>` do pacote troca qual PAINEL da sidebar
// aparece, e este example não a usa (é o que faz os cinco painéis da
// direita renderizarem juntos). Estas abas aqui trocam qual PÁGINA do
// documento está sendo editada — outra dimensão, estado deste app, e a
// única coisa parecida com aba que existe na tela.
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
