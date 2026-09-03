import { readFileSync } from "./support/read";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

// Guards da DOCUMENTAÇÃO.
//
// Prosa apodrece em silêncio: nada falha quando um doc passa a mentir. E dois
// itens específicos aqui não são prosa — eles QUEBRAM O BUILD do site, e o
// build do site não roda no `npm test`:
//
//   `website/docusaurus.config.js` tem `onBrokenLinks: "throw"`. Uma entrada
//   de sidebar apontando pra doc deletado ABORTA o `docusaurus build`. E o id
//   de doc é compartilhado entre locales, então um espelho pt-BR órfão faz o
//   sidebar de pt-BR divergir do de inglês.
//
// Estes testes rodam no `npm test`, que roda no `prepublishOnly` — então o
// erro aparece antes de publicar, e não no deploy.

const RAIZ = join(__dirname, "..");
const DOCS_EN = join(RAIZ, "website", "docs");
const DOCS_PT = join(RAIZ, "website", "i18n", "pt-BR", "docusaurus-plugin-content-docs", "current");

function paginas(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".mdx") || f.endsWith(".md"))
    .map((f) => f.replace(/\.mdx?$/, ""))
    .sort();
}

// O sidebar virou ANINHADO (1 doc + 6 categorias), e a leitura por regex que
// existia aqui não sobrevive a isso por dois motivos independentes:
//
//   - `[([\s\S]*?)]` é non-greedy, então parava no PRIMEIRO `]` — que agora
//     é o fechamento do `items:` da primeira categoria, não o do sidebar;
//   - toda string entre aspas virava "id de doc", então os rótulos
//     ("Getting started", "category", "Reference") seriam acusados de página
//     inexistente.
//
// Ler o arquivo de verdade elimina as duas classes de erro de uma vez, e é o
// mesmo objeto que o Docusaurus consome — não uma aproximação dele.
function ehCategoria(n: unknown): n is { type: "category"; label: string; items: unknown[] } {
  return typeof n === "object" && n !== null && (n as { type?: string }).type === "category";
}

function coletaIds(nos: unknown[], fora: string[]): void {
  for (const n of nos) {
    if (typeof n === "string") fora.push(n);
    else if (ehCategoria(n)) coletaIds(n.items, fora);
    else if (typeof n === "object" && n !== null && "id" in n) {
      fora.push(String((n as { id: unknown }).id));
    }
  }
}

function coletaRotulos(nos: unknown[], fora: string[]): void {
  for (const n of nos) {
    if (ehCategoria(n)) {
      fora.push(n.label);
      coletaRotulos(n.items, fora);
    }
  }
}

// `sidebars.js` é ESM com `export default`; vitest importa direto.
const sidebarModulo = (await import(pathToFileURL(join(RAIZ, "website", "sidebars.js")).href)) as {
  default: { docsSidebar: unknown[] };
};
const SIDEBAR = sidebarModulo.default.docsSidebar;

function idsDoSidebar(): string[] {
  const out: string[] = [];
  coletaIds(SIDEBAR, out);
  return out;
}

function rotulosDeCategoria(): string[] {
  const out: string[] = [];
  coletaRotulos(SIDEBAR, out);
  return out;
}

