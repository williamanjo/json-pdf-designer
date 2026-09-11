import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { readFileSync } from "./support/read";
import { stripComments } from "./support/classScan";
import { ModalShell } from "../src/components/ui/Modal";
import { CardTitle } from "../src/components/ui/Card";

// ACESSIBILIDADE — o que a 3.3.0 consertou, guardado contra volta.
//
// Três coisas independentes moram aqui:
//
//   1. A marcação de diálogo do modal, que dá pra afirmar sem DOM (é
//      exatamente por isso que `ModalShell` existe separado do `Modal`).
//   2. Guards de FONTE pra operação que era só-mouse. Renomear coluna,
//      renomear campo, selecionar campo e esconder aba existiam apenas como
//      `onClick`/`onDoubleClick` em `<div>`/`<span>` sem tabIndex — quem
//      navega por teclado não alcançava nenhuma delas. O guard olha a fonte
//      porque o que importa é o TIPO DE ELEMENTO, e um teste de
//      comportamento em jsdom passaria com um `<div role="button">` que não
//      resolve o problema.
//   3. Que o plugin de a11y do linter continue ligado — foi a ausência dele
//      que deixou 25 avisos entrarem sem ninguém ver.

const RAIZ = join(__dirname, "..");
// COM os comentários removidos, sempre. Estes guards afirmam sobre o TIPO DE
// ELEMENTO no JSX, e os comentários deste repo citam o código antigo de
// propósito ("era um <span role=\"button\">") — o primeiro guard escrito aqui
// falhou casando exatamente o comentário que explicava a correção.
const ler = (rel: string) => stripComments(readFileSync(join(RAIZ, rel), "utf8"));
// Sem tirar comentário — pro .oxlintrc.json, onde o que interessa é o texto
// da configuração (e o motivo escrito ao lado dela).
const lerCru = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

const base = { title: "Editor de fórmula", onClose: () => {}, closeLabel: "Fechar" };

describe("a11y — o modal se anuncia como diálogo", () => {
  it("o painel leva role=dialog e aria-modal", () => {
    // Sem os dois, leitor de tela não diz que abriu um diálogo e segue
    // oferecendo a página inteira atrás do fundo escurecido.
    const html = renderToStaticMarkup(<ModalShell {...base}>x</ModalShell>);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it("o aria-labelledby aponta pro id do <h3> que está na tela", () => {
    // `aria-labelledby` em vez de `aria-label={title}` justamente pra os dois
    // não poderem divergir. O teste confere que o id REFERENCIADO é o id que
    // o heading realmente tem — um `aria-labelledby` apontando pra nada é
    // pior que nenhum, porque o diálogo fica sem nome nenhum.
    const html = renderToStaticMarkup(<ModalShell {...base}>x</ModalShell>);
    const ref = html.match(/aria-labelledby="([^"]+)"/);
    expect(ref, "o painel saiu sem aria-labelledby").not.toBeNull();
    expect(html).toContain(`<h3 id="${ref![1]}"`);
  });

  it("o painel é focável por código, e não é parada de Tab", () => {
    // `tabIndex={-1}`: painel sem controle focável dentro ainda precisa
    // receber o foco (senão ele fica no documento atrás), mas não deve ser
    // uma parada de Tab própria.
    expect(renderToStaticMarkup(<ModalShell {...base}>x</ModalShell>)).toContain('tabindex="-1"');
  });

  it("o overlay não finge ser controle", () => {
    // Ele fecha no clique, que é atalho de MOUSE — o caminho por teclado é o
    // Escape e o "×". `role="presentation"` é o que diz isso; um
    // `role="button"` ali seria uma parada de Tab invisível.
    expect(renderToStaticMarkup(<ModalShell {...base}>x</ModalShell>)).toContain('role="presentation"');
  });

  it("todo modal do pacote carrega a marcação de diálogo", () => {
    // O `PdfPreviewModal` NÃO passa pela casca do `Modal` (a dele carrega o
    // cálculo de zoom), então ele tinha de receber tudo isso à mão — e era o
    // único modal do pacote que nem fechava com Escape. Guard de fonte pra um
    // quarto modal não nascer sem nada disso.
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
