import { useEffect, useRef, useState } from "react";
import type { PageSize } from "../types";
import { downloadPdf } from "../pdf/generate";
import { useT } from "../i18n";
import { PdfPreview } from "./PdfPreview";
import { Button } from "./ui";
import { IconDownload, IconX } from "./ui/icons";

// pt (ponto do PDF, o que pdf-lib usa) por mm — mesma conta de units.ts,
// duplicada aqui pra não puxar mmToPt só por causa disso (arquivo sem
// nenhuma outra dependência de units.ts).
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
  // Nome do arquivo ao baixar, sem ".pdf" — default vem do dicionário
  // (t.pdfPreviewModal.defaultFileName), respeitando o locale ativo.
  name?: string;
  onClose: () => void;
};

// Depois de gerar, mostra o PDF de verdade (pdf.js, canvas) antes de
// baixar — dá pra conferir margens/tamanho reais sem depender do viewer
// nativo do navegador. Zoom ajustado a partir do resize da JANELA — não
// um ResizeObserver no container: esse entra num loop de feedback com
// PdfPreview (que faz `container.innerHTML = ""` toda vez que `scale`
// muda) — 3+ páginas criam scroll vertical, o scroll encolhe o
// clientWidth, o observer recalcula scale, o innerHTML limpo faz o
// scroll sumir, o clientWidth volta a crescer, o observer dispara de
// novo, e o ciclo vira flicker infinito. O modal é 92vw×92vh: só muda de
// tamanho quando a JANELA redimensiona, nunca por causa do próprio
// conteúdo interno — então ouvir o resize da window já cobre 100% dos
// casos reais sem cair nesse loop. Múltiplas páginas rolam verticalmente,
// alinhadas ao topo — nunca corta o começo da primeira página pra
// "centralizar" o conjunto.
export default function PdfPreviewModal({ bytes, page, name, onClose }: Props) {
  const t = useT();
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
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[92vh] w-[92vw] max-w-5xl flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between rounded-t-xl border-b border-slate-200 px-5 py-3 dark:border-gray-700">
          <h3 className="text-base font-semibold text-slate-800 dark:text-gray-100">{t.pdfPreviewModal.title}</h3>
          <div className="flex gap-2">
            <Button onClick={() => downloadPdf(bytes, `${name ?? t.pdfPreviewModal.defaultFileName}.pdf`)}>
              <IconDownload /> {t.pdfPreviewModal.download}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <IconX />
            </Button>
          </div>
        </div>
        {/* items-center (não justify-center): centraliza a folha na
            horizontal só, alinhada ao topo na vertical — com várias
            páginas, rola pra baixo normal, sem cortar o topo da 1ª. */}
        <div
          ref={contentRef}
          className="flex flex-1 flex-col items-center overflow-y-auto rounded-b-xl bg-slate-100 p-4 dark:bg-gray-900"
        >
          {scale !== null && <PdfPreview bytes={bytes} scale={scale} />}
        </div>
      </div>
    </div>
  );
}
