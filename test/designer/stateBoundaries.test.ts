import { readFileSync } from "../support/read";
import { describe, expect, it } from "vitest";
import { relativeToSrc, sourceFiles, stripComments } from "../support/classScan";

// Guards da divisão de estado (Fases 5 e 6). Cinco invariantes, e todos
// falham em SILÊNCIO se alguém desfizer:
//
//   1. `useClipboardAndDelete` é registrado EXATAMENTE uma vez. Em duas
//      peças, todo Ctrl+V cola dobrado; em nenhuma, Delete/Ctrl+V somem sem
//      erro nenhum.
//   2. O `Designer.tsx` não guarda estado. Estado no preset é estado que a
//      peça avulsa não tem — e ela simplesmente não funciona, sem avisar.
//   3. As peças que TÊM estado local continuam com ele (controle do item 2).
//   4. Os contextos não conhecem primitivo do kit. Se `contexts.ts` passasse
//      a importar de `components/ui`, o grafo de import do `/preview`
//      (que importa Button) puxaria o designer inteiro.
//   5. `useSelection` não sabe o que é sidebar.

const lê = (rel: string) => {
  const file = sourceFiles().find((f) => relativeToSrc(f) === rel);
  expect(file, `arquivo não encontrado: ${rel}`).toBeDefined();
  return stripComments(readFileSync(file as string, "utf8"));
};

describe("useClipboardAndDelete registra uma vez só", () => {
  it("exatamente um arquivo importa o hook", () => {
    const importadores = sourceFiles()
      .filter((f) => relativeToSrc(f) !== "designer/useClipboardAndDelete.ts")
      .filter((f) => /useClipboardAndDelete/.test(stripComments(readFileSync(f, "utf8"))))
      .map(relativeToSrc);
    expect(importadores, "colar dobrado (2+) ou Delete/Ctrl+V mudos (0)").toEqual(["designer/context/DesignerProvider.tsx"]);
  });
});

describe("Designer.tsx não guarda estado nenhum", () => {
  it("zero useState/useRef — ele é só composição", () => {
    // Depois da Fase 6 o Designer.tsx é três providers e duas peças. Todo
    // estado mora no DesignerProvider (o compartilhado) ou dentro da peça
    // que o usa (`tabStripRef`/`tabScroll` no DesignerTabBar,
    // `showSectionPicker` no DesignerToolbar).
    //
    // A regressão natural é adicionar "só um useState aqui" no preset — e
    // aí a peça avulsa não tem esse comportamento, sem nada avisar.
    const declarados = [...lê("designer/Designer.tsx").matchAll(/=\s*use(?:State|Ref)\b/g)].map((m) => m[0]);
    expect(declarados.length, "estado no preset — devia estar no provider ou na peça").toBe(0);
  });

  it("controle: as peças que TÊM estado local continuam com ele", () => {
    // Sem isto o teste acima passaria mesmo que alguém apagasse o estado
    // local das peças por engano, ou que a varredura quebrasse.
    const barra = lê("designer/parts/DesignerTabBar.tsx");
    expect(/useRef<HTMLDivElement>/.test(barra), "tabStripRef sumiu da barra de abas").toBe(true);
    expect(/useState\(\{ left: false, right: false \}\)/.test(barra), "tabScroll sumiu da barra de abas").toBe(true);
    expect(/useState\(false\)/.test(lê("designer/parts/DesignerToolbar.tsx")), "showSectionPicker sumiu da toolbar").toBe(true);
  });

  it("não declara contexto próprio — só consome", () => {
    expect(/createContext/.test(lê("designer/Designer.tsx")), "contexto no Designer.tsx: peça avulsa não alcança").toBe(false);
  });
});

describe("os contextos não puxam o kit", () => {
  for (const rel of ["designer/context/contexts.ts", "designer/context/derived.ts", "designer/context/hooks.ts"]) {
    it(`${rel.split("/").pop()} não importa de components/ui`, () => {
      expect(/components\/ui/.test(lê(rel)), `${rel} importa o kit — o entry /preview passaria a puxar o designer`).toBe(false);
    });
  }

  it("o DesignerProvider também não (controle: ele é .tsx e poderia)", () => {
    expect(/components\/ui/.test(lê("designer/context/DesignerProvider.tsx"))).toBe(false);
  });
});

describe("useSelection não sabe o que é sidebar", () => {
  it("não menciona sidebar/collapsed", () => {
    // A inversão pra `onActivity` é o que faz layout SEM sidebar existir.
    // Um PR que "simplifique" de volta pra `setSidebarCollapsed` reintroduz
    // o acoplamento sem quebrar nada visível dentro do <Designer>.
    const code = lê("designer/useSelection.ts");
    expect(/setSidebarCollapsed/.test(code), "useSelection voltou a receber setSidebarCollapsed").toBe(false);
    expect(/onActivity/.test(code), "controle: `onActivity` sumiu do hook").toBe(true);
  });
});
