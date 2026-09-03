import { readFileSync } from "../support/read";
import { describe, expect, it } from "vitest";
import { relativeToSrc, sourceFiles, stripComments } from "../support/classScan";

// Guards das peças posicionáveis (Fase 6).
//
// O valor da decomposição é que cada peça funciona SOZINHA, dentro de um
// `<DesignerProvider>` e mais nada. Três coisas destroem isso em silêncio:
//
//   - uma peça importar o `Designer.tsx` (o preset), o que puxa o layout
//     inteiro de volta e cria ciclo de import;
//   - uma peça importar outra peça, o que faz "posicionar A" arrastar B;
//   - uma peça ler estado por PROP em vez de contexto, o que a torna
//     inutilizável fora do preset.
//
// Nada disso dá erro de build. Daí a varredura de fonte.

const PARTS_DIR = "designer/parts/";

function partFiles(): Array<{ rel: string; code: string }> {
  return sourceFiles()
    .map((f) => ({ rel: relativeToSrc(f), file: f }))
    .filter(({ rel }) => rel.startsWith(PARTS_DIR) && rel.endsWith(".tsx"))
    .map(({ rel, file }) => ({ rel, code: stripComments(readFileSync(file, "utf8")) }));
}

// A peça de conveniência é a ÚNICA que pode compor outras — é a razão de ela
// existir. `SelectedFieldHeader` não é peça: é o pedaço compartilhado entre
// o painel de propriedades e o de filtro (ver o comentário do arquivo).
const COMPOE_OUTRAS = `${PARTS_DIR}DesignerSidebar.tsx`;
const NAO_E_PECA = `${PARTS_DIR}SelectedFieldHeader.tsx`;

describe("peças — o inventário", () => {
  it("as 10 peças existem, e só elas", () => {
    // Peça é API pública que não se tira mais. Adicionar ou remover passa a
    // ser edição deliberada e revisada.
    const nomes = partFiles()
      .map(({ rel }) => rel.slice(PARTS_DIR.length).replace(/\.tsx$/, ""))
      .filter((n) => n !== "SelectedFieldHeader")
      .sort();
    expect(nomes).toEqual(
      [
        "DesignerBindingEditor",
        "DesignerCanvas",
        "DesignerFieldList",
        "DesignerFilterPanel",
        "DesignerInspector",
        "DesignerPageSettings",
        "DesignerPropertyPanel",
        "DesignerSidebar",
        "DesignerTabBar",
        "DesignerToolbar",
      ].sort()
    );
  });
});

describe("peças — nenhuma importa o preset", () => {
  for (const { rel, code } of partFiles()) {
    it(`${rel.slice(PARTS_DIR.length)} não importa Designer.tsx`, () => {
      expect(/from\s+"\.\.\/Designer"/.test(code), `${rel} importa o preset — ciclo de import e layout arrastado junto`).toBe(false);
    });
  }
});

describe("peças — só a sidebar compõe outras", () => {
  const outrasPecas = /from\s+"\.\/Designer[A-Za-z]+"/;

  for (const { rel, code } of partFiles()) {
    if (rel === COMPOE_OUTRAS || rel === NAO_E_PECA) continue;
    it(`${rel.slice(PARTS_DIR.length)} não importa outra peça`, () => {
      const achados = [...code.matchAll(/from\s+"\.\/(Designer[A-Za-z]+)"/g)].map((m) => m[1]);
      expect(achados, `${rel} importa peça(s) — "posicionar esta" passaria a arrastar aquela:\n  ${achados.join("\n  ")}`).toEqual([]);
    });
  }

  it("controle: a DesignerSidebar REALMENTE importa outras (senão a varredura é vácuo)", () => {
    const sidebar = partFiles().find(({ rel }) => rel === COMPOE_OUTRAS);
    expect(sidebar, "DesignerSidebar.tsx não encontrada").toBeDefined();
    expect(outrasPecas.test(sidebar!.code), "a sidebar deixou de compor peças — a varredura acima não guarda nada").toBe(true);
    // E compõe as sete de conteúdo, não uma só.
    const compostas = new Set([...sidebar!.code.matchAll(/from\s+"\.\/(Designer[A-Za-z]+)"/g)].map((m) => m[1]));
    expect(compostas.size, `a sidebar compõe ${compostas.size} peças; esperado 7`).toBe(7);
  });
});

