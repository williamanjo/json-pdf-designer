import { PdfPreview } from "./PdfPreview";
import { Button } from "./ui";
import { IconDownload, IconX } from "./ui/icons";

type Props = {
  bytes: Uint8Array;
  onClose: () => void;
  onDownload: () => void;
};

// Depois de gerar, mostra o PDF de verdade (pdf.js, canvas) antes de
// baixar — dá pra conferir margens/tamanho reais sem depender do viewer
// nativo do navegador.
export default function PdfPreviewModal({ bytes, onClose, onDownload }: Props) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-64px)] w-[min(760px,100%)] flex-col rounded-xl bg-white p-4 shadow-2xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800 dark:text-gray-100">Prévia do PDF</h3>
          <div className="flex gap-2">
            <Button onClick={onDownload}>
              <IconDownload /> Baixar
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <IconX />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex-1 overflow-auto rounded-lg bg-slate-100 p-4 dark:bg-gray-900">
          <PdfPreview bytes={bytes} />
        </div>
      </div>
    </div>
  );
}
