import { readFileSync } from "./support/read";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// VISUAL ANTI-CONVERGENCE of the examples.
//
// The problem this file exists to prevent really happened: the five examples
// ended up looking alike. Measured in the browser at the time —
//
//   | example           | font           | button radius | card radius |
//   | report-builder    | -apple-system  | 8px           | 12px        |
//   | custom-ui         | -apple-system  | 8px           | 12px        |
//   | no-preview        | -apple-system  | 8px           | 12px        |
//   | composed-layout   | -apple-system  | 4px           | —           |
//
// `custom-ui` writes ~190 `.jpd-*` classes BY HAND and reproduced the
// default's radii exactly; `no-preview` was the default with dark colors. All
// of them in the same font. That is: the repo had five apps to demonstrate
// that everything can be changed, and the five looked like the same product
// painted differently.
//
// Convergence is the NATURAL failure mode here: re-theming is work, and
// copying the default is the path of least resistance. Nothing warns — the
// tests pass, the build passes, and the demonstration dies in silence.
//
// Each example declares a SIGNATURE below: marks that only exist if its
// re-theme is standing. Going back to the default erases the signature and
// breaks the suite.

const RAIZ = join(__dirname, "..");
const EX = join(RAIZ, "examples");

// Each example's main stylesheet.
function cssDe(dir: string): string {
  for (const nome of ["index.css", "App.css"]) {
    const p = join(EX, dir, "src", nome);
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  return "";
}

type Assinatura = {
  // The example's OWN variable prefix. None shares the same one, which also
  // keeps the five files legible side by side.
  prefixo: string | null;
  // LOOK marks: each of them disappears if the example goes back to the default.
  marcas: Array<{ nome: string; padrao: RegExp; minimo?: number }>;
};

const ASSINATURAS: Record<string, Assinatura> = {
  // The REFERENCE. Its signature is the ABSENCE of a re-theme: if someone
  // starts overriding `--jpd-*` here, the repo loses the baseline the other
  // four measure themselves against.
  "report-builder": {
    prefixo: null,
    marcas: [],
  },

  // BRUTALIST, through tokens only.
  "composed-layout": {
    prefixo: "--app-",
    marcas: [
      { nome: "raio zerado (vários tokens)", padrao: /--jpd-radius-[a-z]+:\s*0/g, minimo: 4 },
      { nome: "fonte do editor virou mono", padrao: /--jpd-font-sans:\s*var\(--jpd-font-mono\)/ },
      { nome: "accent amarelo", padrao: /--jpd-accent-solid:\s*#ffd400/i },
    ],
  },

  // TERMINAL/IDE, token + override de regra.
  "no-preview": {
    prefixo: "--app-",
    marcas: [
      { nome: "verde fósforo", padrao: /#7ee787/i },
      { nome: "os dois blocos de tema", padrao: /\[data-jpd-theme="dark"\]/ },
      { nome: "override de REGRA `.jpd-*` (o 2º mecanismo)", padrao: /^\s*\.jpd-[a-z_-]+/gm, minimo: 5 },
    ],
  },

  // APP MACIO, zero CSS do pacote.
  "custom-ui": {
    prefixo: "--ui-",
    marcas: [
      { nome: "botão em pílula", padrao: /999px/g, minimo: 1 },
      { nome: "pilha de fonte arredondada", padrao: /Nunito|Quicksand|ui-rounded/i },
      { nome: "accent coral", padrao: /#ff6b5b/i },
    ],
  },

  // BLUEPRINT, reset only + its own editor.
  "headless-designer": {
    prefixo: "--bp-",
    marcas: [
      { nome: "papel milimetrado", padrao: /repeating-linear-gradient/g, minimo: 2 },
      { nome: "passo da grade vindo da ESCALA, não de número mágico", padrao: /--bp-grid-(minor|major)/g, minimo: 2 },
      { nome: "hairline ciano", padrao: /#4dd0e1/i },
    ],
  },
};

describe("examples — cada um tem a assinatura visual dele", () => {
  for (const [dir, { marcas }] of Object.entries(ASSINATURAS)) {
    if (marcas.length === 0) continue;
    const css = cssDe(dir);

    it(`${dir} mantém as ${marcas.length} marcas do retema`, () => {
      const perdidas = marcas
        .filter(({ padrao, minimo }) => {
          if (minimo === undefined) return !padrao.test(css);
          const n = [...css.matchAll(new RegExp(padrao.source, padrao.flags.includes("g") ? padrao.flags : padrao.flags + "g"))].length;
          return n < minimo;
        })
        .map((m) => m.nome);
      expect(perdidas, `${dir} perdeu marca do retema — voltou a parecer com os outros:\n  ${perdidas.join("\n  ")}`).toEqual([]);
    });
  }
});

describe("examples — a referência continua sendo referência", () => {
  it("report-builder não retematiza nada", () => {
    // Se ele começar a sobrescrever `--jpd-*`, deixa de ser a linha de base
    // e a comparação com os outros quatro perde sentido.
    const css = cssDe("report-builder");
    const overrides = [...css.matchAll(/^\s*--jpd-[a-z0-9-]+:/gm)].map((m) => m[0].trim());
    expect(overrides, `a referência começou a retematizar:\n  ${overrides.join("\n  ")}`).toEqual([]);
  });
});

describe("examples — nenhum prefixo de variável é compartilhado", () => {
  it("cada example usa o próprio namespace", () => {
    // Prefixo repetido é sintoma de copiar-colar entre examples, que é como
    // a convergência começa.
    const usos = new Map<string, string[]>();
    for (const [dir, { prefixo }] of Object.entries(ASSINATURAS)) {
      if (!prefixo) continue;
      const lista = usos.get(prefixo) ?? [];
      lista.push(dir);
      usos.set(prefixo, lista);
    }
    // `--app-` é compartilhado por dois de propósito (é "a casca do app", e
    // os dois têm casca própria) — o que os distingue são as MARCAS acima,
    // não o prefixo. Os prefixos de IDENTIDADE (`--ui-`, `--bp-`) são únicos.
    const identidade = ["--ui-", "--bp-"];
    for (const p of identidade) {
      expect(usos.get(p)?.length ?? 0, `prefixo de identidade ${p} usado por mais de um example`).toBe(1);
    }
  });

  it("o prefixo declarado existe de verdade no CSS", () => {
    // Anti-vacuidade: prefixo errado na tabela desligaria a checagem.
    const errados: string[] = [];
    for (const [dir, { prefixo }] of Object.entries(ASSINATURAS)) {
      if (!prefixo) continue;
      if (!cssDe(dir).includes(prefixo)) errados.push(`${dir} -> ${prefixo}`);
    }
    expect(errados, `prefixo declarado e ausente do CSS:\n  ${errados.join("\n  ")}`).toEqual([]);
  });
});

describe("examples — os cinco divergem entre si", () => {
  const dirs = readdirSync(EX, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  it("a tabela cobre todos os examples do disco", () => {
    expect(dirs).toEqual(Object.keys(ASSINATURAS).sort());
  });

  it("nenhum example casa as marcas de OUTRO", () => {
    // Cruzamento: se o `custom-ui` passar a bater as marcas do
    // `composed-layout` (accent amarelo, `--jpd-font-sans` virando mono),
    // ele convergiu. Isto é preciso porque as marcas são específicas de
    // cada identidade.
    //
    // A primeira versão deste teste comparava uma TUPLA grossa
    // (mono/reto/pílula/grade/temas) e acusava `composed-layout` × `custom-ui`
    // — dois looks obviamente diferentes. Os três eixos que colidiram eram
    // artefato: `monospace` incidental do textarea de JSON, o `radius: 0` do
    // reset local, e um `999px` DENTRO DE COMENTÁRIO. Medir presença de
    // string não mede semelhança visual; casar a assinatura ALHEIA mede.
    const invasores: string[] = [];
    for (const dir of dirs) {
      const css = semComentario(cssDe(dir));
      for (const [outro, { marcas }] of Object.entries(ASSINATURAS)) {
        if (outro === dir || marcas.length === 0) continue;
        const casadas = marcas.filter(({ padrao }) => new RegExp(padrao.source, padrao.flags.replace("g", "")).test(css));
        // Uma marca em comum pode ser coincidência (dois usarem mono, por
        // ex.). TODAS em comum é convergência.
        if (casadas.length === marcas.length) invasores.push(`${dir} casa a assinatura INTEIRA de ${outro}`);
      }
    }
    expect(invasores, `example com a identidade de outro: ${invasores.join(", ")}`).toEqual([]);
  });

  it("controle: cada example casa a PRÓPRIA assinatura inteira", () => {
    // Sem isto, o teste acima passaria se as marcas nunca casassem nada.
    const falhos: string[] = [];
    for (const [dir, { marcas }] of Object.entries(ASSINATURAS)) {
      if (marcas.length === 0) continue;
      const css = semComentario(cssDe(dir));
      const casadas = marcas.filter(({ padrao }) => new RegExp(padrao.source, padrao.flags.replace("g", "")).test(css));
      if (casadas.length !== marcas.length) falhos.push(`${dir}: ${casadas.length}/${marcas.length}`);
    }
    expect(falhos, `a varredura de marcas não acha as marcas do próprio example: ${falhos.join(", ")}`).toEqual([]);
  });
});

// Comentário some antes de qualquer varredura. É o mesmo cuidado que o
// noTailwind.test.ts documenta, e por um motivo concreto: um example comenta
// o caminho de reverter um token (`/* radius-full: 999px in case it is needed */`) e
// sem o strip isso conta como "tem pílula".
function semComentario(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}
