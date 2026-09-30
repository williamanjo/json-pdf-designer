import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModalShell } from "../../../src/components/ui/Modal";

// The modal's shell, tested without a DOM.
//
// The full `<Modal>` returns `null` when there is no `document` (it portals to
// the body), so without separating the shell none of its markup would be
// testable — and it is the component with the most parts in the kit.

const base = { title: "Editor de fórmula", onClose: () => {}, closeLabel: "Fechar" };

describe("ModalShell", () => {
  it("size vira data-size, e o default é o que o maxWidthClass antigo dava", () => {
    // `lg` = 48rem = the old `max-w-3xl`. If the default changes, every modal
    // in the editor changes width at once.
    expect(renderToStaticMarkup(<ModalShell {...base}>x</ModalShell>)).toContain('data-size="lg"');
    expect(renderToStaticMarkup(<ModalShell {...base} size="sm">x</ModalShell>)).toContain('data-size="sm"');
    expect(renderToStaticMarkup(<ModalShell {...base} size="full">x</ModalShell>)).toContain('data-size="full"');
  });

  it("o nome acessível do botão de fechar é o rótulo de fechar, NÃO o título do diálogo", () => {
    // It used to be `aria-label={title}`: a screen reader announced "Formula
    // editor" as the name of the button that closes the formula editor. It is
    // the accessibility bug 3.0.0 fixes, and it is easy to reintroduce by
    // copying the old pattern.
    const html = renderToStaticMarkup(<ModalShell {...base}>x</ModalShell>);
    expect(html).toContain('aria-label="Fechar"');
    expect(html, "o aria-label voltou a ser o título do diálogo").not.toContain(`aria-label="${base.title}"`);
  });

  it("o rodapé fica FORA da área que rola", () => {
    // In a short window, "Save" must not be unreachable — the footer is a
    // sibling of the body, not its child.
    const html = renderToStaticMarkup(
      <ModalShell {...base} footer={<button type="button">Salvar</button>}>
        conteudo
      </ModalShell>
    );
    const corpoFim = html.indexOf("</div>", html.indexOf("jpd-modal__body"));
    const rodapeInicio = html.indexOf("jpd-modal__footer");
    expect(rodapeInicio).toBeGreaterThan(corpoFim);
  });

  it("sem footer, não renderiza o rodapé", () => {
    expect(renderToStaticMarkup(<ModalShell {...base}>x</ModalShell>)).not.toContain("jpd-modal__footer");
  });

  it("o painel não é arrastável, e o fundo bloqueia dragstart", () => {
    // The portal lifts the modal out of the `draggable` element, but a React
    // event bubbles up the REACT tree, not the DOM one — without the
    // `draggable={false}` on the overlay, dragging inside the modal still
    // started the drag of the column chip that opened it.
    const html = renderToStaticMarkup(<ModalShell {...base}>x</ModalShell>);
    expect(html).toContain('draggable="false"');
  });
});