describe("peças — leem estado de CONTEXTO, não de prop", () => {
  // O sintoma de errar isto: a peça compila, e some (ou explode) quando o
  // consumidor a posiciona sem repassar props que ele nem sabia que existiam.
  const ESTADO_PROIBIDO = ["template", "bindings", "selectedIds", "onChangeTemplate", "onChangeBindings", "sidebarTab"];

  for (const { rel, code } of partFiles()) {
    it(`${rel.slice(PARTS_DIR.length)} não recebe estado por prop`, () => {
      // Só o bloco de tipo de props da peça — não o corpo, que legitimamente
      // PASSA `template={template}` pro componente de baixo.
      const bloco = code.match(/export type Designer\w+Props = \{([\s\S]*?)\n\};/)?.[1] ?? "";
      const nomes = [...bloco.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*)\??:/gm)].map((m) => m[1]);
      const proibidos = nomes.filter((n) => ESTADO_PROIBIDO.includes(n));
      expect(proibidos, `${rel} recebe estado por prop em vez de contexto:\n  ${proibidos.join("\n  ")}`).toEqual([]);
    });
  }

  it("controle: a varredura acha as props que EXISTEM", () => {
    // Sem isto, um regex quebrado deixaria todo teste acima passar vazio.
    const fieldList = partFiles().find(({ rel }) => rel === `${PARTS_DIR}DesignerFieldList.tsx`);
    const bloco = fieldList!.code.match(/export type Designer\w+Props = \{([\s\S]*?)\n\};/)?.[1] ?? "";
    const nomes = [...bloco.matchAll(/^\s{2}([A-Za-z][A-Za-z0-9]*)\??:/gm)].map((m) => m[1]);
    expect(nomes).toContain("whenTab");
    expect(nomes).toContain("className");
    expect(nomes).toContain("heading");
  });
});

describe("peças — toda uma aceita className, style e whenTab", () => {
  for (const { rel, code } of partFiles()) {
    if (rel === NAO_E_PECA) continue;
    const nome = rel.slice(PARTS_DIR.length).replace(/\.tsx$/, "");
    it(`${nome} tem a superfície de estilo`, () => {
      expect(/className\?: string;/.test(code), `${nome} sem className — o consumidor não consegue posicionar`).toBe(true);
      expect(/style\?: CSSProperties;/.test(code), `${nome} sem style`).toBe(true);
      // A sidebar é a exceção: ela é o container das abas, então gatear ELA
      // por aba não faz sentido nenhum.
      if (rel !== COMPOE_OUTRAS) {
        expect(/whenTab\?: TabGate;/.test(code), `${nome} sem whenTab — não dá pra reproduzir o comportamento de sidebar`).toBe(true);
      }
    });
  }
});

describe("peças — o gate de aba é opt-in", () => {
  it("useTabGate devolve true quando whenTab é omitido", () => {
    // A decisão mais sutil da decomposição: se o default fosse gatear,
    // `DesignerPropertyPanel` e `DesignerPageSettings` lado a lado apagariam
    // um ao outro, e as peças só funcionariam dentro de uma sidebar.
    const code = lêArquivo("designer/parts/useTabGate.ts");
    expect(/if \(whenTab === undefined\) return true;/.test(code), "o default do gate deixou de ser 'renderiza sempre'").toBe(true);
  });

  it("nenhuma peça lê sidebarTab direto pra se esconder", () => {
    // Ler `sidebarTab` e decidir por conta própria é como o gate volta a ser
    // obrigatório sem ninguém mudar o default.
    for (const { rel, code } of partFiles()) {
      if (rel === `${PARTS_DIR}DesignerTabBar.tsx`) continue; // a barra PRECISA saber qual está ativa
      const comparaAba = /sidebarTab\s*===|sidebarTab\s*!==/.test(code);
      expect(comparaAba, `${rel} compara sidebarTab na mão — use whenTab`).toBe(false);
    }
  });
});

function lêArquivo(rel: string): string {
  const file = sourceFiles().find((f) => relativeToSrc(f) === rel);
  expect(file, `arquivo não encontrado: ${rel}`).toBeDefined();
  return stripComments(readFileSync(file as string, "utf8"));
}
