import { readFileSync } from "./support/read";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// FEATURE PARITY between the examples.
//
// The repo's rule: the five examples have the SAME set of features, and what
// distinguishes them is only (a) how they assemble the editor and (b) how they
// style it. That is what makes comparing them worth anything — if one has
// undo/redo and the other does not, the difference in style stops being the
// only variable.
//
// Without this guard nothing warns: an example keeps compiling and running
// with half the features, and the READMEs' promise becomes false. That was the
// real state before this round — `no-preview` had 3 of the 11 and
// `composed-layout` had 2.
//
// The reference is `report-builder`.

const RAIZ = join(__dirname, "..");
const EX = join(RAIZ, "examples");
const REFERENCIA = "report-builder";

// Each feature is detected by a SYMBOL, not by a file path — the example is
// free to organize its folders however it likes. What is not negotiable is
// that the behavior exists.
const RECURSOS: Array<{ nome: string; padrao: RegExp; excecoes?: Record<string, string> }> = [
  { nome: "fontes de dados JSON (várias, mescladas)", padrao: /mergeSources/ },
  { nome: "explorador de campos", padrao: /extractFields/ },
  { nome: "6 templates prontos", padrao: /\bEXAMPLES\b/ },
  { nome: "undo/redo", padrao: /useUndoRedo/ },
  { nome: "autosave", padrao: /useAutosave/ },
  { nome: "salvar/carregar projeto", padrao: /parseProjectFile|downloadProjectFile/ },
  { nome: "múltiplas páginas", padrao: /ensurePages|blankPage/ },
  { nome: "painel de problemas", padrao: /templateProblems/ },
  { nome: "erro de geração traduzido", padrao: /describeGenerationError/ },
  { nome: "seletor de idioma", padrao: /Locale|locale=/ },
  {
    nome: "preview de PDF",
    padrao: /PdfPreview/,
    excecoes: {
      // This example exists to prove that the main entry works WITHOUT
      // pdfjs-dist installed. Having a preview here would destroy the test —
      // its own `npm run build` fails through `check-no-pdfjs.mjs`.
      "no-preview": "proibido por design: sem pdfjs-dist, ver o README dele",
    },
  },
];

function exampleDirs(): string[] {
  return readdirSync(EX, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

// The example's whole source, concatenated. Comments are deliberately NOT
// stripped: an example may legitimately mention a symbol in prose, and the
// cost of a false positive here (someone writes "we have no undo/redo" and the
// test thinks there is) is lower than that of a silent false negative.
// The REAL check is each example's build, which runs in CI.
function fonteDe(dir: string): string {
  const raiz = join(EX, dir, "src");
  if (!existsSync(raiz)) return "";
  const partes: string[] = [];
  const anda = (d: string) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) anda(p);
      else if (/\.tsx?$/.test(ent.name)) partes.push(readFileSync(p, "utf8"));
    }
  };
  anda(raiz);
  return partes.join("\n");
}

describe("examples — a referência tem todos os recursos", () => {
  const fonte = fonteDe(REFERENCIA);

  it(`${REFERENCIA} é a referência e tem os ${RECURSOS.length}`, () => {
    // Controle: se a referência perder um recurso, os testes abaixo passariam
    // a exigir menos dos outros sem ninguém notar.
    const faltando = RECURSOS.filter((r) => !r.padrao.test(fonte)).map((r) => r.nome);
    expect(faltando, `a REFERÊNCIA perdeu recurso — os outros examples deixariam de ser cobrados:\n  ${faltando.join("\n  ")}`).toEqual([]);
  });
});

describe("examples — paridade de recursos", () => {
  for (const dir of exampleDirs()) {
    if (dir === REFERENCIA) continue;
    const fonte = fonteDe(dir);

    it(`${dir} tem os mesmos recursos da referência`, () => {
      const faltando = RECURSOS.filter((r) => {
        if (r.excecoes?.[dir]) return false;
        return !r.padrao.test(fonte);
      }).map((r) => r.nome);
      expect(
        faltando,
        `${dir} está sem recurso que a referência tem — ou implemente, ou declare exceção com motivo em RECURSOS:\n  ${faltando.join("\n  ")}`
      ).toEqual([]);
    });
  }

  it("toda exceção declarada aponta pra um example que existe", () => {
    // Proteção anti-vacuidade: exceção com nome de pasta errado desligaria a
    // checagem pra ninguém e ninguém notaria.
    const dirs = new Set(exampleDirs());
    const fantasmas = RECURSOS.flatMap((r) => Object.keys(r.excecoes ?? {}))
      .filter((d) => !dirs.has(d))
      .map((d) => d);
    expect(fantasmas, `exceção pra example inexistente:\n  ${fantasmas.join("\n  ")}`).toEqual([]);
  });

  it("as exceções são POUCAS e cada uma tem motivo escrito", () => {
    // Exceção é escape hatch, não a regra. Se virar muitas, a paridade
    // deixou de existir e este arquivo passou a documentar a divergência em
    // vez de impedi-la.
    const todas = RECURSOS.flatMap((r) => Object.entries(r.excecoes ?? {}));
    expect(todas.length, "exceções demais — a paridade virou exceção").toBeLessThanOrEqual(3);
    for (const [dir, motivo] of todas) {
      expect(motivo.length, `a exceção de ${dir} precisa de um motivo escrito`).toBeGreaterThan(20);
    }
  });
});

