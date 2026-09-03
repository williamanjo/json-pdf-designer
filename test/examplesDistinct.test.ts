import { readFileSync } from "./support/read";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ANTI-CONVERGÊNCIA VISUAL dos examples.
//
// O problema que este arquivo existe pra impedir aconteceu de verdade: os
// cinco examples ficaram parecidos. Medido no navegador na época —
//
//   | example           | fonte          | raio botão | raio card |
//   | report-builder    | -apple-system  | 8px        | 12px      |
//   | custom-ui         | -apple-system  | 8px        | 12px      |
//   | no-preview        | -apple-system  | 8px        | 12px      |
//   | composed-layout   | -apple-system  | 4px        | —         |
//
// O `custom-ui` escreve ~190 classes `.jpd-*` À MÃO e reproduzia os raios do
// default exatamente; o `no-preview` era o default com cores escuras. Todos
// na mesma fonte. Ou seja: o repo tinha cinco apps pra demonstrar que dá pra
// mudar tudo, e os cinco pareciam o mesmo produto pintado diferente.
//
// A convergência é o modo de falha NATURAL aqui: retematizar dá trabalho, e
// copiar o default é o caminho de menor resistência. Nada avisa — os testes
// passam, o build passa, e a demonstração morre em silêncio.
//
// Cada example declara abaixo uma ASSINATURA: marcas que só existem se o
// retema dele estiver de pé. Voltar ao default apaga a assinatura e quebra
// a suíte.

const RAIZ = join(__dirname, "..");
const EX = join(RAIZ, "examples");

// A folha de estilo principal de cada example.
function cssDe(dir: string): string {
  for (const nome of ["index.css", "App.css"]) {
    const p = join(EX, dir, "src", nome);
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  return "";
}

type Assinatura = {
  // Prefixo de variável PRÓPRIA do example. Nenhum compartilha o mesmo, o
  // que também mantém os cinco arquivos legíveis lado a lado.
  prefixo: string | null;
  // Marcas de LOOK: cada uma some se o example voltar ao default.
  marcas: Array<{ nome: string; padrao: RegExp; minimo?: number }>;
};

const ASSINATURAS: Record<string, Assinatura> = {
  // A REFERÊNCIA. A assinatura dela é a AUSÊNCIA de retema: se alguém
  // começar a sobrescrever `--jpd-*` aqui, o repo perde a linha de base
  // contra a qual os outros quatro se medem.
  "report-builder": {
    prefixo: null,
    marcas: [],
  },

  // BRUTALISTA, só por token.
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

  // BLUEPRINT, reset só + editor próprio.
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
// o caminho de reverter um token (`/* radius-full: 999px caso precise */`) e
// sem o strip isso conta como "tem pílula".
function semComentario(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}
