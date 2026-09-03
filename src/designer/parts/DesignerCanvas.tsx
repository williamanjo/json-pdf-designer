import type { CSSProperties } from "react";
import { PageCanvas } from "../../components/PageCanvas";
import { cx } from "../../components/ui/cx";
import { useDesignerActions, useDesignerConfig, useDesignerData, useDesignerSelection, useDesignerUi } from "../context/hooks";
import { useDesignerZoom } from "../context/useDesignerZoom";
import { useTabGate, type TabGate } from "./useTabGate";

export type DesignerCanvasProps = {
  className?: string;
  style?: CSSProperties;
  whenTab?: TabGate;
  /**
   * Esconde a barra flutuante de zoom. Use com `useDesignerZoom()` pra
   * desenhar a sua, em qualquer lugar da árvore — inclusive fora do canvas,
   * que é o que CSS não conseguia fazer (a `.jpd-zoombar` é
   * `position: sticky` DENTRO desta caixa).
   */
  hideZoombar?: boolean;
};

// Peça posicionável: a folha em mm, com arrastar/redimensionar por campo
// (react-rnd), caixa de seleção, réguas e a barra de zoom.
//
// DIVISÃO DE RESPONSABILIDADE, e ela não é negociável:
//
//   A PEÇA é dona da geometria da folha — mm→px, `transform: scale(zoom)`,
//   `transformOrigin`. O `react-rnd` recebe `scale={zoom}` e calcula o delta
//   de arrasto CONTRA isso; consumidor sobrescrevendo o transform faz o
//   campo fugir do cursor.
//
//   O CONSUMIDOR é dono do viewport que ROLA. É o que `className`/`style`
//   daqui atingem: a caixa de fora, não a folha.
//
// O ZOOM subiu pro contexto na 3.1.0, e o comentário que estava aqui dizia o
// contrário — vale registrar por quê, porque a razão antiga não era boba.
//
// Ela dizia: "arrastar o slider re-renderizaria toda peça se o valor morasse
// no provider". Verdade, se o valor morasse num dos cinco contextos que
// todas as peças leem. Mas o zoom ganhou contexto PRÓPRIO
// (`context/zoom.tsx`), então quem não chama `useDesignerZoom()` continua
// parado enquanto o slider é arrastado — e quem monta o próprio layout passa
// a poder ler o zoom, disparar fit/reset de fora, e desenhar a própria barra
// onde quiser.
//
// O `<PageCanvas>` daqui vira CONTROLADO por isso. Ele continua funcionando
// sem as props (estado interno), que é o caminho headless.
//
// A raiz é o `<div data-scroll-root className="jpd-designer__canvas">` que o
// `Designer.tsx` tinha — mesma caixa, mesmo atributo.
export function DesignerCanvas({ whenTab, ...rest }: DesignerCanvasProps) {
  if (!useTabGate(whenTab)) return null;
  return <DesignerCanvasBody {...rest} />;
}

function DesignerCanvasBody({ className, style, hideZoombar = false }: Omit<DesignerCanvasProps, "whenTab">) {
  const { template } = useDesignerData();
  const { onCanvasDrop, gridSizeMm } = useDesignerConfig();
  const { isolateBands } = useDesignerUi();
  const { selectedIds, selectedKpiElement, setSelectedKpiElement, handleSelect, handleSelectMany } = useDesignerSelection();
  const { updateSchema, moveGroup, dropSectionColumn } = useDesignerActions();
  const { zoom, setZoom, viewportRef } = useDesignerZoom();

  return (
    // O canvas tem largura INLINE fixa (contentWidth * zoom, em PageCanvas),
    // então ele não encolhe — `flex-shrink` não vence uma largura declarada.
    // Sem esta caixa, uma página A4 a 100% (810px) mais o painel de 320px
    // passavam da largura do container e o painel saía da viewport, visível
    // só rolando a página toda pra direita. O `min-inline-size: 0` de
    // `.jpd-designer__canvas` deixa a caixa encolher abaixo do conteúdo, e o
    // `overflow-x: auto` põe a rolagem AQUI, no canvas, em vez de empurrar o
    // painel pra fora.
    //
    // `data-scroll-root` marca ESTA caixa como o viewport que rola, pro
    // "ajustar largura/altura" medir o espaço certo (ver fitTo em
    // PageCanvas.tsx). Sem o atributo, o seletor de lá só tinha os braços
    // `[class*="overflow-auto"]`/`[class*="overflow-y-auto"]` — e
    // "overflow-x-auto" não contém nenhuma das duas substrings, então o
    // closest não achava nada e caía no fallback `window.innerWidth`: o zoom
    // vinha calculado sobre a janela inteira, sempre maior que a área real.
    // Os braços de classe ficam como estão, pra quem embrulha isto numa
    // caixa `overflow-auto` própria — e agora são a ÚNICA saída pra esse
    // caso, porque `.jpd-designer__canvas` não tem "overflow" no nome.
    // `ref` pro contexto de zoom: é ESTA caixa que rola, e é ela que o
    // `fitWidth()`/`fitHeight()` mede. Antes a medição saía do `closest()` a
    // partir do botão clicado — o que funciona pra barra padrão, que vive
    // dentro do canvas, e não funciona pra um botão que o consumidor põe em
    // qualquer outro lugar da tela.
    <div
      ref={viewportRef}
      data-scroll-root
      data-part="canvas"
      className={cx("jpd-designer__canvas", className)}
      style={style}
    >
      <PageCanvas
        page={template.page}
        schemas={template.schemas}
        headerHeight={template.headerHeight}
        footerHeight={template.footerHeight}
        marginLeft={template.marginLeft}
        marginRight={template.marginRight}
        gridSizeMm={gridSizeMm}
        isolateBands={isolateBands}
        backgroundImage={template.backgroundImage}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        onSelectMany={handleSelectMany}
        onUpdateSchema={updateSchema}
        onMoveGroup={moveGroup}
        onCanvasDrop={onCanvasDrop}
        onDropSectionColumn={dropSectionColumn}
        selectedKpiElement={selectedKpiElement}
        onSelectKpiElement={setSelectedKpiElement}
        zoom={zoom}
        onChangeZoom={setZoom}
        hideZoombar={hideZoombar}
      />
    </div>
  );
}
