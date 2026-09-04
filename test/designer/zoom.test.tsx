import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { clampZoom, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../../src/canvas/zoomScale";
import { PageCanvas } from "../../src/components/PageCanvas";
import type { Template } from "../../src/types";

// O ZOOM COMO API PÚBLICA.
//
// O pedido que originou isto: montando o editor com `DesignerProvider` +
// peças soltas, não havia como ler o zoom, disparar fit/reset de fora, nem
// mover a barra pra outro container React — a `.jpd-zoombar` é
// `position: sticky` DENTRO do canvas, então CSS só a movia ali dentro.
//
// Estes testes cobrem as três partes que dá pra verificar sem DOM de
// verdade: a escala compartilhada, o modo controlado do `<PageCanvas>` e o
// `hideZoombar`. A fiação com o contexto é verificada em
// test/designer/partsRender.test.tsx (que monta as peças) e no navegador.

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
    // Este caso ACHOU BUG. `Math.max(0.25, NaN)` é NaN e o NaN sobrevive ao
    // `Math.min`, então o clamp devolvia NaN — que chegava em
    // `transform: scale(NaN)` e fazia a folha desaparecer, sem erro nenhum.
    //
    // Volta 1 (e não o mínimo) porque NaN é "não há valor", e 100% é o
    // resultado menos surpreendente. Alcançável por `fitWidth()` sobre
    // página com width NaN e por `Number(campoVazio)` numa barra própria.
    expect(Number.isNaN(clampZoom(Number.NaN))).toBe(false);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it("Infinity continua clampando pro extremo, não pra 100%", () => {
    // A distinção importa: em Infinity EXISTE valor, ele só é grande. Tratar
    // os dois igual esconderia um slider quebrado.
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
    // É o caminho headless: `<PageCanvas>` usado direto, sem provider.
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
    // Consumidor passando 9 não faz a folha sair da tela.
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
