import { useEffect, useRef, useState } from "react";
import { I18nProvider, dictFor, downloadPdf } from "json-pdf-designer";
// PdfPreview (pdf.js's canvas) lives in the "/preview" entry — the optional
// peer pdfjs-dist, installed by this example because it uses the preview.
import { PdfPreview } from "json-pdf-designer/preview";
import type { Locale, PageSize } from "json-pdf-designer";

// pt (ponto do PDF, o que pdf-lib usa) por mm.
const MM_TO_PT = 72 / 25.4;
// Slack (px) subtracted from the available area before computing the fit —
// without it the sheet would touch the container's edge exactly.
const CONTENT_PADDING = 32;

type Props = {
  bytes: Uint8Array;
  // The real page size (mm) — the SAME `template.page` used in
  // generatePdf(template, ...) to produce these `bytes`. Needed to compute the
  // zoom that fits entirely inside the modal (see the useEffect below);
  // without it the sheet's proportions cannot be known in advance.
  page: PageSize;
  // The file name on download, without ".pdf".
  name?: string;
  // It serves TWO things: the <I18nProvider> around the <PdfPreview> (its
  // loading/error messages use useT(); outside a provider it would fall back
  // to the context default's fixed English) and this modal's shell labels —
  // which here all come from `dictFor`, see below.
  locale?: Locale;
  onClose: () => void;
};

// A local version of the package's PdfPreviewModal — the package exports a
// ready-made one, but this example's premise is that the whole shell is
// HTML/CSS from here. From the package only the <PdfPreview> comes in (the
// pdf.js canvas renderer, a low-level piece with no chrome of its own) and
// downloadPdf.
//
// The zoom is adjusted from the WINDOW resize — not from a ResizeObserver on
// the container: that one enters a feedback loop with PdfPreview (which does
// `container.innerHTML = ""` every time `scale` changes) — 3+ pages create a
// vertical scrollbar, the scrollbar shrinks clientWidth, the observer
// recomputes scale, the cleared innerHTML makes the scrollbar disappear,
// clientWidth grows back, the observer fires again, and the cycle becomes
// endless flicker. The modal is 92vw x 92vh: it only changes size when the
// WINDOW is resized, never because of its own inner content.
export default function PdfPreviewModal({ bytes, page, name, locale, onClose }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  // ZERO entries in our own dictionary: the title, "Download", the "x" and
  // the default file name are all concepts of THE PACKAGE — it exports a
  // ready-made PdfPreviewModal with exactly these labels
  // (`dict.pdfPreviewModal`, `dict.modal.close`). This example only rewrites
  // the modal's MARKUP; the vocabulary is still its, hence `dictFor`.
  const dict = dictFor(locale ?? "en");

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-preview" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 className="modal-title">{dict.pdfPreviewModal.title}</h3>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => downloadPdf(bytes, `${name ?? dict.pdfPreviewModal.defaultFileName}.pdf`)}
            >
              ⭳ {dict.pdfPreviewModal.download}
            </button>
            <button type="button" className="btn-icon" onClick={onClose} aria-label={dict.modal.close}>
              ×
            </button>
          </div>
        </div>
        {/* Centraliza a folha só na horizontal, alinhada ao topo na
            vertical — com várias páginas, rola pra baixo normal, sem
            cortar o topo da 1ª. */}
        <div ref={contentRef} className="modal-body preview-body">
          {scale !== null && (
            <I18nProvider locale={locale ?? "en"}>
              <PdfPreview bytes={bytes} scale={scale} />
            </I18nProvider>
          )}
        </div>
      </div>
    </div>
  );
}
