import { useEffect, useRef, type MutableRefObject, type Ref } from "react";

// WHAT MAKES AN OVERLAY A DIALOG, in one place.
//
// Before this 3.3.0 the package's three modals (Modal/ModalShell, the
// FormulaModal that uses it, and the PdfPreviewModal with its own markup)
// were `<div>`s with a dimmed background. That is enough for the eye and not
// enough for the rest:
//
//   - with no `role="dialog"` + `aria-modal`, a screen reader does not
//     announce that a dialog opened, and keeps reading the ENTIRE page behind
//     the overlay as if it were available;
//   - without trapping Tab, the third Tab leaves the modal and focuses a
//     button that is visually behind a dark background — the user "loses"
//     focus in an area they cannot see;
//   - without returning focus on close, whoever opened the modal by keyboard
//     lands back at the start of the document instead of on the button.
//
// The ARIA attributes live in each shell's JSX (they are markup); the
// BEHAVIOR — focus on open, trap Tab, return on close — lives here, because
// both shells need the same one and one of them does not go through the
// other.

// Tab order inside the panel. `[tabindex="-1"]` is deliberately left out:
// that is precisely what marks "focusable by code, not by Tab", and it is
// what the panel itself uses as its fallback target.
export const FOCUSABLE_SELECTOR =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),iframe,object,embed,[tabindex]:not([tabindex="-1"]),[contenteditable]';

function focusablesIn(panel: HTMLElement): HTMLElement[] {
  // `offsetParent === null` drops whatever is `display:none` — a hidden item
  // inside the panel must not receive Tab. (It does not cover
  // `visibility:hidden`, which the kit does not use to hide a control.)
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

/**
 * Focus management for a modal dialog.
 *
 * Returns the `ref` to put on the PANEL (not on the overlay) and the
 * `onKeyDown` that traps Tab. It merges the internal ref with the one the
 * consumer passed, because `Modal` forwards its ref to the panel and this
 * must not steal that forwarding.
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
    // It only moves focus if focus is not already INSIDE the panel: the
    // FormulaModal has an input with `autoFocus`, and React's autofocus has
    // already run by the time this effect fires. Focusing "the first
    // focusable" here without this check would steal focus to the close button.
    if (!panel.contains(document.activeElement)) {
      (focusablesIn(panel)[0] ?? panel).focus();
    }
    return () => {
      // A double `?.` because the element that had focus may have left the DOM
      // while the modal was open.
      anterior?.focus?.();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const itens = focusablesIn(panel);
    if (itens.length === 0) {
      // A panel with nothing focusable: Tab has nowhere to go, and letting it
      // leak out is worse than doing nothing.
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
 * Escape closes. In a hook of its own because `PdfPreviewModal` does not go
 * through the `Modal` shell and had no Escape at all — it was the only modal
 * in the package that closed on a click only.
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
