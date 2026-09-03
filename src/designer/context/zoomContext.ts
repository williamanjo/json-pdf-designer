import { createContext, type RefObject } from "react";

// O ZOOM DO CANVAS, EM CONTEXTO PRÓPRIO.
//
// Até a 3.0.1 o zoom era `useState` interno do `<PageCanvas>` e nunca subia.
// A justificativa registrada no `DesignerCanvas` era de performance:
// "arrastar o slider re-renderizaria toda peça se o valor morasse no
// provider". Ela estava certa sobre o PROBLEMA e errada sobre a SOLUÇÃO — o
// que causa re-render em cascata é o valor morar num dos cinco contextos que
// todas as peças leem, não o valor estar em contexto.
//
// Contexto SEPARADO resolve as duas coisas ao mesmo tempo:
//
//   - quem não chama `useDesignerZoom()` não re-renderiza quando o zoom muda
//     — lista de campos, inspetor e painel de propriedades ficam parados
//     enquanto o slider é arrastado;
//   - quem chama (o canvas, e a barra que o consumidor desenhar) recebe o
//     valor de verdade, então não existe segunda cópia pra dessincronizar.
//
// É o mesmo argumento que já justificava o registry de primitivos ter
// contexto próprio (ver components/ui/registry.ts).
//
// O que estava impossível antes disto: ler o zoom pra mostrar em outro lugar,
// disparar zoom/fit de um botão fora do canvas, e desenhar a própria barra em
// qualquer container React — a `.jpd-zoombar` padrão é `position: sticky`
// DENTRO do canvas, então CSS só a movia dentro daquela caixa.

export type DesignerZoomValue = {
  /** Fator atual. 1 = 100%. Sempre dentro de [`min`, `max`]. */
  zoom: number;
  /** Limites e passo usados pelo canvas — os mesmos que a barra padrão usa. */
  min: number;
  max: number;
  step: number;
  /**
   * Aceita valor ou updater, igual `setState`. O resultado é sempre clampado,
   * então passar 12 ou -3 não quebra nada: vira `max` / `min`.
   */
  setZoom: (proximo: number | ((anterior: number) => number)) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Volta pra 100%. */
  reset: () => void;
  /**
   * Ajusta pra largura/altura do viewport que ROLA — o `<DesignerCanvas>`,
   * que se registra em `viewportRef`. Sem canvas montado, não faz nada (em
   * vez de medir a janela inteira e devolver um zoom grande demais).
   */
  fitWidth: () => void;
  fitHeight: () => void;
  /**
   * O elemento que rola, preenchido pelo `<DesignerCanvas>` montado. Público
   * porque é útil pra mais que o fit — rolar até um campo, por exemplo.
   * `null` até o canvas montar.
   */
  viewportRef: RefObject<HTMLDivElement | null>;
};


export const DesignerZoomContext = createContext<DesignerZoomValue | null>(null);
