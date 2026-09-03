import type { TemplatePage } from "json-pdf-designer/server";
import type { ShellDict } from "../i18n";

type Props = {
  pages: TemplatePage[];
  activeIndex: number;
  // Dicionário da CASCA: "Página N" é rótulo desta barra de abas, que o
  // pacote não tem (lá as abas de página não existem — `pages` é só um array
  // no `Template`). O `t.tabBar.page` do pacote é o nome da ABA DE
  // PROPRIEDADES da página, outro conceito; usá-lo aqui seria pior que
  // traduzir à mão.
  tt: ShellDict;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

// Abas de página — cada uma é uma TemplatePage independente dentro do MESMO
// Template (ver lib/pages.ts). Rótulo é sempre a posição no array ("Page N" /
// "Página N"), não um nome guardado — evita nome desatualizado depois de
// remover uma aba do meio.
//
// Aqui as abas não estão "acima do <Designer>": elas trocam a página que o
// NOSSO canvas desenha (App.tsx::activePage). O motor não sabe de abas
// nenhuma — `pages` é só um array no Template, e generatePdf gera todas.
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
