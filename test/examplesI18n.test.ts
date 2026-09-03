import { readFileSync } from "./support/read";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// O SELETOR DE IDIOMA TROCA AS DUAS CAMADAS.
//
// A lição de i18n da lib: o pacote traduz o que é DELE, e o `locale` que o
// app já tem no estado alimenta os dois dicionários — o nosso e o dele. Um
// switch, duas responsabilidades.
//
// Antes desta rodada o seletor de cada example trocava só o chrome do
// EDITOR; a casca do app ficava em português fixo. Da perspectiva de quem
// abre o example em inglês, metade da tela não obedecia ao próprio controle.
//
// Este guard cobre os três jeitos de isso apodrecer em silêncio:
//
//   1. Um example volta a ter texto de UI cravado (nada avisa: renderiza).
//   2. Um dicionário fica com chave faltando num idioma (renderiza VAZIO).
//   3. Alguém traduz o que é DADO — conteúdo de template, JSON de amostra,
//      nome de campo. Isso não é bug de tradução, é bug de conceito: o
//      idioma da INTERFACE não é o idioma do DOCUMENTO.

const RAIZ = join(__dirname, "..");
const EX = join(RAIZ, "examples");

function exampleDirs(): string[] {
  return readdirSync(EX, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

function arquivos(dir: string, filtro: (nome: string) => boolean): string[] {
  const raiz = join(EX, dir, "src");
  if (!existsSync(raiz)) return [];
  const out: string[] = [];
  const anda = (d: string) => {
    for (const ent of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, ent.name);
      if (ent.isDirectory()) anda(p);
      else if (filtro(ent.name)) out.push(p);
    }
  };
  anda(raiz);
  return out;
}

// Comentário fora antes de qualquer varredura. Os examples comentam MUITO, e
// em português — sem o strip, todo teste abaixo acusaria prosa explicativa.
function semComentario(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("examples — cada um tem dicionário próprio", () => {
  for (const dir of exampleDirs()) {
    it(`${dir} declara os dois idiomas`, () => {
      // O dicionário pode morar em qualquer arquivo (cada example organiza
      // como quiser); o que não é negociável é existir e cobrir os dois.
      const fontes = arquivos(dir, (n) => /\.tsx?$/.test(n))
        .map((p) => readFileSync(p, "utf8"))
        .join("\n");
      expect(/["']pt-BR["']/.test(fontes), `${dir} não referencia pt-BR`).toBe(true);
      expect(/Locale/.test(fontes), `${dir} devia usar o tipo \`Locale\` do pacote`).toBe(true);
    });
  }
});

describe("examples — tradução esquecida não compila", () => {
  // O padrão que o briefing pede é `const en: typeof pt = { ... }`. Sem essa
  // âncora de tipo, chave faltando vira `undefined` e renderiza VAZIO — o
  // pior modo de falha de i18n, porque some da tela sem erro.
  for (const dir of exampleDirs()) {
    it(`${dir} ancora o segundo idioma no tipo do primeiro`, () => {
      const fontes = arquivos(dir, (n) => /\.tsx?$/.test(n))
        .map((p) => semComentario(readFileSync(p, "utf8")))
        .join("\n");
      // Aceita as duas ordens (`en: typeof pt` ou `pt: typeof en`) e a forma
      // com `satisfies`, que dá a mesma garantia.
      const ancorado =
        /:\s*typeof\s+(pt|en|ptBR|PT|EN)\b/.test(fontes) || /satisfies\s+typeof\s+(pt|en|ptBR)/.test(fontes) || /satisfies\s+Dicionario/.test(fontes);
      expect(ancorado, `${dir}: dicionário sem âncora de tipo — chave faltando renderizaria vazio em silêncio`).toBe(true);
    });
  }
});

describe("examples — o DADO não é traduzido", () => {
  // Conteúdo de template e JSON de amostra é o DOCUMENTO do usuário. Um
  // relatório em português continua em português quando a UI vira inglês.
  // Se um desses arquivos passar a depender do `locale`, alguém confundiu as
  // duas coisas.
  for (const dir of exampleDirs()) {
    it(`${dir}: templates e samples não dependem de locale`, () => {
      const dados = arquivos(dir, (n) => /\.tsx?$/.test(n)).filter((p) => /[\\/]data[\\/]/.test(p));
      const ofensores = dados
        .filter((p) => /\blocale\b/.test(semComentario(readFileSync(p, "utf8"))))
        .map((p) => p.slice(p.indexOf("examples")));
      expect(
        ofensores,
        `arquivo de DADO lendo locale — o idioma da interface não é o idioma do documento:\n  ${ofensores.join("\n  ")}`
      ).toEqual([]);
    });
  }
});

describe("examples — nome de idioma não se traduz", () => {
  it("os rótulos do seletor ficam cada um no próprio idioma", () => {
    // `Português` e `English` são convenção: cada um aparece no idioma que
    // nomeia, pra quem não lê o idioma atual conseguir achar o seu.
    const faltando: string[] = [];
    for (const dir of exampleDirs()) {
      const fontes = arquivos(dir, (n) => /\.tsx$/.test(n))
        .map((p) => readFileSync(p, "utf8"))
        .join("\n");
      if (!/Portugu[êe]s/.test(fontes) || !/English/.test(fontes)) faltando.push(dir);
    }
    expect(faltando, `seletor sem os dois nomes de idioma no próprio idioma:\n  ${faltando.join("\n  ")}`).toEqual([]);
  });
});

describe("examples — um seletor só, um estado só", () => {
  for (const dir of exampleDirs()) {
    it(`${dir} não tem estado de idioma duplicado`, () => {
      // Dois estados de idioma é como as duas camadas dessincronizam: o
      // editor num idioma e a casca no outro. O briefing pede reusar o que
      // já existe.
      const fontes = arquivos(dir, (n) => /\.tsx?$/.test(n))
        .map((p) => semComentario(readFileSync(p, "utf8")))
        .join("\n");
      const estados = [...fontes.matchAll(/useState<Locale>/g)].length;
      expect(estados, `${dir} tem ${estados} estados de idioma; devia ter 1`).toBe(1);
    });
  }
});

// ---------------------------------------------------------------------------
// FRASE TRADUZIDA NÃO MORA EM ESTADO.
//
// Esta é a classe de bug mais recorrente desta rodada — apareceu OITO vezes,
// em cinco arquivos que ninguém tinha ligado um ao outro, e nenhuma delas
// falha em teste, em tipo ou em console. O sintoma é sempre o mesmo: a pessoa
// troca o idioma e um pedaço da tela fica na língua anterior, porque aquele
// pedaço não é texto — é uma string que foi CRIADA no idioma antigo e
// guardada.
//
// As oito, pra o guard não nascer abstrato:
//
//   - `errorsById` guardando a mensagem de fonte inválida, em 2 examples (num
//     deles a frase nem era traduzida: inglês cravado dentro de lib/sources.ts,
//     embrulhado num prefixo traduzido — "Erro: Invalid JSON.").
//   - `readError` guardando o `join(" ")` de N frases "não deu pra ler X", em
//     2 examples.
//   - o problema de geração JÁ DESCRITO guardado em estado em vez do erro cru.
//   - `mergeSources(sources, locale)`: função de DADO recebendo idioma, com um
//     `LOCALE_INICIAL` fixo no init preguiçoso do estado — a frase nascia num
//     idioma que o usuário podia nem estar usando.
//
// A regra que sai daí, e que os quatro casos abaixo verificam de ângulos
// diferentes: **estado guarda o motivo, o render resolve o texto.**

// Handles de dicionário usados pelos examples (`t(locale)`, `tt`, `s`, `ui`,
// `shellDict`, `dictFor`). Ler QUALQUER um deles produz texto de interface.
const LEITURA_DE_DICIONARIO = String.raw`(?:t|s|tt|ui|dict|shellDict|dictFor)\s*[.(]`;

describe("examples — frase traduzida não vai pra estado", () => {
  // (1) O SITE QUE JÁ QUEBROU DUAS VEZES. `errorsById` mapeia id de fonte pro
  // que deu errado nela; o valor tem de ser um código, nunca `string`.
  // `string` ali só tem uma origem possível: alguém montou a frase antes.
  it("o valor de errorsById é um código, não string", () => {
    let vistos = 0;
    for (const dir of exampleDirs()) {
      const p = join(EX, dir, "src/lib/sources.ts");
      if (!existsSync(p)) continue;
      vistos++;
      const code = semComentario(readFileSync(p, "utf8"));
      const tipos = [...code.matchAll(/errorsById[^\n]*?Record<string,\s*([A-Za-z]+)\s*>/g)].map((m) => m[1]);
      expect(tipos.length, `${dir}: nenhum Record<string, …> de errorsById achado`).toBeGreaterThan(0);
      for (const tipo of tipos) {
        expect(tipo, `${dir}/src/lib/sources.ts: errorsById guarda ${tipo} — tem de ser um código de razão`).not.toBe(
          "string"
        );
      }
    }
    // Anti-vacuidade: se `lib/sources.ts` for renomeado, o loop acima passa
    // sem examinar nada.
    expect(vistos, "nenhum lib/sources.ts encontrado — o teste passaria vazio").toBeGreaterThan(3);
  });

  // (2) O gesto que congela: passar leitura de dicionário direto pra um setter
  // de estado. Pega `setReadError(s.sources.unreadable(nome))` e
  // `setGenError(describeGenerationError(err))` — as duas formas reais.
  it("nenhum setter de estado recebe texto de dicionário", () => {
    const re = new RegExp(String.raw`\bset[A-Z]\w*\(\s*(?:` + LEITURA_DE_DICIONARIO + String.raw`|describe\w*\()`, "g");
    const ofensas: string[] = [];
    for (const dir of exampleDirs()) {
      for (const p of arquivos(dir, (n) => n.endsWith(".ts") || n.endsWith(".tsx"))) {
        for (const m of semComentario(readFileSync(p, "utf8")).matchAll(re)) {
          ofensas.push(`${dir}: ${m[0].trim()}`);
        }
      }
    }
    expect(ofensas, "estado guarda texto; deveria guardar o motivo e traduzir no render").toEqual([]);
  });

  // (3) A variante que escapa do caso (2): montar a frase DENTRO de um
  // `new Error(...)` e deixar a mensagem virar o texto de UI mais na frente.
  // Foi exatamente o que os dois `readFileAsText` faziam. Mensagem de `Error`
  // é diagnóstico — inglês, pra console e pra issue.
  it("nenhum new Error() é construído com texto de dicionário", () => {
    const re = new RegExp(String.raw`new Error\(\s*` + LEITURA_DE_DICIONARIO, "g");
    const ofensas: string[] = [];
    for (const dir of exampleDirs()) {
      for (const p of arquivos(dir, (n) => n.endsWith(".ts") || n.endsWith(".tsx"))) {
        for (const m of semComentario(readFileSync(p, "utf8")).matchAll(re)) {
          ofensas.push(`${dir}: ${m[0].trim()}`);
        }
      }
    }
    expect(ofensas, "mensagem de Error é diagnóstico, não interface").toEqual([]);
  });

  // (4) CONTROLE POSITIVO dos três acima. Eles são todos proibições, e
  // proibição fica verde num example que simplesmente não tem o recurso. Este
  // afirma o lado positivo: a classificação de falha existe nos cinco e é
  // chamada com o `locale` DAQUELE render. Uma chamada sem `locale` não pode
  // estar traduzindo no idioma corrente.
  it("todo describeGenerationError recebe o locale do render", () => {
    let comChamada = 0;
    for (const dir of exampleDirs()) {
      const chamadas = arquivos(dir, (n) => n.endsWith(".tsx"))
        .flatMap((p) => [...semComentario(readFileSync(p, "utf8")).matchAll(/describeGenerationError\(([^)]*)\)/g)])
        .map((m) => m[1]);
      if (chamadas.length === 0) continue;
      comChamada++;
      for (const args of chamadas) {
        expect(args, `${dir}: describeGenerationError(${args}) não recebe locale`).toMatch(/\blocale\b/);
      }
    }
    expect(comChamada, "nenhum example classifica falha de geração — o guard acima passaria vazio").toBeGreaterThan(3);
  });
});