describe("website — o sidebar e as páginas concordam", () => {
  const ids = idsDoSidebar();

  it("nenhum id aparece em duas categorias", () => {
    // Página em dois lugares do sidebar não é erro pro Docusaurus: ele
    // simplesmente desenha ela duas vezes, e a navegação anterior/próxima
    // fica ambígua.
    const vistos = new Set<string>();
    const repetidos = ids.filter((id) => (vistos.has(id) ? true : (vistos.add(id), false)));
    expect(repetidos, `id repetido no sidebar:\n  ${repetidos.join("\n  ")}`).toEqual([]);
  });

  it("todo rótulo de categoria tem tradução pt-BR", () => {
    // Categoria sem entrada no current.json aparece EM INGLÊS no site
    // pt-BR, sem erro, sem aviso — só metade da coluna traduzida.
    const traducoes = JSON.parse(
      readFileSync(join(RAIZ, "website/i18n/pt-BR/docusaurus-plugin-content-docs/current.json"), "utf8")
    ) as Record<string, { message?: string }>;
    const faltando = rotulosDeCategoria().filter(
      (rotulo) => !traducoes[`sidebar.docsSidebar.category.${rotulo}`]?.message
    );
    expect(faltando, `categoria sem tradução em current.json:\n  ${faltando.join("\n  ")}`).toEqual([]);
  });

  it("nenhuma tradução de categoria ficou órfã", () => {
    // Anti-vacuidade do caso acima: renomear a categoria e esquecer a chave
    // antiga deixa uma tradução que nunca é usada, e o caso de cima passa.
    const traducoes = JSON.parse(
      readFileSync(join(RAIZ, "website/i18n/pt-BR/docusaurus-plugin-content-docs/current.json"), "utf8")
    ) as Record<string, unknown>;
    const rotulos = new Set(rotulosDeCategoria());
    const orfas = Object.keys(traducoes)
      .filter((k) => k.startsWith("sidebar.docsSidebar.category."))
      .map((k) => k.replace("sidebar.docsSidebar.category.", ""))
      .filter((r) => !rotulos.has(r));
    expect(orfas, `tradução de categoria que não existe mais:\n  ${orfas.join("\n  ")}`).toEqual([]);
  });

  const en = paginas(DOCS_EN);

  it("toda entrada do sidebar tem página em inglês", () => {
    // ESTE é o que aborta o `docusaurus build`. Foi o modo de falha real na
    // 3.0.0: `"tailwind-setup"` ficou na linha 8 depois de a página ser
    // deletada.
    const orfas = ids.filter((id) => !en.includes(id));
    expect(orfas, `entrada de sidebar sem página — ABORTA o docusaurus build:\n  ${orfas.join("\n  ")}`).toEqual([]);
  });

  it("toda página em inglês está no sidebar", () => {
    // O outro lado: página criada e esquecida fica inalcançável pela
    // navegação. Não quebra o build, só desaparece.
    const soltas = en.filter((p) => !ids.includes(p));
    expect(soltas, `página fora do sidebar — ninguém acha:\n  ${soltas.join("\n  ")}`).toEqual([]);
  });

  it("toda página em inglês tem espelho pt-BR", () => {
    // O id de doc é compartilhado entre locales. Sem o espelho, o sidebar de
    // pt-BR divergir do de inglês.
    const pt = paginas(DOCS_PT);
    const semEspelho = en.filter((p) => !pt.includes(p));
    expect(semEspelho, `página sem espelho pt-BR:\n  ${semEspelho.join("\n  ")}`).toEqual([]);
  });

  it("nenhum espelho pt-BR ficou órfão", () => {
    // O inverso: deletar a página em inglês e esquecer o espelho.
    const pt = paginas(DOCS_PT);
    const orfaos = pt.filter((p) => !en.includes(p));
    expect(orfaos, `espelho pt-BR sem página em inglês:\n  ${orfaos.join("\n  ")}`).toEqual([]);
  });
});

