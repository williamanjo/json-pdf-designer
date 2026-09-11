import { useEffect, useId, useRef, useState } from "react";
import type { PageSize } from "../types";
import { downloadPdf } from "../pdf/generate";
import { useT } from "../i18n";
import { PdfPreview } from "./PdfPreview";
import { useUiComponents } from "./ui/useUiComponents";
import { IconDownload, IconX } from "./ui/icons";
import { useDialogFocus, useEscapeToClose } from "./ui/useDialogA11y";

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
  const { Button } = useUiComponents();
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const titleId = useId();
  // Este modal não passa pela casca do <Modal>, então Escape e foco preso
  // vêm dos hooks direto. Antes disto ele era o único modal do pacote que
  // NÃO fechava com Escape.
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
    // `role="presentation"` no overlay pelo mesmo motivo do <Modal>: é
    // decoração mais atalho de mouse, e o caminho por teclado é o Escape
    // (acima) e o "×" do cabeçalho — não uma parada de Tab invisível.
    <div className="jpd-modal" onClick={onClose} role="presentation">
      {/* Mesmas classes do <Modal> genérico — três destas strings eram
          byte-idênticas às dele. A diferença é `data-fill`: aqui a altura é
          FIXA (92vh), não máxima, porque o cálculo de escala acima mede
          `clientHeight` do container e precisa dele preenchido. */}
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
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- ver abaixo
        // O `stopPropagation` FICA, e o aviso de a11y aqui é aceito de olho
        // aberto. Trocar por "o overlay decide pelo alvo" parece equivalente e
        // não é: este modal vive num PORTAL, e evento de React sobe pela
        // árvore de REACT, não pela do DOM — sem o stopPropagation, clique
        // dentro do modal chega nos handlers do elemento que ABRIU o modal
        // (mesmo raciocínio do <Modal>, ver lá).
        // É o mesmo motivo do `onDragStart` no overlay. Um diálogo sem nada
        // clicável próprio é o espírito da regra; aqui o handler existe só pra
        // CONTER evento, não pra reagir a clique.
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