describe("examples — nenhum importa código de outro", () => {
  it("cada example é autossuficiente", () => {
    // A estrutura decidida é "cada um autossuficiente": material de exemplo
    // tem de ler sozinho e ser copiável direto pro projeto do leitor. Um
    // `import "../report-builder/src/..."` quebraria isso — e também
    // quebraria o build, porque cada example tem tsconfig próprio com
    // `include: ["src"]`.
    const ofensores: string[] = [];
    for (const dir of exampleDirs()) {
      for (const m of fonteDe(dir).matchAll(/from\s+"((?:\.\.\/)+[^"]*)"/g)) {
        // Subir de `src/` pra raiz do próprio example é legítimo; subir DOIS
        // níveis sai da pasta dele.
        if (/^\.\.\/\.\.\//.test(m[1])) ofensores.push(`${dir}: ${m[1]}`);
      }
    }
    expect(ofensores, `example importando de fora da própria pasta:\n  ${ofensores.join("\n  ")}`).toEqual([]);
  });
});

// O REGISTRY DE SLOTS tem de estar demonstrado em algum example.
//
// Até esta rodada ele tinha cobertura só em TESTE (`uiSlots.test.tsx`,
// `adapterCompiles.test.tsx`) e zero em app que roda — numa release cuja
// manchete inclui "troque os primitivos que o editor usa por dentro". Um
// briefing meu afirmava que o `custom-ui` fazia isso; não fazia, e não pode:
// trocar os primitivos REMOVE do DOM as `.jpd-btn`/`.jpd-input`/`.jpd-select`
// que as ~190 classes do CSS dele estilizam. As duas identidades são
// mutuamente exclusivas.
//
// Mora no `no-preview`, que usa o `<Designer>` preset — então demonstra o
// açúcar `<Designer components={...}>`, o caminho da maioria.
describe("examples — o registry de slots está demonstrado", () => {
  // SEM COMENTÁRIO, pra todo este describe. Os três checks aqui procuram
  // formas de código (`components={`, `components={{`, `satisfies`) que o
  // próprio example legitimamente ESCREVE EM PROSA — pra ensinar o que fazer
  // e o que não fazer. Duas versões deste arquivo passaram em vácuo por
  // isso: o comentário do `uiSlots.tsx` casava `components={` e o teste
  // "algum example demonstra" ficava verde mesmo com o JSX removido.
  const fontes = exampleDirs().map((dir) => ({ dir, src: semComentario(fonteDe(dir)) }));

  it("algum example passa `components=` de verdade", () => {
    const demonstram = fontes.filter(({ src }) => /components=\{/.test(src)).map(({ dir }) => dir);
    expect(
      demonstram.length,
      "nenhum example demonstra o registry de slots — a feature fica só em teste"
    ).toBeGreaterThan(0);
  });

  it("o mapa de slots é constante de MÓDULO, não objeto inline", () => {
    // Identidade instável é o footgun mais afiado desta API: objeto inline
    // cria componente novo a cada render, o React remonta o slotado, e o
    // campo perde o foco a cada tecla. Um example ensinando a forma errada
    // seria pior que example nenhum.
    //
    // Um example que documenta o anti-padrão ("não faça
    // `components={{ ... }}`") está fazendo a coisa CERTA — e é por isso que
    // `fontes` já vem sem comentário (ver o topo do describe).
    const ofensores: string[] = [];
    for (const { dir, src } of fontes) {
      // `components={{` = objeto literal escrito no JSX.
      if (/components=\{\{/.test(src)) ofensores.push(dir);
    }
    expect(ofensores, `example passando objeto INLINE em components= — hoiste pra constante de módulo:\n  ${ofensores.join("\n  ")}`).toEqual([]);
  });

  it("o adapter usa `satisfies UiComponentsOverride`", () => {
    // É o que mantém o adapter tipado nas duas pontas: com `:` o TypeScript
    // alargaria pro tipo do slot e pararia de checar se as props batem.
    const comSlots = fontes.filter(({ src }) => /components=\{/.test(src));
    for (const { dir, src } of comSlots) {
      expect(/satisfies UiComponentsOverride/.test(src), `${dir} devia tipar o mapa com \`satisfies UiComponentsOverride\``).toBe(true);
    }
  });
});

// Removes block and line comments. There is no need to preserve offsets (no
// test here reports a line), so the simple replace will do.
function semComentario(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
