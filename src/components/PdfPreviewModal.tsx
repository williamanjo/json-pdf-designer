import { useEffect, useId, useRef, useState } from "react";
import type { PageSize } from "../types";
import { downloadPdf } from "../pdf/generate";
import { useT } from "../i18n";
import { PdfPreview } from "./PdfPreview";
import { useUiComponents } from "./ui/useUiComponents";
import { IconDownload, IconX } from "./ui/icons";
import { useDialogFocus, useEscapeToClose } from "./ui/useDialogA11y";

// pt (the PDF point, what pdf-lib uses) per mm — the same arithmetic as
// units.ts, duplicated here so mmToPt is not pulled in just for this
// (a file with no other dependency on units.ts).
const MM_TO_PT = 72 / 25.4;
// Slack (px) subtracted from the available area before computing the fit —
// without it the sheet would touch the container's edge exactly.
const CONTENT_PADDING = 32;

type Props = {
  bytes: Uint8Array;
  // Real page size (mm) — the SAME `template.page` used in
  // generatePdf(template, ...) to produce these `bytes`. Needed to compute
  // the zoom that fits entirely inside the modal (see the useEffect below);
  // without it the sheet's proportions cannot be known in advance.
  page: PageSize;
  // File name on download, without ".pdf" — the default comes from the
  // dictionary (t.pdfPreviewModal.defaultFileName), honoring the active locale.
  name?: string;
  onClose: () => void;
};

// After generating, it shows the real PDF (pdf.js, canvas) before
// downloading — real margins/size can be checked without depending on the
// browser's native viewer. Zoom is adjusted from the WINDOW resize — not
// from a ResizeObserver on the container: that one enters a feedback loop
// with PdfPreview (which does `container.innerHTML = ""` every time
// `scale` changes) — 3+ pages create a vertical scrollbar, the scrollbar
// shrinks clientWidth, the observer recomputes scale, the cleared
// innerHTML makes the scrollbar disappear, clientWidth grows back, the
// observer fires again, and the cycle becomes endless flicker. The modal
// is 92vw×92vh: it only changes size when the WINDOW is resized, never
// because of its own inner content — so listening to the window resize
// already covers 100% of the real cases without falling into that loop.
// Multiple pages scroll vertically, aligned to the top — it never cuts
// off the start of the first page to "center" the set.
export default function PdfPreviewModal({ bytes, page, name, onClose }: Props) {
  const t = useT();
  const { Button } = useUiComponents();
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const titleId = useId();
  // This modal does not go through the <Modal> shell, so Escape and the focus
  // trap come straight from the hooks. Before this it was the only modal in
  // the package that did NOT close on Escape.
  useEscapeToClose(onClose);
  const { setPanel, onKeyDown } = useDialogFocus<HTMLDivElement>();

  const pageWidthPt = page.width * MM_TO_PT;
  const pageHeightPt = page.height * MM_TO_PT;

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    function update() {
      const availableWidth = el!.clientWidth - CONTENT_PADDING;
      const availableHeight = el!.clientHeight - CONTENT_PADDING;
      if (availableWidth > 0 && availableHeight > 0) {
        setScale(Math.min(availableWidth / pageWidthPt, availableHeight / pageHeightPt));
      }
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [pageWidthPt, pageHeightPt]);

  return (
    // `role="presentation"` on the overlay for the same reason as <Modal>: it
    // is decoration plus a mouse shortcut, and the keyboard path is Escape
    // (above) and the "×" in the header — not an invisible Tab stop.
    <div className="jpd-modal" onClick={onClose} role="presentation">
      {/* Same classes as the generic <Modal> — three of these strings were
          byte-identical to its own. The difference is `data-fill`: here the
          height is FIXED (92vh), not a maximum, because the scale computation
          above measures the container's `clientHeight` and needs it filled. */}
      <div
        ref={setPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-size="xl"
        data-fill
        className="jpd-modal__panel"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- see below
        // The `stopPropagation` STAYS, and the a11y warning here is accepted
        // with eyes open. Swapping it for "the overlay decides by target"
        // looks equivalent and is not: this modal lives in a PORTAL, and a
        // React event bubbles up the REACT tree, not the DOM one — without
        // the stopPropagation, a click inside the modal reaches the handlers
        // of the element that OPENED it (same reasoning as <Modal>, see there).
        // It is the same reason as the `onDragStart` on the overlay. A dialog
        // with nothing clickable of its own is the spirit of the rule; here
        // the handler exists only to CONTAIN an event, not to react to a click.
        onClick={(e) => e.stopPropagation()}
      >
        <div className="jpd-modal__header">
          <h3 id={titleId} className="jpd-modal__title">{t.pdfPreviewModal.title}</h3>
          <div className="jpd-row">
            <Button onClick={() => downloadPdf(bytes, `${name ?? t.pdfPreviewModal.defaultFileName}.pdf`)}>
              <IconDownload /> {t.pdfPreviewModal.download}
            </Button>
            {/* Este botão saía SEM nome acessível nenhum: só um <svg> de "×"
                dentro. Leitor de tela anunciava "button", sem dizer o que
                ele faz. Usa a mesma string do "×" da casca do Modal. */}
            <Button variant="ghost" size="icon" onClick={onClose} aria-label={t.modal.close}>
              <IconX />
            </Button>
          </div>
        </div>
        {/* items-center (não justify-center): centraliza a folha na
            horizontal só, alinhada ao topo na vertical — com várias
            páginas, rola pra baixo normal, sem cortar o topo da 1ª. */}
        <div ref={contentRef} className="jpd-preview__well">
          {scale !== null && <PdfPreview bytes={bytes} scale={scale} />}
        </div>
      </div>
    </div>
  );
}
