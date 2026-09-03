import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cx, readPart, type PartStyle } from "../../components/ui/cx";
import { IconAlertTriangle, IconChevronLeft, IconChevronRight, IconPlus, IconX } from "../../components/ui/icons";
import { useT } from "../../i18n";
import { useDesignerUi } from "../context/hooks";
import type { HideableTab } from "../useTabBar";
import { useTabGate, type TabGate } from "./useTabGate";

export type DesignerTabBarProps = {
  className?: string;
  style?: CSSProperties;
  whenTab?: TabGate;
  parts?: {
    // A faixa que ROLA (só as abas). As setas e o "+" ficam FORA dela.
    strip?: PartStyle;
  };
};

// Peça posicionável: a barra de abas do painel lateral (Campos/Dados/
// Estilo/Filtro/Página/Inspetor), com arrastar-pra-reordenar, fixar-esconder
// no "×", reabrir no "+", e as setas de rolagem.
//
// NÃO é slotável por `components`: a 2.1.1 foi gasta encaixando 6 abas em
// 290px, e um `Button` do consumidor com `min-width` próprio desfaz isso.
// Continua `<button>` cru com classe nossa.
//
// A raiz é `.jpd-tabs`, a MESMA que o `Designer.tsx` tinha.
export function DesignerTabBar({ whenTab, ...rest }: DesignerTabBarProps) {
  if (!useTabGate(whenTab)) return null;
  return <DesignerTabBarBody {...rest} />;
}

