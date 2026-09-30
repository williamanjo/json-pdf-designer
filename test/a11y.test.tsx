import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { readFileSync } from "./support/read";
import { stripComments } from "./support/classScan";
import { ModalShell } from "../src/components/ui/Modal";
import { CardTitle } from "../src/components/ui/Card";

// ACCESSIBILITY — what 3.3.0 fixed, guarded against coming back.
//
// Three independent things live here:
//
//   1. The modal's dialog markup, which can be asserted without a DOM (that
//      is exactly why `ModalShell` exists separately from `Modal`).
//   2. SOURCE guards for operations that were mouse-only. Renaming a column,
//      renaming a field, selecting a field and hiding a tab existed only as
//      `onClick`/`onDoubleClick` on `<div>`/`<span>` with no tabIndex —
//      keyboard users could reach none of them. The guard looks at the source
//      because what matters is the ELEMENT TYPE, and a behavior test in jsdom
//      would pass with a `<div role="button">` that does not solve the
//      problem.
//   3. That the linter's a11y plugin stays on — it was its absence that let
//      25 warnings in without anyone seeing.

const RAIZ = join(__dirname, "..");
// WITH the comments stripped, always. These guards assert about the ELEMENT
// TYPE in the JSX, and this repo's comments deliberately quote the old code
// ("it used to be a <span role=\"button\">") — the first guard written here
// failed by matching exactly the comment that explained the fix.
const ler = (rel: string) => stripComments(readFileSync(join(RAIZ, rel), "utf8"));
// Without stripping comments — for .oxlintrc.json, where what matters is the
// configuration's text (and the reason written next to it).
const lerCru = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

const base = { title: "Editor de fórmula", onClose: () => {}, closeLabel: "Fechar" };

