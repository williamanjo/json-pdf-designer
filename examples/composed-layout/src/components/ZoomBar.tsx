import { clampZoom, useDesignerZoom, type Locale } from "json-pdf-designer";
import { t } from "../i18n";

type Props = {
  // Mesmo motivo do PageTabs: `locale` por prop, porque esta barra vive na
  // casca do app, ao lado das abas de página, e não dentro do editor.
  locale: Locale;
};

// A BARRA DE ZOOM DESTE APP — o caso que a 3.1.0 destravou.
//
// Antes dela o zoom era `useState` interno do `<PageCanvas>`, e a
// `.jpd-zoombar` do pacote é `position: sticky` DENTRO do
// `.jpd-designer__canvas`. Ou seja: CSS movia a barra pelos cantos daquela
// caixa, e nada mais. Ler o valor pra mostrar em outro lugar, ou disparar
// "ajustar largura" de um botão da barra de abas, era impossível sem
// reimplementar zoom por fora — com uma segunda cópia do valor pra
// dessincronizar da folha que o canvas realmente renderiza.
//
// Aqui a barra mora ao lado das ABAS DE PÁGINA, que são componente deste app,
// fora do canvas. O `<DesignerCanvas hideZoombar />` esconde a padrão, e este
// componente é a única fonte de controle — sem cópia de estado, porque
// `useDesignerZoom()` devolve o valor de verdade.
//
// E é isto que o contexto separado compra: arrastar o slider re-renderiza
// ESTA barra e o canvas, e mais nada. A lista de campos e os painéis à
// direita ficam parados.
export default function ZoomBar({ locale }: Props) {
  const { zoom, min, max, setZoom, zoomIn, zoomOut, reset, fitWidth, fitHeight } = useDesignerZoom();
  const ui = t(locale);
  const pct = Math.round(zoom * 100);

  return (
    <div className="app-zoombar">
      <button type="button" className="app-zoombar__btn" onClick={zoomOut} disabled={zoom <= min} aria-label={ui.zoomMenos}>
        −
      </button>

      {/* Slider de verdade, que a barra do pacote não tem — a prova de que o
          valor é gravável de fora, e não só legível. */}
      <input
        type="range"
        className="app-zoombar__slider"
        min={min}
        max={max}
        // `step="any"`, e NÃO `step={step}`. Medido: com `min=0.25` e
        // `step=0.1` um `<input type="range">` só aceita a grade
        // 0,25 / 0,35 / … / 1,05 — então pedir 1 dava 105% e o slider nunca
        // encostava em 100% exato, enquanto o botão "100%" ao lado chegava.
        // O `ZOOM_STEP` do pacote é o incremento dos BOTÕES (+/−); a escala em
        // si é contínua dentro de [min, max], e é o `setZoom` que garante o
        // limite.
        step="any"
        value={zoom}
        aria-label={ui.zoomNivel}
        // `clampZoom` do pacote, e não um clamp nosso: os limites do canvas
        // são os mesmos que este input usa, então um valor daqui nunca é
        // recusado depois. `Number("")` é NaN, e o clamp resolve pra 100%.
        onChange={(e) => setZoom(clampZoom(Number(e.target.value)))}
      />

      <button type="button" className="app-zoombar__btn" onClick={zoomIn} disabled={zoom >= max} aria-label={ui.zoomMais}>
        +
      </button>

      {/* O VALOR, lido do contexto. Antes não havia como mostrar isto aqui. */}
      <span className="app-zoombar__valor">{pct}%</span>

      <span className="app-zoombar__sep" />

      {/* `fitWidth`/`fitHeight` medem o viewport do canvas, que o
          `<DesignerCanvas>` registra — então funcionam mesmo sendo chamados
          de um botão que não está dentro dele. */}
      <button type="button" className="app-zoombar__btn" onClick={fitWidth}>
        {ui.zoomLargura}
      </button>
      <button type="button" className="app-zoombar__btn" onClick={fitHeight}>
        {ui.zoomAltura}
      </button>
      <button type="button" className="app-zoombar__btn" onClick={reset} disabled={zoom === 1}>
        100%
      </button>
    </div>
  );
}