function DesignerTabBarBody({ className, style, parts }: Omit<DesignerTabBarProps, "whenTab">) {
  const t = useT();
  const {
    sidebarTab,
    setSidebarTab,
    setSidebarCollapsed,
    tabMenuOpen,
    setTabMenuOpen,
    orderedVisibleTabs,
    addableOptionalTabs,
    tabsCustomized,
    reorderTabs,
    hideOptionalTab,
    showOptionalTab,
    restoreDefaultTabs,
    draggedTab,
    setDraggedTab,
    dragOverTab,
    setDragOverTab,
  } = useDesignerUi();

  // Estado que NÃO sobe pro provider, e é a única peça com esse caso: uma
  // ref de DOM em contexto quebraria no instante em que duas barras de abas
  // montassem — as duas escreveriam na mesma ref, e o efeito de rolagem
  // mediria a faixa errada.
  const tabStripRef = useRef<HTMLDivElement>(null);
  // Dá pra rolar pra cada lado? Decide se cada seta aparece. Com a barra de
  // rolagem escondida, sem as setas não haveria pista nenhuma de que há aba
  // fora da vista.
  const [tabScroll, setTabScroll] = useState({ left: false, right: false });

  // Lê a posição da faixa e diz pra onde ainda dá pra rolar. A margem de 1px
  // é pro arredondamento de scrollLeft fracionário (zoom do navegador).
  function syncTabScroll() {
    const strip = tabStripRef.current;
    if (!strip) return;
    const max = strip.scrollWidth - strip.clientWidth;
    setTabScroll({ left: strip.scrollLeft > 1, right: strip.scrollLeft < max - 1 });
  }

  // Um passo de seta: 80% da largura visível, pra sempre sobrar uma aba de
  // referência entre um clique e o seguinte.
  //
  // Sem `behavior: "smooth"` de propósito: há ambiente onde o scroll suave
  // simplesmente não roda (medido: `scrollBy` instantâneo move a faixa,
  // `scrollBy` suave deixa scrollLeft em 0 mesmo segundos depois), e aí a
  // seta parece morta. Um salto sem animação é pior visualmente e melhor
  // funcionalmente.
  function nudgeTabs(direction: -1 | 1) {
    const strip = tabStripRef.current;
    if (!strip) return;
    strip.scrollLeft += direction * Math.round(strip.clientWidth * 0.8);
    syncTabScroll();
  }

  // Traz a aba ativa pra vista na faixa que rola. Sem isto, trocar de aba por
  // outro caminho (selecionar um campo troca pra "dados" por conta própria,
  // ver useTabBar) deixaria a aba ativa fora da vista, sem barra de rolagem
  // pra dar a dica. Ajusta `scrollLeft` na mão em vez de `scrollIntoView`
  // porque este último também rola a PÁGINA em alguns navegadores.
  useEffect(() => {
    const strip = tabStripRef.current;
    const active = strip?.querySelector<HTMLElement>('[data-active="true"]');
    if (!strip) return;
    syncTabScroll();
    if (!active) return;
    // Retângulos, não `offsetLeft`: os botões são `position: relative` e a
    // faixa não, então o `offsetParent` deles é um ancestral mais acima e o
    // `offsetLeft` mede a partir do lugar errado.
    const strato = strip.getBoundingClientRect();
    const aba = active.getBoundingClientRect();
    if (aba.left < strato.left) strip.scrollLeft -= strato.left - aba.left;
    else if (aba.right > strato.right) strip.scrollLeft += aba.right - strato.right;
    // De novo depois de mexer: a atribuição acima muda scrollLeft na hora, mas
    // o evento de scroll só chega depois — sem isto as setas ficariam um
    // clique atrasadas.
    syncTabScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarTab, orderedVisibleTabs.length]);

  const strip = readPart(parts?.strip);

  return (
    <div className={cx("jpd-tabs", className)} data-part="tab-bar" style={style}>
      {/* Setas de rolagem — só aparecem do lado que tem aba escondida.
          Ficam fora da faixa, como o "+": uma seta que rola junto com o
          conteúdo não serviria de nada. */}
      {tabScroll.left && (
        <button
          type="button"
          onClick={() => nudgeTabs(-1)}
          aria-label={t.tabBar.scrollTabsLeft}
          title={t.tabBar.scrollTabsLeft}
          data-dir="left"
          className="jpd-tabs__btn"
        >
          <IconChevronLeft />
        </button>
      )}
      {/* A faixa das abas rola; o "+" abaixo fica FORA dela, senão ele
          seria a primeira coisa a sair de vista justamente quando há aba
          escondida pra reabrir. */}
      <div ref={tabStripRef} onScroll={syncTabScroll} className={cx("jpd-tabs__strip", strip.className)} style={strip.style}>
        {orderedVisibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            // ÚNICO site que escreve o booleano CRU em vez de
            // `cond || undefined`: o efeito acima faz
            // `strip.querySelector('[data-active="true"]')` pra trazer a aba
            // ativa pra vista, e o React serializa `false` como a STRING
            // "false" — que ainda casa `[data-active]`. Com `|| undefined` o
            // atributo desaparece da aba inativa e o seletor teria de virar
            // `[data-active]`; qualquer uma das duas formas funciona,
            // MISTURAR faz o seletor casar toda aba. O CSS
            // (`.jpd-tab[data-active="true"]`) concorda com esta forma —
            // mexer aqui é mexer nos três lugares.
            data-active={sidebarTab === tab.key}
            data-dragging={draggedTab === tab.key || undefined}
            draggable
            onDragStart={(e) => {
              setDraggedTab(tab.key);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (draggedTab && draggedTab !== tab.key) setDragOverTab(tab.key);
            }}
            onDragLeave={() => setDragOverTab((cur) => (cur === tab.key ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedTab) reorderTabs(draggedTab, tab.key);
              setDraggedTab(null);
              setDragOverTab(null);
            }}
            onDragEnd={() => {
              setDraggedTab(null);
              setDragOverTab(null);
            }}
            onClick={() => {
              setSidebarTab(tab.key);
              setSidebarCollapsed(false);
            }}
            onDoubleClick={() => setSidebarCollapsed((c) => !c)}
            title={t.tabBar.dragToReorder}
            className="jpd-tab"
          >
            {/* Indicador de onde a aba arrastada vai parar (antes desta). */}
            {dragOverTab === tab.key && draggedTab && draggedTab !== tab.key && <span className="jpd-tab__dropmark" />}
            {tab.label}
            {tab.warning && <IconAlertTriangle className="jpd-warnicon jpd-warnicon--sm" />}
            {/* Fixar/esconder — só na aba ativa (senão não cabe todo mundo
                junto na barra) — some pra todo campo até reabrir no "+". */}
            {tab.removable && sidebarTab === tab.key && (
              <span
                role="button"
                aria-label={t.tabBar.pinAria(tab.label)}
                title={t.tabBar.pinTitle(tab.label)}
                onClick={(e) => {
                  e.stopPropagation();
                  hideOptionalTab(tab.key as HideableTab);
                }}
                className="jpd-tab__pin"
              >
                {/* Sem className: o tamanho de 10px é do CSS
                    (`.jpd-tab__pin > svg`), porque `width`/`height` de <svg>
                    são geometry properties — CSS vence o atributo de 14 que
                    icons.tsx escreve. */}
                <IconX />
              </span>
            )}
          </button>
        ))}
      </div>

      {tabScroll.right && (
        <button
          type="button"
          onClick={() => nudgeTabs(1)}
          aria-label={t.tabBar.scrollTabsRight}
          title={t.tabBar.scrollTabsRight}
          data-dir="right"
          className="jpd-tabs__btn"
        >
          <IconChevronRight />
        </button>
      )}

      {/* "+" sempre no final da barra — reabre aba escondida e/ou restaura
          ordem/visibilidade padrão. Só aparece quando há algo pra mexer (aba
          escondida ou ordem já alterada). */}
      {(addableOptionalTabs.length > 0 || tabsCustomized) && (
        <div className="jpd-tabs__more">
          <button
            type="button"
            onClick={() => setTabMenuOpen((o) => !o)}
            title={t.tabBar.reopenOrRestoreTitle}
            aria-label={t.tabBar.reopenOrRestoreTitle}
            className="jpd-tabs__btn"
          >
            <IconPlus />
          </button>
          {tabMenuOpen && (
            <div className="jpd-popover jpd-popover--anchor-right">
              {addableOptionalTabs.map((tab) => (
                <button key={tab.key} type="button" onClick={() => showOptionalTab(tab.key)} className="jpd-menuitem">
                  {tab.label}
                </button>
              ))}
              {tabsCustomized && (
                <>
                  {addableOptionalTabs.length > 0 && <div className="jpd-menu__sep" />}
                  <button type="button" onClick={restoreDefaultTabs} className="jpd-menuitem jpd-menuitem--muted">
                    {t.tabBar.restoreDefault}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
