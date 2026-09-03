import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Binding, Template } from "../../src/types";
import { DesignerProvider } from "../../src/designer/context/DesignerProvider";
import {
  DesignerBindingEditor,
  DesignerCanvas,
  DesignerFieldList,
  DesignerFilterPanel,
  DesignerInspector,
  DesignerPageSettings,
  DesignerPropertyPanel,
  DesignerSidebar,
  DesignerTabBar,
  DesignerToolbar,
} from "../../src/designer/parts";

// Sonda de RENDER das peças. É o teste que prova o mecanismo inteiro da
// decomposição, e não precisa de DOM: `renderToStaticMarkup` basta porque o
// que interessa é o markup EMITIDO — se a peça renderiza dentro de um
// provider e mais nada, e se a classe do consumidor chegou na raiz dela.
//
// (O que ele NÃO cobre, por não ter DOM: arrasto, medição da faixa de abas,
// animação de colapso. Esses vão no checklist manual do PR.)

const template: Template = {
  page: { width: 210, height: 297 },
  headerHeight: 13,
  footerHeight: 10,
  marginLeft: 10,
  marginRight: 10,
  schemas: [
    { id: "t1", name: "titulo", type: "text", x: 20, y: 20, width: 80, height: 10, content: "Olá" },
    { id: "tb1", name: "tabela", type: "table", x: 20, y: 60, width: 170, height: 40, head: ["a", "b"], content: [["{a}", "{b}"]] },
  ],
} as unknown as Template;

const bindings: Binding[] = [{ schemaName: "tabela", type: "array", path: "rows", columns: ["a", "b"] }] as unknown as Binding[];

function wrap(node: ReactElement) {
  return renderToStaticMarkup(
    <DesignerProvider template={template} onChangeTemplate={() => {}} bindings={bindings} onChangeBindings={() => {}}>
      {node}
    </DesignerProvider>
  );
}

// Peças que renderizam SEM seleção — são as que um layout mostra sempre.
const SEM_SELECAO: Array<{ nome: string; raiz: string; render: (p: { className: string }) => ReactElement }> = [
  { nome: "DesignerCanvas", raiz: "jpd-designer__canvas", render: (p) => <DesignerCanvas {...p} /> },
  { nome: "DesignerTabBar", raiz: "jpd-tabs", render: (p) => <DesignerTabBar {...p} /> },
  { nome: "DesignerFieldList", raiz: "jpd-stack", render: (p) => <DesignerFieldList {...p} /> },
  { nome: "DesignerToolbar", raiz: "jpd-sidebar__footer", render: (p) => <DesignerToolbar {...p} /> },
  { nome: "DesignerPageSettings", raiz: "jpd-stack", render: (p) => <DesignerPageSettings {...p} /> },
  { nome: "DesignerInspector", raiz: "jpd-part", render: (p) => <DesignerInspector {...p} /> },
  { nome: "DesignerSidebar", raiz: "jpd-sidebar", render: (p) => <DesignerSidebar {...p} /> },
];

describe("peças renderizam com só um DesignerProvider por volta", () => {
  for (const { nome, raiz, render } of SEM_SELECAO) {
    it(`${nome}: renderiza, mantém a classe base e recebe a do consumidor`, () => {
      const html = wrap(render({ className: "sonda-consumidor" }));
      expect(html, `${nome} não emitiu nada — falta contexto?`).not.toBe("");
      expect(html, "a classe base da peça foi perdida").toContain(raiz);
      expect(html, "className do consumidor não chegou").toContain("sonda-consumidor");
    });
  }
});

describe("peças que dependem de seleção", () => {
  // Sem campo selecionado elas renderizam `null` — de propósito. O texto de
  // estado vazio depende do layout ("clique num campo à esquerda" só faz
  // sentido se houver um "à esquerda"), então é do consumidor.
  //
  // No SSR a seleção é sempre vazia (`useSelection` começa em `[]` e nada
  // clica), o que faz deste o teste natural desse contrato.
  const DEPENDEM = [
    { nome: "DesignerPropertyPanel", node: <DesignerPropertyPanel className="sonda-consumidor" /> },
    { nome: "DesignerFilterPanel", node: <DesignerFilterPanel className="sonda-consumidor" /> },
    { nome: "DesignerBindingEditor", node: <DesignerBindingEditor className="sonda-consumidor" /> },
  ];

  for (const { nome, node } of DEPENDEM) {
    it(`${nome}: sem seleção, não emite nada`, () => {
      expect(wrap(node)).toBe("");
    });
  }
});