// Arquivos de prosa que a 3.0.0 tocou. Comentário de código NÃO entra aqui —
// esses podem falar do passado ("o style.css do 2.x era...") legitimamente.
function arquivosDeProsa(): Array<{ rel: string; texto: string }> {
  const alvos: string[] = [
    "README.md",
    "README.pt-BR.md",
    "CHANGELOG.md",
    "CHANGELOG.pt-BR.md",
    ...readdirSync(join(RAIZ, "docs"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => `docs/${f}`),
    ...paginas(DOCS_EN).map((p) => `website/docs/${p}.mdx`),
    ...paginas(DOCS_PT).map((p) => `website/i18n/pt-BR/docusaurus-plugin-content-docs/current/${p}.mdx`),
  ];
  return alvos
    .filter((rel) => existsSync(join(RAIZ, rel)))
    .map((rel) => ({ rel, texto: readFileSync(join(RAIZ, rel), "utf8") }));
}

describe("docs — nada recomenda o que não existe mais", () => {
  const prosa = arquivosDeProsa();

  it("controle: a varredura acha arquivos de verdade", () => {
    // Sem isto, um caminho errado faria todo teste abaixo passar vazio.
    expect(prosa.length, "a lista de arquivos de prosa veio vazia").toBeGreaterThan(20);
  });

  it("ninguém manda importar `json-pdf-designer/style.css`", () => {
    // O export saiu SEM alias, então o import antigo agora dá
    // ERR_PACKAGE_PATH_NOT_EXPORTED. Um doc que ainda o recomende manda o
    // leitor direto pro erro.
    //
    // Menção HISTÓRICA é permitida (o CHANGELOG precisa falar do que saiu), e
    // o jeito de dizer isso é escrever a linha de import de verdade só onde
    // ela funciona. O teste procura a FORMA DE IMPORT, não a palavra.
    //
    // Linha de REMOÇÃO de diff é permitida, e é obrigatória: o CHANGELOG e o
    // guia de migração mostram a troca justamente assim —
    //
    //     - import "json-pdf-designer/style.css";
    //     + import "json-pdf-designer/theme.css";
    //
    // A primeira versão deste teste não fazia essa distinção e acusava os dois
    // CHANGELOGs mais as duas páginas de migração. Era falso positivo do
    // TESTE: nenhum deles recomendava nada, os quatro mostravam o diff certo.
    const IMPORT_ANTIGO = /(?:import|@import|require\()\s*["']json-pdf-designer\/style\.css["']/;
    const ofensores = prosa
      .filter(({ texto }) =>
        texto
          .split("\n")
          // fora as linhas de remoção de diff, e o `~~riscado~~`, que é a
          // outra forma de dizer "isto era assim".
          .filter((linha) => !/^\s*[-~]/.test(linha))
          .some((linha) => IMPORT_ANTIGO.test(linha))
      )
      .map(({ rel }) => rel);
    expect(ofensores, `doc mandando importar o style.css, que não existe mais:\n  ${ofensores.join("\n  ")}`).toEqual([]);
  });

  it("ninguém manda o Tailwind do consumidor escanear o pacote", () => {
    // Sem utilitária no `dist`, uma receita de `@source`/`content` apontando
    // pro pacote não produz NADA — e não dá erro. É o pior tipo de conselho
    // velho: silenciosamente inútil.
    const ofensores = prosa
      .filter(({ texto }) => /@source\s+["'][^"']*json-pdf-designer/.test(texto) || /content:\s*\[[^\]]*json-pdf-designer[^\]]*\]/.test(texto))
      .map(({ rel }) => rel);
    expect(ofensores, `doc mandando escanear o pacote com Tailwind — não há mais o que escanear:\n  ${ofensores.join("\n  ")}`).toEqual([]);
  });

  it("o `theme.css` está documentado em algum lugar", () => {
    // Controle positivo do teste acima: se alguém "consertar" o style.css
    // apagando a linha em vez de trocá-la, isto pega.
    const mencionam = prosa.filter(({ texto }) => /json-pdf-designer\/theme\.css/.test(texto)).map(({ rel }) => rel);
    expect(mencionam.length, "nenhum doc menciona o theme.css — o substituto ficou sem documentação").toBeGreaterThan(3);
  });
});

describe("docs — a lista de examples bate com o disco", () => {
  const noDisco = readdirSync(join(RAIZ, "examples"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  it("cada example em examples/ tem README", () => {
    const semReadme = noDisco.filter((n) => !existsSync(join(RAIZ, "examples", n, "README.md")));
    expect(semReadme, `example sem README:\n  ${semReadme.join("\n  ")}`).toEqual([]);
  });

  it("a página de examples do site cita todos", () => {
    // O `intro.mdx` dizia "three live variants" quando já eram quatro — este
    // é o tipo de drift que ninguém nota.
    const pagina = readFileSync(join(DOCS_EN, "examples.mdx"), "utf8");
    const faltando = noDisco.filter((n) => !pagina.includes(n));
    expect(faltando, `example no disco e ausente da página examples.mdx:\n  ${faltando.join("\n  ")}`).toEqual([]);
  });

  it("cada example tem entrada em .claude/launch.json", () => {
    // É o que faz o preview subir. Example novo sem entrada não dá erro —
    // simplesmente não tem como rodar.
    const launch = readFileSync(join(RAIZ, ".claude", "launch.json"), "utf8");
    const faltando = noDisco.filter((n) => !launch.includes(`examples/${n}`));
    expect(faltando, `example sem configuração de dev server:\n  ${faltando.join("\n  ")}`).toEqual([]);
  });

  // Os dois workflows que BUILDAM os examples, nas duas direções. Sem isto,
  // example novo nasce sem gate nenhum: `npm test` na raiz não olha
  // examples/, e o build do pacote não os toca. Foi assim que três examples
  // ficaram sem compilar sem nada acusar.
  //
  // As duas direções importam por motivos diferentes: faltando, o example não
  // é testado; sobrando, o job falha num `working-directory` que não existe.
  //
  // Cada workflow declara os examples numa FORMA diferente, e por isso o
  // extrator é por arquivo em vez de um regex só:
  //
  //   ci.yml     — uma `strategy.matrix` de nomes nus, com um passo só usando
  //                `examples/${{ matrix.example }}`. Varrer `examples/<nome>`
  //                aqui não acha NADA, e a primeira versão deste teste passou
  //                vazia por isso (o caso de controle abaixo é quem pegou).
  //   pages.yml  — um passo por example, cada um com `working-directory:
  //                examples/<nome>`.
  const NOS_WORKFLOWS: { arquivo: string; rotulo: string; extrai: (wf: string) => string[] }[] = [
    {
      arquivo: ".github/workflows/ci.yml",
      rotulo: "gate de PR",
      extrai: (wf) => {
        const bloco = /matrix:\n(?:[^\n]*\n)*?\s*example:\n((?:\s*- [a-z][a-z0-9-]*\n)+)/.exec(wf);
        if (!bloco) return [];
        return [...bloco[1].matchAll(/- ([a-z][a-z0-9-]*)/g)].map((m) => m[1]);
      },
    },
    {
      arquivo: ".github/workflows/pages.yml",
      rotulo: "deploy do playground",
      extrai: (wf) => [...wf.matchAll(/working-directory: examples\/([a-z][a-z0-9-]*)/g)].map((m) => m[1]),
    },
  ];

  for (const { arquivo, rotulo, extrai } of NOS_WORKFLOWS) {
    it(`${arquivo} builda exatamente os examples do disco (${rotulo})`, () => {
      const cobertos = [...new Set(extrai(readFileSync(join(RAIZ, arquivo), "utf8")))].sort();

      const faltando = noDisco.filter((n) => !cobertos.includes(n));
      expect(faltando, `example no disco que ${arquivo} não builda:\n  ${faltando.join("\n  ")}`).toEqual([]);

      const orfaos = cobertos.filter((n) => !noDisco.includes(n));
      expect(orfaos, `${arquivo} builda example que não existe:\n  ${orfaos.join("\n  ")}`).toEqual([]);
    });
  }

  it("controle: os extratores de workflow acham os examples de verdade", () => {
    // Anti-vacuidade dos dois casos acima, e não é hipotético: o extrator do
    // ci.yml JÁ nasceu devolvendo lista vazia, e sem este caso os dois testes
    // teriam ficado verdes sobre nada.
    for (const { arquivo, extrai } of NOS_WORKFLOWS) {
      const achados = extrai(readFileSync(join(RAIZ, arquivo), "utf8"));
      expect(achados.length, `o extrator de ${arquivo} não achou example nenhum`).toBe(noDisco.length);
    }
    expect(noDisco.length, "nenhum example no disco").toBeGreaterThan(3);
  });
});

// Link interno com âncora: `[texto](docs/USAGE.md#alguma-secao)`.
//
// É o drift que quase passou na 3.0.0: um agente escreveu quatro links pra
// `#styling-and-theming` / `#estilo-e-tema` antes de a seção existir, e só não
// quebrou porque a seção nasceu com o título exato. Nada teria avisado.
//
// GitHub gera a âncora a partir do texto do heading: minúsculas, espaço vira
// hífen, e pontuação cai fora — mas LETRA ACENTUADA FICA.
//
// A primeira versão disto usava `[^\w\s-]`, e `\w` em JS não cobre acento:
// ela comia o `ç` e o `ã` e acusava de âncora morta dois links CORRETOS do
// README.pt-BR.md (`#...derrubar-uma-geração`, `#uso-só-no-servidor-...`).
// Era bug do teste. `\p{L}\p{N}` com a flag `u` resolve.
function ancoraDe(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    // tira markdown inline (`código`, **negrito**) antes de gerar a âncora
    .replace(/[`*_]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

function headingsDe(texto: string): Set<string> {
  return new Set([...texto.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => ancoraDe(m[1])));
}

describe("docs — link com âncora aponta pra heading que existe", () => {
  // Só markdown do repo (não o website — lá o Docusaurus já tem
  // `onBrokenLinks: "throw"`, que é um guard melhor que este).
  const fontes = [
    "README.md",
    "README.pt-BR.md",
    ...readdirSync(join(RAIZ, "docs"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => `docs/${f}`),
    ...readdirSync(join(RAIZ, "examples"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => `examples/${d.name}/README.md`),
  ].filter((rel) => existsSync(join(RAIZ, rel)));

  const quebrados: string[] = [];
  for (const rel of fontes) {
    const texto = readFileSync(join(RAIZ, rel), "utf8");
    const baseDir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
    for (const m of texto.matchAll(/\]\(([^)\s#]+\.md)#([^)\s]+)\)/g)) {
      const [, destinoRel, ancora] = m;
      // Resolve relativo ao arquivo que linka.
      const partes = (baseDir ? `${baseDir}/${destinoRel}` : destinoRel).split("/");
      const limpo: string[] = [];
      for (const p of partes) {
        if (p === "..") limpo.pop();
        else if (p !== ".") limpo.push(p);
      }
      const destino = join(RAIZ, ...limpo);
      if (!existsSync(destino)) {
        quebrados.push(`${rel} -> ${destinoRel} (arquivo não existe)`);
        continue;
      }
      if (!headingsDe(readFileSync(destino, "utf8")).has(ancora)) {
        quebrados.push(`${rel} -> ${destinoRel}#${ancora} (heading não existe)`);
      }
    }
  }

  it("nenhuma âncora aponta pra heading inexistente", () => {
    expect(quebrados, `link com âncora morta:\n  ${quebrados.join("\n  ")}`).toEqual([]);
  });

  it("controle: a varredura acha links de verdade", () => {
    // Sem isto, um regex quebrado passaria vazio e não guardaria nada.
    const total = fontes.reduce(
      (n, rel) => n + [...readFileSync(join(RAIZ, rel), "utf8").matchAll(/\]\(([^)\s#]+\.md)#([^)\s]+)\)/g)].length,
      0
    );
    expect(total, "nenhum link com âncora encontrado — a varredura não guarda nada").toBeGreaterThan(2);
  });
});

// Admonition do Docusaurus com TÍTULO INLINE não renderiza nesta versão.
//
// Achado durante a 3.0.0, e é invisível: no Docusaurus 3.10 deste site,
// `:::tip Título` vaza pra página como texto literal `:::` em vez de virar
// um bloco. A forma que funciona é `:::tip[Título]`. Nenhum doc anterior
// usava admonition, então ninguém tinha topado — o `tailwind-setup.mdx`
// deletado tinha um `:::tip` silenciosamente quebrado.
//
// `:::caution` também saiu na v3 — virou `:::warning`.
describe("website — admonitions na forma que renderiza", () => {
  const mdx = [
    ...paginas(DOCS_EN).map((p) => ({ rel: `website/docs/${p}.mdx`, dir: DOCS_EN, nome: p })),
    ...paginas(DOCS_PT).map((p) => ({ rel: `website/i18n/pt-BR/.../${p}.mdx`, dir: DOCS_PT, nome: p })),
  ].map(({ rel, dir, nome }) => ({ rel, texto: readFileSync(join(dir, `${nome}.mdx`), "utf8") }));

  it("nenhum título inline (`:::tip Título`) — só a forma com colchete", () => {
    const ofensores: string[] = [];
    for (const { rel, texto } of mdx) {
      for (const [i, linha] of texto.split("\n").entries()) {
        // Abertura de admonition seguida de espaço e mais texto na mesma
        // linha = título inline. `:::tip[Título]` e `:::tip` sozinho passam.
        if (/^:::[a-z]+\s+\S/.test(linha)) ofensores.push(`${rel}:${i + 1}  ${linha.trim()}`);
      }
    }
    expect(ofensores, `título inline de admonition vaza como ":::" literal na página:\n  ${ofensores.join("\n  ")}`).toEqual([]);
  });

  it("nenhum `:::caution` — a v3 renomeou pra `warning`", () => {
    const ofensores = mdx.filter(({ texto }) => /^:::caution/m.test(texto)).map(({ rel }) => rel);
    expect(ofensores, `:::caution não existe mais na v3:\n  ${ofensores.join("\n  ")}`).toEqual([]);
  });

  it("controle: o site REALMENTE usa admonition (senão a varredura é vácuo)", () => {
    const comAdmonition = mdx.filter(({ texto }) => /^:::[a-z]+/m.test(texto)).length;
    expect(comAdmonition, "nenhuma admonition no site — a varredura acima não guarda nada").toBeGreaterThan(0);
  });
});

// O ESPECTRO DE ESTILO DOS EXAMPLES.
//
// Cada example demonstra um ponto diferente de "quanto do nosso CSS você
// usa", e juntos eles dão cobertura aos dois exports de CSS mais o modo sem
// nenhum. É contrato de documentação: a doc descreve esse mapa, e se um
// example trocar de import sem a doc trocar junto, a doc passa a mentir.
//
// Sem este guard nada avisa — o example continua compilando e rodando.
const ESPECTRO: Record<string, { importa: string[]; prova: string }> = {
  // O caminho pronto: importa o tema e não mexe em nada.
  "report-builder": { importa: ["theme.css"], prova: "tema default, sem customização" },
  // Importa o tema inteiro e retematiza SÓ trocando valores de `--jpd-*`.
  "composed-layout": { importa: ["theme.css"], prova: "retema por token" },
  // Importa o tema e liga o dark pelo atributo `[data-jpd-theme]`.
  "no-preview": { importa: ["theme.css"], prova: "dark mode pelo atributo" },
  // Só o reset, sem aparência nenhuma — o único que exercita esse export.
  "headless-designer": { importa: ["reset.css"], prova: "reset avulso" },
  // Nenhum CSS do pacote: escreve as ~190 classes `.jpd-*` do zero.
  "custom-ui": { importa: [], prova: "sem CSS do pacote" },
};

describe("examples — o espectro de estilo está intacto", () => {
  function importsDeCssDoPacote(dir: string): string[] {
    // RECURSIVO, e isto importa: a primeira versão deste helper só lia os
    // `.tsx` da RAIZ de `src/`, então um example que movesse o import de CSS
    // pra dentro de `src/components/` escaparia do guard em silêncio. Foi
    // apontado durante a rodada de paridade, quando os examples ganharam
    // subpastas.
    const achados: string[] = [];
    const anda = (d: string) => {
      for (const ent of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, ent.name);
        if (ent.isDirectory()) {
          anda(p);
          continue;
        }
        if (!/\.tsx?$/.test(ent.name)) continue;
        // Linha de import DE VERDADE, não menção em comentário — por isso o
        // `^import` ancorado. (O custom-ui tem um comentário que nomeia os
        // dois arquivos justamente pra dizer que não importa nenhum.)
        for (const m of readFileSync(p, "utf8").matchAll(/^import\s+"json-pdf-designer\/([a-z]+\.css)";/gm)) achados.push(m[1]);
      }
    };
    anda(join(RAIZ, "examples", dir, "src"));
    return achados.sort();
  }

  for (const [dir, { importa, prova }] of Object.entries(ESPECTRO)) {
    it(`${dir}: ${prova}`, () => {
      expect(importsDeCssDoPacote(dir), `o CSS que o ${dir} importa mudou — a doc que descreve o espectro precisa mudar junto`).toEqual(
        [...importa].sort()
      );
    });
  }

  it("os cinco examples estão cobertos, e só eles", () => {
    const noDisco = readdirSync(join(RAIZ, "examples"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(noDisco).toEqual(Object.keys(ESPECTRO).sort());
  });

  it("os dois exports de CSS têm cobertura", () => {
    // O motivo de o espectro existir: até a 3.0.0 o `reset.css` era export
    // público com ZERO example usando.
    const todos = Object.values(ESPECTRO).flatMap((e) => e.importa);
    expect(todos, "reset.css sem nenhum example").toContain("reset.css");
    expect(todos, "theme.css sem nenhum example").toContain("theme.css");
  });

  it("headless-designer declara o token que o PdfPreview lê inline", () => {
    // A pegadinha do modo só-reset: `PdfPreview.tsx` faz
    // `canvas.style.boxShadow = "var(--jpd-shadow-page-preview)"`. O
    // `reset.css` não declara token de aparência, então sem o example
    // declarar, o `var()` fica inválido e a sombra desaparece calada.
    const css = readFileSync(join(RAIZ, "examples", "headless-designer", "src", "index.css"), "utf8");
    expect(/--jpd-shadow-page-preview\s*:/.test(css), "sem este token o canvas do preview perde a sombra em silêncio").toBe(true);
  });

  it("no-preview usa o atributo de tema, não a classe alias", () => {
    const app = readFileSync(join(RAIZ, "examples", "no-preview", "src", "App.tsx"), "utf8");
    expect(/data-jpd-theme/.test(app), "o hook documentado é `data-jpd-theme`").toBe(true);
  });

  it("composed-layout sobrescreve token de accent, e não regra", () => {
    const css = readFileSync(join(RAIZ, "examples", "composed-layout", "src", "index.css"), "utf8");
    expect(/--jpd-accent\s*:/.test(css), "o retema por token é o ponto deste example").toBe(true);
    // Se ele passar a reescrever regra `.jpd-*`, deixa de demonstrar
    // "retema sem tocar em CSS" e vira um custom-ui pior.
    expect(/^\s*\.jpd-[a-z-]+\s*\{/m.test(css), "regra `.jpd-*` aqui descaracteriza o example — use token").toBe(false);
  });
});

// ---------------------------------------------------------------------------
// OS LINKS DO PLAYGROUND, que ninguém valida.
//
// Cada example vira um bundle estático separado, copiado pra
// `playground/<slug>/` só no passo de deploy. Consequência: esses links NÃO
// existem no build local, e o `onBrokenLinks: "throw"` do Docusaurus não
// alcança nenhum deles — os do footer são `html:` cru, e os da página do
// playground são `<a href>` normal fora do grafo de rotas.
//
// Então o mesmo slug está escrito à mão em TRÊS lugares, e nada os liga:
//
//   1. `website/src/pages/playground/index.js`  — os cartões
//   2. `website/docusaurus.config.js`           — o footer, em TODAS as páginas
//   3. `.github/workflows/pages.yml`            — quem copia o bundle
//
// Renomear um example, ou adicionar um, quebra 52 páginas × 5 links em
// silêncio: o link continua lá, o destino nunca é montado, e o build passa.
// Medido rastreando o build: 2128 links internos, e esses 5 eram os únicos
// alvos que não existiam.
// ---------------------------------------------------------------------------

describe("website — os links do playground apontam pra examples que existem", () => {
  const noDisco = readdirSync(join(RAIZ, "examples"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  const daPagina = [
    ...readFileSync(join(RAIZ, "website/src/pages/playground/index.js"), "utf8").matchAll(
      /slug:\s*["']([a-z0-9-]+)["']/g
    ),
  ]
    .map((m) => m[1])
    .sort();

  const doFooter = [
    ...readFileSync(join(RAIZ, "website/docusaurus.config.js"), "utf8").matchAll(
      /\/json-pdf-designer\/playground\/([a-z0-9-]+)\//g
    ),
  ]
    .map((m) => m[1])
    .sort();

  const doDeploy = [
    ...readFileSync(join(RAIZ, ".github/workflows/pages.yml"), "utf8").matchAll(
      /site-dist\/playground\/([a-z0-9-]+)/g
    ),
  ]
    .map((m) => m[1])
    .sort();

  it("controle: as três listas foram realmente encontradas", () => {
    // Sem isto, um regex que deixa de casar faz os três casos abaixo
    // compararem listas vazias entre si e passarem.
    expect(daPagina.length, "nenhum slug lido da página do playground").toBe(noDisco.length);
    expect(doFooter.length, "nenhum slug lido do footer").toBe(noDisco.length);
    expect(doDeploy.length, "nenhum slug lido do pages.yml").toBe(noDisco.length);
  });

  it("os cartões do playground cobrem exatamente os examples do disco", () => {
    expect(daPagina).toEqual(noDisco);
  });

  it("o footer aponta exatamente pros examples do disco", () => {
    // Este é o pior dos três: o footer é renderizado em toda página do site.
    expect(doFooter).toEqual(noDisco);
  });

  it("o deploy monta exatamente os destinos que os links usam", () => {
    // Se o pages.yml não copiar um slug que os links citam, o link vira 404
    // em produção — e nada no build local acusa.
    expect(doDeploy).toEqual(noDisco);
  });
});
