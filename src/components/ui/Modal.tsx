import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconX } from "./icons";

type Props = {
  title: string;
  onClose: () => void;
  // Rodapé opcional (botões de ação). Fica fixo embaixo, fora da área que
  // rola — em janela baixa, "Salvar" não pode ficar inalcançável.
  footer?: ReactNode;
  // Largura máxima do painel. Default cobre um formulário de duas colunas.
  maxWidthClass?: string;
  children: ReactNode;
};

// Casca de modal: fundo escurecido, clique fora fecha, Escape fecha,
// cabeçalho com título e "×".
//
// O `stopPropagation` no painel é o que faz "clique fora fecha" funcionar
// sem fechar a cada clique DENTRO do conteúdo. E o Escape mora aqui, não em
// cada modal, porque senão cada um implementaria (ou esqueceria) o seu.
//
// Vai pra um PORTAL em document.body, e não é detalhe de estilo: quem abre o
// modal costuma estar dentro de um elemento `draggable` (o chip de coluna da
// tabela é arrastável pra reordenar). Como filho dele, arrastar qualquer ponto
// do modal iniciava o drag HTML5 do chip — e selecionar texto no editor virava
// arrasto em vez de seleção. O portal também imuniza contra `overflow:hidden`
// e `transform` de ancestral, que quebram `position: fixed`.
//
// O PdfPreviewModal NÃO usa esta casca de propósito: a dele carrega o
// cálculo de zoom que ajusta a folha à janela, e trocar por esta genérica
// seria churn sem ganho nenhum.
export function Modal({ title, onClose, footer, maxWidthClass = "max-w-3xl", children }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // SSR (ou qualquer ambiente sem DOM): não há onde portar, e um modal não faz
  // sentido em HTML estático.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
      // Nada aqui dentro é arrastável. O portal já tira o modal de dentro do
      // elemento `draggable`, mas evento de React sobe pela árvore de REACT,
      // não pela do DOM — então o handler do chip ainda receberia um
      // dragstart daqui. Este preventDefault fecha essa porta.
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    >
      <div
        className={`flex max-h-[92vh] w-[92vw] ${maxWidthClass} flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-800`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between rounded-t-xl border-b border-slate-200 px-5 py-3 dark:border-gray-700">
          <h3 className="text-base font-semibold text-slate-800 dark:text-gray-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition-colors hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-100"
            aria-label={title}
          >
            <IconX />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex flex-shrink-0 items-center justify-end gap-2 rounded-b-xl border-t border-slate-200 px-5 py-3 dark:border-gray-700">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
