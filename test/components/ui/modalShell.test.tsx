import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ModalShell } from "../../../src/components/ui/Modal";

// A casca do modal, testada sem DOM.
//
// O `<Modal>` completo devolve `null` quando não existe `document` (ele porta
// pro body), então sem separar a casca nada do markup dele seria testável —
// e é o componente com mais partes do kit.

const base = { title: "Editor de fórmula", onClose: () => {}, closeLabel: "Fechar" };

describe("ModalShell", () => {
  it("size vira data-size, e o default é o que o maxWidthClass antigo dava", () => {
    // `lg` = 48rem = o antigo `max-w-3xl`. Se o default mudar, todo modal do
    // editor muda de largura de uma vez.
    expect(renderToStaticMarkup(<ModalShell {...base}>x</ModalShell>)).toContain('data-size="lg"');
    expect(renderToStaticMarkup(<ModalShell {...base} size="sm">x</ModalShell>)).toContain('data-size="sm"');
    expect(renderToStaticMarkup(<ModalShell {...base} size="full">x</ModalShell>)).toContain('data-size="full"');
  });

  it("o nome acessível do botão de fechar é o rótulo de fechar, NÃO o título do diálogo", () => {
    // Era `aria-label={title}`: leitor de tela anunciava "Editor de fórmula"
    // como nome do botão que fecha o editor de fórmula. É o bug de
    // acessibilidade que a 3.0.0 conserta, e é fácil de reintroduzir copiando
    // o padrão antigo.
    const html = renderToStaticMarkup(<ModalShell {...base}>x</ModalShell>);
    expect(html).toContain('aria-label="Fechar"');
    expect(html, "o aria-label voltou a ser o título do diálogo").not.toContain(`aria-label="${base.title}"`);
  });

  it("o rodapé fica FORA da área que rola", () => {
    // Em janela baixa, "Salvar" não pode ficar inalcançável — o rodapé é
    // irmão do corpo, não filho dele.
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
    // O portal tira o modal de dentro do elemento `draggable`, mas evento de
    // React sobe pela árvore de REACT, não pela do DOM — sem o
    // `draggable={false}` no fundo, arrastar dentro do modal ainda iniciava
    // o drag do chip de coluna que o abriu.
    const html = renderToStaticMarkup(<ModalShell {...base}>x</ModalShell>);
    expect(html).toContain('draggable="false"');
  });
});
