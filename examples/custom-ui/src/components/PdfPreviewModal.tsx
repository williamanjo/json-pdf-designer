import { useEffect, useRef, useState } from "react";
import { I18nProvider, downloadPdf } from "json-pdf-designer";
// PdfPreview (canvas do pdf.js) mora no entry "/preview" — peer opcional
// pdfjs-dist, instalado por este example porque ele usa o preview.
import { PdfPreview } from "json-pdf-designer/preview";
import type { Locale, PageSize } from "json-pdf-designer";

// pt (ponto do PDF, o que pdf-lib usa) por mm.
const MM_TO_PT = 72 / 25.4;
// Folga (px) descontada da área disponível antes de calcular o fit — sem
// isso a folha encostaria exatamente na borda do container.
const CONTENT_PADDING = 32;

type Props = {
  bytes: Uint8Array;
  // Tamanho real da página (mm) — o MESMO `template.page` usado em
  // generatePdf(template, ...) pra gerar esses `bytes`. Necessário pra
  // calcular o zoom que cabe inteiro no modal (ver useEffect abaixo);
  // sem isso não dá pra saber a proporção da folha de antemão.
  page: PageSize;
  // Nome do arquivo ao baixar, sem ".pdf".
  name?: string;
  // Só pro <PdfPreview> (mensagens de carregando/erro dele usam useT());
  // fora de um I18nProvider ele cairia no inglês fixo do default do
  // contexto, ignorando o idioma escolhido no header.
  locale?: Locale;
  onClose: () => void;
};

// Versão local do PdfPreviewModal do pacote — o pacote exporta um pronto,
// mas a premissa deste example é que a casca inteira seja HTML/CSS daqui.
// Do pacote só entra o <PdfPreview> (renderizador pdf.js em canvas, peça
// de baixo nível sem chrome próprio) e o downloadPdf.
//
// Zoom ajustado a partir do resize da JANELA — não um ResizeObserver no
// container: esse entra num loop de feedback com PdfPreview (que faz
// `container.innerHTML = ""` toda vez que `scale` muda) — 3+ páginas criam
// scroll vertical, o scroll encolhe o clientWidth, o observer recalcula
// scale, o innerHTML limpo faz o scroll sumir, o clientWidth volta a
// crescer, o observer dispara de novo, e o ciclo vira flicker infinito. O
// modal é 92vw×92vh: só muda de tamanho quando a JANELA redimensiona,
// nunca por causa do próprio conteúdo interno.
export default function PdfPreviewModal({ bytes, page, name, locale, onClose }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

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
          <h3 className="modal-title">Pré-visualização do PDF</h3>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={() => downloadPdf(bytes, `${name ?? "relatorio"}.pdf`)}>
              ⭳ Baixar
            </button>
            <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar">
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
