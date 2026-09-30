import { forwardRef, useId, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx, readPart, type PartStyle } from "./cx";
import { useDialogFocus, useEscapeToClose } from "./useDialogA11y";
import { IconX } from "./icons";
import { useT } from "../../i18n";

export type ModalProps = Omit<HTMLAttributes<HTMLDivElement>, "title" | "children"> & {
  title: string;
  onClose: () => void;
  // Optional footer (action buttons). It stays pinned at the bottom, outside
  // the scrolling area — in a short window, "Save" cannot be unreachable.
  footer?: ReactNode;
  /**
   * Maximum panel width. `"lg"` (48rem) is the default and is exactly what the
   * old `maxWidthClass="max-w-3xl"` gave.
   *
   * BREAKING in 3.0.0: it replaces `maxWidthClass`, a TAILWIND class string in
   * the public API of a package that no longer ships Tailwind. An arbitrary
   * width is now `style={{ maxWidth: 900 }}`, which reaches the panel because
   * `className`/`style` go to the element that names the component — and the
   * named element here is the PANEL, not the dimmed background.
   */
  size?: "sm" | "md" | "lg" | "xl" | "full";
  parts?: {
    overlay?: PartStyle;
    header?: PartStyle;
    title?: PartStyle;
    body?: PartStyle;
    footer?: PartStyle;
  };
  children: ReactNode;
};

type ShellProps = ModalProps & { closeLabel: string };

// The modal's MARKUP only, with no portal and no Escape.
//
// It exists separately for testability, not for taste: under
// `renderToStaticMarkup` there is no `document`, so the whole `Modal` returns
// `null` and no assertion about its markup would be possible. The modal is
// the component with the most `parts` in the kit (overlay/header/title/body/
// footer), and it was the only one whose `parts` surface went untested.
export const ModalShell = forwardRef<HTMLDivElement, ShellProps>(function ModalShell(
  { title, onClose, footer, size = "lg", className, style, parts, closeLabel, children, ...rest },
  ref
) {
  const overlay = readPart(parts?.overlay);
  const header = readPart(parts?.header);
  const titlePart = readPart(parts?.title);
  const body = readPart(parts?.body);
  const footerPart = readPart(parts?.footer);
  // `aria-labelledby` instead of `aria-label={title}`: the title is already
  // on screen in the <h3>, and pointing at it keeps the two in sync by itself.
  const titleId = useId();
  const { setPanel, onKeyDown } = useDialogFocus<HTMLDivElement>(ref);

  return (
    <div
      className={cx("jpd-modal", overlay.className)}
      style={overlay.style}
      onClick={onClose}
      // The overlay is decoration + a mouse shortcut. It deliberately gets no
      // `role="button"` and no tabIndex: that would be an invisible Tab stop,
      // and the keyboard equivalent already exists in two better places —
      // Escape (see the hook) and the "×" in the header.
      role="presentation"
      // Nothing in here is draggable. The portal already lifts the modal out of
      // the `draggable` element, but a React event bubbles up the REACT tree,
      // not the DOM one — so the chip's handler would still receive a
      // dragstart from here. This preventDefault closes that door.
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    >
      <div
        ref={setPanel}
        {...rest}
        // `role="dialog"` + `aria-modal` is what makes a screen reader announce
        // "dialog" and stop offering the page behind it. `tabIndex={-1}` is a
        // FALLBACK focus target: a panel with no focusable control still has
        // to receive focus, otherwise it stays on the document behind.
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-size={size}
        className={cx("jpd-modal__panel", className)}
        style={style}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- see below
        // The `stopPropagation` STAYS, and the a11y warning here is accepted
        // with eyes open. Swapping it for "the overlay decides by target"
        // looks equivalent and is not: this modal lives in a PORTAL, and a
        // React event bubbles up the REACT tree, not the DOM one — without
        // the stopPropagation, a click inside the modal reaches the handlers
        // of the element that OPENED it (the draggable column chip, see the
        // portal comment below). It is the same reason as the `onDragStart`
        // on the overlay. A dialog with nothing clickable of its own is the
        // spirit of the rule; here the handler only CONTAINS an event.
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cx("jpd-modal__header", header.className)} style={header.style}>
          <h3 id={titleId} className={cx("jpd-modal__title", titlePart.className)} style={titlePart.style}>
            {title}
          </h3>
          {/* `aria-label` was the DIALOG TITLE, so a screen reader announced
              "Formula editor" as the name of the button that closes the
              formula editor. Now it has a name of its own, translated. */}
          <button type="button" onClick={onClose} className="jpd-iconbtn" aria-label={closeLabel}>
            <IconX />
          </button>
        </div>

        <div className={cx("jpd-modal__body", body.className)} style={body.style}>
          {children}
        </div>

        {footer && (
          <div className={cx("jpd-modal__footer", footerPart.className)} style={footerPart.style}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
});

// Modal shell: dimmed background, click outside closes, Escape closes, header.
//
// The `stopPropagation` on the panel is what makes "click outside closes"
// work without closing on every click INSIDE the content. And Escape lives
// here, not in each modal, because otherwise each would forget its own.
//
// It goes into a PORTAL on document.body, and that is not a styling detail:
// whoever opens the modal is usually inside a `draggable` element (the table
// column chip is draggable for reordering). As its child, dragging anywhere
// in the modal started the chip's HTML5 drag — and selecting text in the
// editor became a drag instead of a selection. The portal also immunizes
// against an ancestor's `overflow:hidden` and `transform`, which break
// `position: fixed`.
//
// CAREFUL WITH THEMING: because it renders through a portal on the body, an
// island of `data-jpd-theme` scoped to a wrapper does NOT reach this modal.
// For a dark theme to apply here, the attribute has to be on the <html>.
//
// PdfPreviewModal deliberately does NOT use this shell: its own carries the
// zoom computation that fits the sheet to the window. But it uses the SAME
// `jpd-modal*` classes — three of its strings were byte-identical to these.
export const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal(props, ref) {
  const t = useT();
  const { onClose } = props;

  useEscapeToClose(onClose);

  // SSR (or any environment with no DOM): there is nowhere to portal to, and a
  // modal makes no sense in static HTML.
  if (typeof document === "undefined") return null;

  return createPortal(<ModalShell ref={ref} {...props} closeLabel={t.modal.close} />, document.body);
});