describe("whenTab", () => {
  // A aba inicial é "campos" (ver DesignerProvider).
  it("peça gateada na aba ATIVA renderiza", () => {
    expect(wrap(<DesignerFieldList whenTab="campos" className="sonda-consumidor" />)).toContain("sonda-consumidor");
  });

  it("peça gateada em OUTRA aba não renderiza", () => {
    expect(wrap(<DesignerPageSettings whenTab="pagina" className="sonda-consumidor" />)).toBe("");
  });

  it("aceita lista de abas", () => {
    expect(wrap(<DesignerFieldList whenTab={["campos", "pagina"]} className="sonda-consumidor" />)).toContain("sonda-consumidor");
    expect(wrap(<DesignerPageSettings whenTab={["pagina", "inspetor"]} className="sonda-consumidor" />)).toBe("");
  });

  it("SEM whenTab, a peça renderiza mesmo fora da aba dela — é o ponto", () => {
    // `DesignerPageSettings` não tem nada a ver com a aba "campos", e ainda
    // assim aparece. É isso que deixa pôr duas peças lado a lado num layout
    // sem abas; gatear por default apagaria uma delas.
    expect(wrap(<DesignerPageSettings className="sonda-consumidor" />)).toContain("sonda-consumidor");
  });

  it("duas peças de abas DIFERENTES renderizam juntas, sem whenTab", () => {
    const html = wrap(
      <div>
        <DesignerFieldList className="sonda-lista" />
        <DesignerPageSettings className="sonda-pagina" />
      </div>
    );
    expect(html).toContain("sonda-lista");
    expect(html).toContain("sonda-pagina");
  });
});

describe("o preset e as peças concordam", () => {
  it("a sidebar renderiza a barra de abas e o conteúdo da aba inicial", () => {
    const html = wrap(<DesignerSidebar />);
    expect(html, "barra de abas").toContain("jpd-tabs");
    expect(html, "aba ativa marcada com o booleano CRU (o querySelector depende)").toContain('data-active="true"');
    // Aba inicial é "campos": lista + rodapé de ações, e NÃO o painel de
    // página.
    expect(html, "lista de campos").toContain("jpd-fieldlist__scroll");
    expect(html, "rodapé com a toolbar").toContain("jpd-sidebar__footer");
    expect(html, "painel de página não devia estar na aba campos").not.toContain('data-part="page-settings"');
  });

  it("a sidebar dá exatamente DOIS filhos de flex na aba campos", () => {
    // O gap de 8px do `.jpd-tabpanel__body` separa a lista do rodapé. Se
    // alguém embrulhar os dois num nível a mais, o gap colapsa e o layout
    // muda sem nenhum teste reclamar.
    const html = wrap(<DesignerSidebar />);
    // O PRIMEIRO elemento depois da abertura do `__body` tem de ser a lista
    // em pessoa. Checar só a ORDEM dos `data-part` não serve: um `<div>`
    // embrulhando os dois preserva a ordem e passaria (verificado por
    // mutação).
    const primeiraTag = html.match(/jpd-tabpanel__body[^>]*>\s*<(\w+)([^>]*)>/);
    expect(primeiraTag, "não achei a abertura do corpo do TabPanel").not.toBeNull();
    expect(
      primeiraTag![2],
      `o primeiro filho do .jpd-tabpanel__body não é a lista de campos — tem um nível de DOM a mais, e o gap de 8px entre lista e rodapé colapsou. Achei: <${primeiraTag![1]}${primeiraTag![2]}>`
    ).toContain('data-part="field-list"');
    // E o rodapé é IRMÃO dela, não filho: a lista fecha antes dele abrir.
    const iLista = html.indexOf('data-part="field-list"');
    const iRodape = html.indexOf('data-part="toolbar"');
    expect(iLista).toBeGreaterThan(-1);
    expect(iRodape).toBeGreaterThan(iLista);
  });
});
