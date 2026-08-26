import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { ensureWorker } from "../pdf/pdfWorker";
import { toErrorMessage } from "../errorUtils";

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
          canvas.style.boxShadow = "0 1px 3px rgba(0,0,0,0.15), 0 8px 24px rgba(15,23,42,0.08)";
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
  if (error) return <p className="text-xs text-red-600">Erro ao renderizar preview: {error}</p>;
  return (
    <div className={className}>
      {pageCount > 1 && <p className="mb-2 text-[11px] text-slate-500">{pageCount} página(s)</p>}
      <div ref={containerRef} />
    </div>
  );
}
