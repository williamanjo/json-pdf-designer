import { useEffect, useRef, type MutableRefObject, type Ref } from "react";

// O QUE FAZ UM OVERLAY SER UM DIÁLOGO, num lugar só.
//
// Antes desta 3.3.0 os três modais do pacote (Modal/ModalShell, o
// FormulaModal que usa ele, e o PdfPreviewModal que tem marcação própria)
// eram `<div>` com fundo escurecido. Isso basta pro olho e não basta pro
// resto:
//
//   - sem `role="dialog"` + `aria-modal`, leitor de tela não anuncia que
//     abriu um diálogo, e continua lendo a página INTEIRA atrás do overlay
//     como se ela estivesse disponível;
//   - sem prender o Tab, a terceira tecla Tab sai do modal e vai focar
//     botão que está visualmente atrás de um fundo escuro — o usuário
//     "perde" o foco numa área que ele não vê;
//   - sem devolver o foco ao fechar, quem abriu o modal por teclado volta
//     pro começo do documento em vez de pro botão que apertou.
//
// Os atributos ARIA ficam no JSX de cada casca (são marcação); o
// COMPORTAMENTO — focar ao abrir, prender o Tab, devolver ao fechar — mora
// aqui, porque as duas cascas precisam do mesmo e uma delas não passa pela
// outra.

// Ordem de tabulação dentro do painel. `[tabindex="-1"]` fica de fora de
// propósito: é justamente o que marca "focável por código, não por Tab", e
// é o que o próprio painel usa como alvo de fallback.
export const FOCUSABLE_SELECTOR =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),iframe,object,embed,[tabindex]:not([tabindex="-1"]),[contenteditable]';

function focusablesIn(panel: HTMLElement): HTMLElement[] {
  // `offsetParent === null` derruba o que está com `display:none` — item
  // escondido dentro do painel não deve receber Tab. (Não cobre
  // `visibility:hidden`, que o kit não usa pra esconder controle.)
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

/**
 * Gerência de foco de um diálogo modal.
 *
 * Devolve o `ref` pra pôr no PAINEL (não no overlay) e o `onKeyDown` que
 * prende o Tab. Junta o ref interno com o que o consumidor passou, porque
 * `Modal` encaminha o ref dele pro painel e isto não pode roubar esse
 * encaminhamento.
 */
export function useDialogFocus<T extends HTMLElement>(forwarded?: Ref<T> | null) {
  const panelRef = useRef<T | null>(null);

  function setPanel(el: T | null) {
    panelRef.current = el;
    if (typeof forwarded === "function") forwarded(el);
    else if (forwarded) (forwarded as MutableRefObject<T | null>).current = el;
  }

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const anterior = document.activeElement as HTMLElement | null;
    // Só move o foco se ele ainda não está DENTRO do painel: o FormulaModal
    // tem input com `autoFocus`, e o autofocus do React já rodou quando este
    // efeito dispara. Focar "o primeiro focável" aqui sem esta checagem
    // roubaria o foco do input pro botão de fechar.
    if (!panel.contains(document.activeElement)) {
      (focusablesIn(panel)[0] ?? panel).focus();
    }
    return () => {
      // `?.` duplo porque o elemento que tinha foco pode ter saído do DOM
      // enquanto o modal estava aberto.
      anterior?.focus?.();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const itens = focusablesIn(panel);
    if (itens.length === 0) {
      // Painel sem nada focável: Tab não tem pra onde ir e deixar vazar é
      // pior que não fazer nada.
      e.preventDefault();
      return;
    }
    const primeiro = itens[0];
    const ultimo = itens[itens.length - 1];
    const ativo = document.activeElement;
    if (e.shiftKey && (ativo === primeiro || ativo === panel)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && ativo === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  return { setPanel, onKeyDown };
}

/**
 * Escape fecha. Em hook próprio porque o `PdfPreviewModal` não passa pela
 * casca do `Modal` e não tinha Escape nenhum — era o único modal do pacote
 * que só fechava com clique.
 */
export function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
}
