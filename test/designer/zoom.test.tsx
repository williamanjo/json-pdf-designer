import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { clampZoom, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../../src/canvas/zoomScale";
import { PageCanvas } from "../../src/components/PageCanvas";
import type { Template } from "../../src/types";

// THE ZOOM AS PUBLIC API.
//
// The request that started this: assembling the editor with
// `DesignerProvider` + loose parts, there was no way to read the zoom, fire
// fit/reset from outside, or move the bar into another React container — the
// `.jpd-zoombar` is `position: sticky` INSIDE the canvas, so CSS could only
// move it in there.
//
// These tests cover the three parts that can be checked without a real DOM:
// the shared scale, `<PageCanvas>`'s controlled mode and `hideZoombar`. The
// wiring with the context is checked in test/designer/partsRender.test.tsx
// (which mounts the parts) and in the browser.

const pagina = { width: 210, height: 297 };

function template(): Template {
  return { page: pagina, schemas: [] } as unknown as Template;
}

describe("escala de zoom — uma fonte só", () => {
  it("os limites são os que a barra e o contexto usam", () => {
    expect(ZOOM_MIN).toBe(0.25);
    expect(ZOOM_MAX).toBe(3);
    expect(ZOOM_STEP).toBe(0.1);
  });

  it("clampZoom prende nos dois extremos", () => {
    expect(clampZoom(99)).toBe(ZOOM_MAX);
    expect(clampZoom(-1)).toBe(ZOOM_MIN);
    expect(clampZoom(1)).toBe(1);
  });

  it("clampZoom não deixa NaN passar, e devolve 100%", () => {
    // This case FOUND A BUG. `Math.max(0.25, NaN)` is NaN and the NaN survives
    // `Math.min`, so the clamp returned NaN — which reached
    // `transform: scale(NaN)` and made the sheet disappear, with no error.
    //
    // It falls back to 1 (and not to the minimum) because NaN is "there is no
    // value", and 100% is the least surprising result. Reachable through
    // `fitWidth()` over a page with a NaN width and through `Number(empty)`.
    expect(Number.isNaN(clampZoom(Number.NaN))).toBe(false);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it("Infinity continua clampando pro extremo, não pra 100%", () => {
    // The distinction matters: with Infinity a value DOES exist, it is merely
    // large. Treating the two the same would hide a broken slider.
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(ZOOM_MAX);
    expect(clampZoom(Number.NEGATIVE_INFINITY)).toBe(ZOOM_MIN);
  });
});

describe("PageCanvas — zoom controlado e não controlado", () => {
  const comuns = {
    page: pagina,
    schemas: template().schemas,
    selectedIds: [] as string[],
    onSelect: () => {},
    onSelectMany: () => {},
    onUpdateSchema: () => {},
    onMoveGroup: () => {},
  };

  it("sem a prop `zoom`, desenha em 100% (estado interno)", () => {
    // It is the headless path: `<PageCanvas>` used directly, with no provider.
    const html = renderToStaticMarkup(<PageCanvas {...comuns} />);
    expect(html).toContain("scale(1)");
    expect(html).toContain("100%");
  });

  it("com a prop `zoom`, o valor de fora manda", () => {
    const html = renderToStaticMarkup(<PageCanvas {...comuns} zoom={1.5} />);
    expect(html).toContain("scale(1.5)");
    expect(html).toContain("150%");
  });

  it("a prop `zoom` também é clampada", () => {
    // A consumer passing 9 does not push the sheet off the screen.
    const html = renderToStaticMarkup(<PageCanvas {...comuns} zoom={9} />);
    expect(html).toContain(`scale(${ZOOM_MAX})`);
  });

  it("`hideZoombar` tira a barra padrão e mais nada", () => {
    const com = renderToStaticMarkup(<PageCanvas {...comuns} />);
    const sem = renderToStaticMarkup(<PageCanvas {...comuns} hideZoombar />);

    expect(com).toContain("jpd-zoombar");
    expect(sem).not.toContain("jpd-zoombar");

    // O CANVAS continua inteiro — este é o ponto: esconder o controle não
    // pode desligar o zoom nem a folha.
    expect(sem).toContain("jpd-canvas__zoom");
    expect(sem).toContain("scale(1)");
    expect(sem).toContain("jpd-page");
  });

  it("controle: a varredura do markup acha a barra de verdade", () => {
    // Anti-vacuidade do caso acima. Se a classe for renomeada, o
    // `not.toContain` passa por não achar nada.
    expect(renderToStaticMarkup(<PageCanvas {...comuns} />)).toContain('class="jpd-zoombar"');
  });
});