describe("a11y — o modal se anuncia como diálogo", () => {
  it("o painel leva role=dialog e aria-modal", () => {
    // Without both, a screen reader does not say that a dialog opened and
    // keeps offering the whole page behind the dimmed background.
    const html = renderToStaticMarkup(<ModalShell {...base}>x</ModalShell>);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it("o aria-labelledby aponta pro id do <h3> que está na tela", () => {
    // `aria-labelledby` instead of `aria-label={title}` precisely so the two
    // cannot diverge. The test checks that the REFERENCED id is the id the
    // heading actually has — an `aria-labelledby` pointing at nothing is worse
    // than none, because the dialog ends up with no name at all.
    const html = renderToStaticMarkup(<ModalShell {...base}>x</ModalShell>);
    const ref = html.match(/aria-labelledby="([^"]+)"/);
    expect(ref, "o painel saiu sem aria-labelledby").not.toBeNull();
    expect(html).toContain(`<h3 id="${ref![1]}"`);
  });

  it("o painel é focável por código, e não é parada de Tab", () => {
    // `tabIndex={-1}`: a panel with no focusable control inside still has to
    // receive focus (otherwise it stays on the document behind), but it must
    // not be a Tab stop of its own.
    expect(renderToStaticMarkup(<ModalShell {...base}>x</ModalShell>)).toContain('tabindex="-1"');
  });

  it("o overlay não finge ser controle", () => {
    // It closes on a click, which is a MOUSE shortcut — the keyboard path is
    // Escape and the "×". `role="presentation"` is what says so; a
    // `role="button"` there would be an invisible Tab stop.
    expect(renderToStaticMarkup(<ModalShell {...base}>x</ModalShell>)).toContain('role="presentation"');
  });

  it("todo modal do pacote carrega a marcação de diálogo", () => {
    // The `PdfPreviewModal` does NOT go through the `Modal` shell (its own
    // carries the zoom computation), so it had to receive all of this by hand
    // — and it was the only modal in the package that did not even close on
    // Escape. A source guard so a fourth modal is not born without any of it.
    const modais = ["src/components/ui/Modal.tsx", "src/components/PdfPreviewModal.tsx"];
    for (const rel of modais) {
      const fonte = ler(rel);
      expect(fonte, `${rel} sem role="dialog"`).toContain('role="dialog"');
      expect(fonte, `${rel} sem aria-modal`).toContain('aria-modal="true"');
      // Com o parênteses: `toContain("useEscapeToClose")` passava só pela
      // linha de IMPORT — apagar a CHAMADA e deixar o import não derrubava o
      // guard. Achado mutando o próprio guard.
      expect(fonte, `${rel} não CHAMA o focus trap compartilhado`).toMatch(/useDialogFocus[<(]/);
      expect(fonte, `${rel} não CHAMA useEscapeToClose`).toContain("useEscapeToClose(");
    }
  });

  it("o botão de fechar do preview tem nome acessível", () => {
    // Ele era um <svg> de "×" dentro de um botão sem aria-label nenhum:
    // leitor de tela anunciava só "button".
    expect(ler("src/components/PdfPreviewModal.tsx")).toContain("aria-label={t.modal.close}");
  });
});

describe("a11y — operação que era só-mouse agora tem botão", () => {
  it("renomear coluna de tabela tem botão, não só duplo clique", () => {
    // A 3.2.0 removeu o campo "Colunas (cabeçalho, vírgula)", que era a ÚNICA
    // via por teclado pra renomear coluna, e deixou só o duplo clique num
    // <span>. Isto é a regressão que o botão de lápis desfaz.
    const fonte = ler("src/components/PropertyPanel/PropertyPanelTable.tsx");
    expect(fonte).toContain("IconPencil");
    expect(fonte, "o rename da coluna voltou a depender só de duplo clique").toMatch(
      /<button[\s\S]{0,400}renameColumnAria/
    );
  });

  it("renomear campo tem botão na lista", () => {
    const fonte = ler("src/components/FieldList.tsx");
    expect(fonte).toContain("IconPencil");
    expect(fonte).toMatch(/<Button[\s\S]{0,300}renameAria/);
  });

  it("selecionar campo é um <button>, não um <div> clicável", () => {
    // Era a única forma de selecionar campo, e vivia num `onClick` de <div>:
    // quem navega por teclado não conseguia selecionar campo NENHUM.
    const fonte = ler("src/components/FieldList.tsx");
    expect(fonte, "o nome do campo voltou a ser <span>").toMatch(/<button[\s\S]{0,300}className="jpd-rowname"/);
    expect(fonte).toContain("aria-pressed={isSelected}");
  });

  it("esconder aba é um <button> irmão, não um role=button aninhado", () => {
    // Era `<span role="button">` DENTRO do `<button className="jpd-tab">`:
    // interativo aninhado (HTML inválido) e sem tabIndex, então a operação
    // só existia no mouse. Foi a regra `interactive-supports-focus` que
    // pegou, e é por isso que ela fica como ERRO no .oxlintrc.json.
    const fonte = ler("src/designer/parts/DesignerTabBar.tsx");
    expect(fonte, 'o "x" da aba voltou a ser um span com role=button').not.toMatch(
      /<span\s+role="button"/
    );
    expect(fonte).toContain('className="jpd-tab__slot"');
  });

  it("CardTitle passa children explícito, pra a regra de heading valer", () => {
    // Com `<h3 {...rest} />` o `heading-has-content` não vê conteúdo e acusa
    // cabeçalho vazio em TODO CardTitle. Desestruturar mantém a regra ligada.
    expect(renderToStaticMarkup(<CardTitle>Relatório</CardTitle>)).toContain(">Relatório</h3>");
  });
});

describe("a11y — o linter continua guardando isto", () => {
  const config = lerCru(".oxlintrc.json");

  it("o plugin jsx-a11y está ligado", () => {
    // Ele simplesmente não estava na lista de `plugins`, e foi por isso que
    // 25 avisos entraram sem ninguém ver.
    expect(config).toMatch(/"plugins"\s*:\s*\[[^\]]*"jsx-a11y"/);
  });

  it("as regras que pegam bug real são ERRO, não aviso", () => {
    // `interactive-supports-focus` é a que pegou o "x" da barra de abas.
    // As outras cobrem ARIA inventado e rótulo sem controle.
    for (const regra of [
      "interactive-supports-focus",
      "aria-props",
      "aria-role",
      "role-has-required-aria-props",
      "label-has-associated-control",
      "no-noninteractive-tabindex",
      "alt-text",
    ]) {
      expect(config, `${regra} deixou de ser erro`).toContain(`"jsx-a11y/${regra}": "error"`);
    }
  });

  it("controle: as regras desligadas estão desligadas EXPLICITAMENTE", () => {
    // Sem isto o teste acima passaria num arquivo que simplesmente não
    // menciona as três — o ponto é que a decisão esteja escrita, com o motivo
    // ao lado (ver o comentário no .oxlintrc.json).
    for (const regra of ["click-events-have-key-events", "no-static-element-interactions"]) {
      expect(config).toContain(`"jsx-a11y/${regra}": "off"`);
    }
  });
});
