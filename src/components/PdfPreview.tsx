import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { ensureWorker } from "../pdf/pdfWorker";
import { toErrorMessage } from "../errorUtils";
import { useT } from "../i18n";

type Props = {
  bytes: Uint8Array | null;
  // px por pt do PDF — 1 = tamanho real a 72dpi, ~1.33 ≈ 96dpi (escala de
  // tela padrão). Default deixa bem legível sem ficar gigante.
  scale?: number;
  className?: string;
};

// Renderiza o PDF gerado num <canvas> por página, com pdf.js — mostra o
// tamanho e as margens reais do arquivo exportado (não é o canvas de
// edição, é o PDF de verdade, byte a byte).
export function PdfPreview({ bytes, scale = 1.4, className = "" }: Props) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!bytes || !container) return;
    ensureWorker();

    let cancelled = false;
    container.innerHTML = "";
    setError(null);
    setPageCount(0);

    (async () => {
      try {
        const pdf = await pdfjsLib.getDocument({
          data: bytes.slice(),
          standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
        }).promise;
        if (cancelled) return;
        setPageCount(pdf.numPages);

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.display = "block";
          canvas.style.marginBottom = "16px";
          // Via token, pra o tema poder trocar. Note que este valor DIVERGE
          // da sombra do canvas do editor (0.15 aqui, 0.1 lá) — divergência
          // que já existia no 2.1.1 e ficou preservada de propósito:
          // unificar mudaria pixel.
          canvas.style.boxShadow = "var(--jpd-shadow-page-preview)";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          // Anexa antes de renderizar — alguns caminhos internos do pdf.js
          // esperam o canvas já no DOM (ex: leitura de layout/visibilidade).
          container.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          if (cancelled) return;
        }
      } catch (err) {
        if (!cancelled) setError(toErrorMessage(err, String));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bytes, scale]);

  if (!bytes) return null;
  if (error) return <p className="jpd-error jpd-error--md">{t.pdfPreview.renderError(error)}</p>;
  return (
    <div className={className}>
      {pageCount > 1 && <p className="jpd-preview__count">{t.pdfPreview.pageCount(pageCount)}</p>}
      <div ref={containerRef} />
    </div>
  );
}
