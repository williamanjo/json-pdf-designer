import { clampZoom, useDesignerZoom, type Locale } from "json-pdf-designer";
import { t } from "../i18n";

type Props = {
  // The same reason as PageTabs: `locale` as a prop, because this bar lives
  // in the app's shell, next to the page tabs, and not inside the editor.
  locale: Locale;
};

// THIS APP'S ZOOM BAR — the case 3.1.0 unlocked.
//
// Before it the zoom was `useState` internal to `<PageCanvas>`, and the
// package's `.jpd-zoombar` is `position: sticky` INSIDE the
// `.jpd-designer__canvas`. That is: CSS moved the bar around the corners of
// that box, and nothing more. Reading the value to show it elsewhere, or
// firing "fit width" from a button on the tab bar, was impossible without
// reimplementing zoom from outside — with a second copy of the value to fall
// out of sync with the sheet the canvas actually renders.
//
// Here the bar lives next to the PAGE TABS, which are this app's component,
// outside the canvas. `<DesignerCanvas hideZoombar />` hides the default one,
// and this component is the only source of control — with no copy of the
// state, because `useDesignerZoom()` returns the real value.
//
// And this is what the separate context buys: dragging the slider re-renders
// THIS bar and the canvas, and nothing else. The field list and the panels on
// the right stay put.
export default function ZoomBar({ locale }: Props) {
  const { zoom, min, max, setZoom, zoomIn, zoomOut, reset, fitWidth, fitHeight } = useDesignerZoom();
  const ui = t(locale);
  const pct = Math.round(zoom * 100);

  return (
    <div className="app-zoombar">
      <button type="button" className="app-zoombar__btn" onClick={zoomOut} disabled={zoom <= min} aria-label={ui.zoomMenos}>
        −
      </button>

      {/* A real slider, which the package's bar does not have — the proof
          that the value is writable from outside, and not only readable. */}
      <input
        type="range"
        className="app-zoombar__slider"
        min={min}
        max={max}
        // `step="any"`, and NOT `step={step}`. Measured: with `min=0.25` and
        // `step=0.1` an `<input type="range">` only accepts the grid
        // 0.25 / 0.35 / … / 1.05 — so asking for 1 gave 105% and the slider
        // never touched exactly 100%, while the "100%" button next to it did.
        // The package's `ZOOM_STEP` is the BUTTONS' increment (+/−); the scale
        // itself is continuous within [min, max], and it is `setZoom` that
        // guarantees the limit.
        step="any"
        value={zoom}
        aria-label={ui.zoomNivel}
        // The package's `clampZoom`, and not a clamp of ours: the canvas's
        // limits are the same ones this input uses, so a value from here is
        // never refused later. `Number("")` is NaN, and the clamp resolves to 100%.
        onChange={(e) => setZoom(clampZoom(Number(e.target.value)))}
      />

      <button type="button" className="app-zoombar__btn" onClick={zoomIn} disabled={zoom >= max} aria-label={ui.zoomMais}>
        +
      </button>

      {/* THE VALUE, read from the context. There used to be no way to show this here. */}
      <span className="app-zoombar__valor">{pct}%</span>

      <span className="app-zoombar__sep" />

      {/* `fitWidth`/`fitHeight` measure the canvas's viewport, which the
          `<DesignerCanvas>` registers — so they work even when called from a
          button that is not inside it. */}
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
