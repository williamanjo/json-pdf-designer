import { forwardRef, useEffect, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx, readPart, type PartStyle } from "./cx";
import { IconX } from "./icons";
import { useT } from "../../i18n";

export type ModalProps = Omit<HTMLAttributes<HTMLDivElement>, "title" | "children"> & {
  title: string;
  onClose: () => void;
  // Rodapé opcional (botões de ação). Fica fixo embaixo, fora da área que
  // rola — em janela baixa, "Salvar" não pode ficar inalcançável.
  footer?: ReactNode;
  /**
   * Largura máxima do painel. `"lg"` (48rem) é o default e é exatamente o que
   * o antigo `maxWidthClass="max-w-3xl"` dava.
   *
   * BREAKING em 3.0.0: substitui `maxWidthClass`, que era uma string de
   * classe TAILWIND na API pública de um pacote que não envia mais Tailwind.
   * Largura arbitrária agora é `style={{ maxWidth: 900 }}`, que chega no
   * painel porque `className`/`style` vão pro elemento que dá nome ao
   * componente — e o nome aqui é o PAINEL, não o fundo escurecido.
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

// Só a MARCAÇÃO do modal, sem portal e sem Escape.
//
// Existe separado por testabilidade, não por gosto: sob
// `renderToStaticMarkup` não há `document`, então o `Modal` inteiro devolve
// `null` e nenhuma asserção sobre o markup dele seria possível. O modal é o
// componente com mais `parts` do kit (overlay/header/title/body/footer), e
// era o único cuja superfície de `parts` ficaria sem teste.
export const ModalShell = forwardRef<HTMLDivElement, ShellProps>(function ModalShell(
  { title, onClose, footer, size = "lg", className, style, parts, closeLabel, children, ...rest },
  ref
) {
  const overlay = readPart(parts?.overlay);
  const header = readPart(parts?.header);
  const titlePart = readPart(parts?.title);
  const body = readPart(parts?.body);
  const footerPart = readPart(parts?.footer);

  return (
    <div
      className={cx("jpd-modal", overlay.className)}
      style={overlay.style}
      onClick={onClose}
      // Nada aqui dentro é arrastável. O portal já tira o modal de dentro do
      // elemento `draggable`, mas evento de React sobe pela árvore de REACT,
      // não pela do DOM — então o handler do chip ainda receberia um
      // dragstart daqui. Este preventDefault fecha essa porta.
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
    >
      <div
        ref={ref}
        {...rest}
        data-size={size}
        className={cx("jpd-modal__panel", className)}
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cx("jpd-modal__header", header.className)} style={header.style}>
          <h3 className={cx("jpd-modal__title", titlePart.className)} style={titlePart.style}>
            {title}
          </h3>
          {/* `aria-label` era o TÍTULO DO DIÁLOGO, então leitor de tela
              anunciava "Editor de fórmula" como nome do botão que fecha o
              editor de fórmula. Agora tem nome próprio, traduzido. */}
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
// CUIDADO COM TEMA: por render em portal no body, uma ilha de
// `data-jpd-theme` escopada num wrapper NÃO alcança este modal. Pra tema
// escuro valer aqui, o atributo tem de estar no <html>.
//
// O PdfPreviewModal NÃO usa esta casca de propósito: a dele carrega o
// cálculo de zoom que ajusta a folha à janela. Mas usa as MESMAS classes
// `jpd-modal*` — três strings dele eram byte-idênticas às daqui.
export const Modal = forwardRef<HTMLDivElement, ModalProps>(function Modal(props, ref) {
  const t = useT();
  const { onClose } = props;

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

  return createPortal(<ModalShell ref={ref} {...props} closeLabel={t.modal.close} />, document.body);
});

