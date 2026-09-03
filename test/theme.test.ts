import { readFileSync } from "./support/read";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { classLiterals, relativeToSrc, sourceFiles, stripComments, tokensOf } from "./support/classScan";

// Guards do src/css/theme.css.
//
// A folha é escrita à mão, então não tem compilador conferindo nada por trás.
// Estes testes cobrem as quatro coisas que, quando quebram, quebram EM
// SILÊNCIO — nenhuma delas dá erro de build nem aparece no console.
const THEME_RAW = readFileSync(join(__dirname, "..", "src", "css", "theme.css"), "utf8");
// O reset vive em arquivo separado (publicado como `json-pdf-designer/reset.css`
// pra quem estiliza do zero) e o theme o importa. Os guards valem pra folha
// EFETIVA, então leem os dois.
const RESET_RAW = readFileSync(join(__dirname, "..", "src", "css", "reset.css"), "utf8");
const RAW = [THEME_RAW, RESET_RAW].join("\n");

// Comentário FORA antes de qualquer varredura. Não é zelo: o cabeçalho deste
// arquivo documenta a própria sintaxe que os testes procuram — tem um
// `@layer json-pdf-designer, minhas-utilitarias;` de exemplo e um
// `*{box-sizing}` citado em prosa. Sem remover, o teste da @layer acha a
// menção no comentário em vez da regra, e o teste do `*` acusa a prosa.
const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g, "");

// Blocos de token: :root (light), o par [data-jpd-theme="dark"]/.dark, e a
// ilha de light. Recorta por chave, contando profundidade.
const THEME_CSS = THEME_RAW.replace(/\/\*[\s\S]*?\*\//g, "");

function block(startsWith: string): string {
  const at = THEME_CSS.indexOf(startsWith);
  if (at === -1) throw new Error(`bloco não encontrado: ${startsWith}`);
  const open = THEME_CSS.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < THEME_CSS.length; i++) {
    if (THEME_CSS[i] === "{") depth++;
    else if (THEME_CSS[i] === "}") {
      depth--;
      if (depth === 0) return THEME_CSS.slice(open + 1, i);
    }
  }
  throw new Error(`bloco não fecha: ${startsWith}`);
}

// NOME distinto do `tokensOf` importado de classScan (que quebra lista de
// CLASSE por espaço) — os dois na mesma escopo, o local sombreava o
// importado e o conjunto de "classes usadas" saía vazio, fazendo o teste
// da outra direção passar VAZIO. Falso verde.
function cssVarsOf(source: string): string[] {
  return [...source.matchAll(/(--jpd-[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
}

const lightTokens = cssVarsOf(block("  :root {"));
const darkTokens = cssVarsOf(block('[data-jpd-theme="dark"],'));
const islandTokens = cssVarsOf(block('[data-jpd-theme="light"] {'));

describe("theme.css — tokens", () => {
  it("declara token no :root", () => {
    expect(lightTokens.length).toBeGreaterThan(60);
  });

  it("não declara o mesmo token duas vezes no mesmo bloco", () => {
    for (const [name, list] of [
      ["light", lightTokens],
      ["dark", darkTokens],
      ["ilha de light", islandTokens],
    ] as const) {
      const dupes = list.filter((t, i) => list.indexOf(t) !== i);
      expect(dupes, `token duplicado no bloco ${name}: ${dupes.join(", ")}`).toEqual([]);
    }
  });

  it("todo token do bloco dark existe no :root", () => {
    // O contrário NÃO é exigido: muitos tokens são iguais nos dois temas (o
    // canvas é uma folha de papel), e repetir valor idêntico no dark só
    // criaria linha pra dessincronizar.
    const light = new Set(lightTokens);
    const orphans = darkTokens.filter((t) => !light.has(t));
    expect(orphans, `token só existe no dark, então nunca tem valor em light:\n  ${orphans.join("\n  ")}`).toEqual([]);
  });

  it("a ilha de light re-afirma exatamente o que o dark sobrescreve", () => {
    // Sem isto, `data-jpd-theme="light"` dentro de um app escuro deixaria
    // vazar o valor escuro de qualquer token que o dark troca e a ilha
    // esquece — e o vazamento é invisível até alguém usar ilha.
    const dark = new Set(darkTokens);
    const island = new Set(islandTokens);
    const missing = [...dark].filter((t) => !island.has(t));
    expect(missing, `o dark troca estes tokens e a ilha de light não os devolve:\n  ${missing.join("\n  ")}`).toEqual([]);
  });

  it("todo var(--jpd-*) usado no arquivo está declarado", () => {
    const used = new Set([...CSS.matchAll(/var\((--jpd-[a-z0-9-]+)/g)].map((m) => m[1]));
    const declared = new Set([...lightTokens, ...darkTokens, ...islandTokens]);
    const undeclared = [...used].filter((t) => !declared.has(t));
    expect(undeclared, `var() aponta pra token que não existe (resolve pra nada, sem erro):\n  ${undeclared.join("\n  ")}`).toEqual([]);
  });
});

describe("theme.css — as armadilhas de reescrever Tailwind à mão", () => {
  it("o reset de borda usa `0 solid`, nunca `0`", () => {
    // `border: 0` zera a largura E põe border-style: none, então qualquer
    // `border-width` posterior (do nosso CSS ou do consumidor) computa 0 e a
    // borda não aparece. O Preflight escrevia `border: 0 solid` por isso.
    // Verificado no navegador: com `border: 0`, um `.jpd-btn{border-width:4px}`
    // do consumidor computava `0px`.
    expect(CSS).toContain("border: 0 solid");
    expect(CSS, "encontrado `border: 0;` — use `border: 0 solid;`").not.toMatch(/border:\s*0\s*;/);
  });

  it("só existe um seletor com `*`, e ele é escopado dentro de :where()", () => {
    // O `*{box-sizing}` do Preflight era global e caía no app do consumidor.
    // Este arquivo não pode reintroduzir isso.
    const starRules = [...CSS.matchAll(/^[^\S\n]*([^\n{}]*\*[^\n{}]*)\{/gm)].map((m) => m[1].trim());
    for (const selector of starRules) {
      expect(selector, `seletor com \`*\` fora de :where(): ${selector}`).toMatch(/:where\(/);
    }
    expect(starRules.length).toBeGreaterThan(0);
  });

  it("tudo mora na @layer json-pdf-designer, pro CSS do consumidor ganhar", () => {
    // CSS sem layer ganha de CSS com layer, independente de especificidade.
    // É o que garante que um `className` do consumidor vença o nosso default.
    expect(CSS).toMatch(/@layer\s+json-pdf-designer\s*\{/);
    // Nada de regra solta antes da layer (comentário já foi removido acima).
    // Antes do bloco só pode existir a DECLARAÇÃO de ordem de layer — que é
    // obrigatória, não opcional: sem ela a nossa layer pode acabar declarada
    // depois da do consumidor e passar a vencer o CSS dele.
    expect(CSS, "falta a declaração de ordem `@layer json-pdf-designer, utilities;`").toMatch(
      /@layer\s+json-pdf-designer\s*,\s*utilities\s*;/
    );
    const beforeLayer = CSS.slice(0, CSS.indexOf("@layer json-pdf-designer {"))
      .replace(/@layer[^;]*;/g, "")
      .replace(/@import[^;]*;/g, "")
      .trim();
    expect(beforeLayer, `há CSS fora da @layer antes dela: ${beforeLayer.slice(0, 80)}`).toBe("");
  });

  it("não sobrou nenhuma utilitária Tailwind escrita como classe", () => {
    // Só o que está em posição de SELETOR: o texto antes de cada `{`. Sem
    // isso, `oklch(96.8% 0.007 …)` casaria `.007` como se fosse classe.
    // `@import` fora antes: `url("./reset.css")` faz o extrator de seletor
    // ver `.css` e acusar uma classe que não existe.
    const scanned = CSS.replace(/@import[^;]*;/g, "");
    const selectorText = [...scanned.matchAll(/([^{}]+)\{/g)].map((m) => m[1]).join(" ");
    const selectors = [...selectorText.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)].map((m) => m[1]);
    const notJpd = [...new Set(selectors)].filter((s) => !s.startsWith("jpd-") && s !== "dark");
    expect(notJpd, `classe fora do namespace jpd-:\n  ${notJpd.join("\n  ")}`).toEqual([]);
  });
});

// Diff entre o que o JSX USA e o que a folha ESTILIZA.
//
// É o guard mais importante desta arquitetura, porque cobre o pior modo de
// falha dela: classe com typo não dá erro em lugar nenhum — o elemento
// simplesmente sai sem estilo. Com a Fase 2 feita por cinco agentes em
// paralelo, cada um inventando nomes, é o erro mais provável de todos.
describe("theme.css x uso no JSX", () => {
  const styled = new Set(
    [...CSS.matchAll(/([^{}]+)\{/g)]
      .flatMap((m) => [...m[1].matchAll(/\.(jpd-[a-zA-Z0-9_-]+)/g)])
      .map((m) => m[1])
  );

  const used = new Map<string, string>();
  for (const file of sourceFiles()) {
    const code = stripComments(readFileSync(file, "utf8"));
    for (const lit of classLiterals(code)) {
      for (const token of tokensOf(lit.value)) {
        if (token.startsWith("jpd-") && !used.has(token)) used.set(token, `src/${relativeToSrc(file)}:${lit.line}`);
      }
    }
  }

  it("toda classe usada no JSX tem regra na folha", () => {
    const unstyled = [...used.entries()].filter(([c]) => !styled.has(c)).map(([c, at]) => `${c}  (${at})`);
    expect(unstyled, `Classe usada e NAO estilizada — o elemento sai sem estilo, sem erro:\n  ${unstyled.join("\n  ")}`).toEqual([]);
  });

  it("toda classe estilizada é usada em algum lugar", () => {
    // Exceção: classes que existem PRA O CONSUMIDOR, não pro nosso JSX.
    const forConsumers = new Set(["jpd-designer", "jpd-page", "jpd-modal__panel", "jpd-card", "jpd-field"]);
    const dead = [...styled].filter((c) => !used.has(c) && !forConsumers.has(c));
    expect(dead, `Regra sem nenhum uso no JSX (CSS morto):\n  ${dead.join("\n  ")}`).toEqual([]);
  });
});

// Seletor definido duas vezes na MESMA folha.
//
// Não é purismo: com a Fase 2 feita em paralelo, cinco grupos emitiram
// definições do mesmo seletor sem se ver. Ao concatenar, a que vem depois
// ganha — ou seja, a resolução é por ORDEM DE ARQUIVO, não por intenção.
// Foi assim que um `cursor: grab` do painel lateral quase vazou pras abas do
// modal de fórmula, que nunca foram arrastáveis.
describe("theme.css — seletor duplicado", () => {
  it("nenhum seletor é definido duas vezes, salvo os casos declarados", () => {
    // Duplicata LEGÍTIMA: uma regra de reset (seção 3) mais a regra de
    // componente do mesmo elemento, ou uma base mais o override dentro de
    // media query. São intencionais e não conflitam em propriedade.
    const allowed = new Set([".jpd-fieldtable", ".jpd-disclosure__summary", ".jpd-formula"]);

    const counts = new Map<string, number>();
    for (const m of CSS.matchAll(/([^{}]+)\{/g)) {
      const sel = m[1].split("\n").join(" ").replace(/\s+/g, " ").trim();
      if (!sel || sel.startsWith("@") || sel.includes(":root") || sel.includes("data-jpd-theme")) continue;
      // Split só na vírgula de NÍVEL SUPERIOR: `:where(a, b, c)` é UM
      // seletor, e um split ingênuo o parte em três.
      const parts: string[] = [];
      let depth = 0;
      let cur = "";
      for (const ch of sel) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
        if (ch === "," && depth === 0) {
          parts.push(cur);
          cur = "";
          continue;
        }
        cur += ch;
      }
      parts.push(cur);
      // Só regra de seletor ÚNICO. Um seletor que aparece numa LISTA
      // (`.jpd-btn, .jpd-iconbtn, .jpd-input { font: inherit }`, o grupo de
      // reset da seção 3) é agrupamento intencional, não redefinição — e é
      // o caso da maioria das classes do kit. O risco real, e o que de fato
      // aconteceu, são duas regras SOZINHAS pro mesmo seletor.
      const single = parts.map((x) => x.trim()).filter(Boolean);
      if (single.length !== 1) continue;
      const one = single[0];
      counts.set(one, (counts.get(one) ?? 0) + 1);
    }
    const dupes = [...counts.entries()].filter(([sel, n]) => n > 1 && !allowed.has(sel)).map(([sel, n]) => `${sel} (${n}x)`);
    expect(dupes, `Seletor definido mais de uma vez — quem ganha é a ordem no arquivo:\n  ${dupes.join("\n  ")}`).toEqual([]);
  });
});

// `[data-active]` sem `="true"` na aba.
//
// A aba é o ÚNICO site da migração que escreve o booleano cru
// (`data-active={x === y}`), porque o Designer faz
// `querySelector('[data-active="true"]')`. O React serializa `false` como a
// STRING "false", então `[data-active]` casa TODA aba — inclusive as
// inativas. Aconteceu de verdade: uma regra sobrevivente de um grupo pintou
// a barra inteira com o sublinhado de ativa.
describe("theme.css — o atributo booleano cru da aba", () => {
  it("nenhuma regra de .jpd-tab usa [data-active] sem o valor", () => {
    const offenders = [...CSS.matchAll(/([^{}]*\.jpd-tab[^{}]*)\{/g)]
      .map((m) => m[1].replace(/\s+/g, " ").trim())
      .filter((sel) => /\[data-active\](?!=)/.test(sel));
    expect(
      offenders,
      `Regra casando toda aba, ativa ou não — use [data-active="true"]:\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });
});

// `reset.css` é um export PÚBLICO por si ("json-pdf-designer/reset.css"),
// pra quem estiliza o editor do zero e não quer a aparência pronta. Então
// ele não pode depender de token que só o `theme.css` declara — usado
// sozinho, o `var()` cai em nada e a regra morre calada.
//
// Aconteceu: `font-family: var(--jpd-font-sans)` sem fallback. Funcionava
// por acidente (var inválido em propriedade herdada cai em herança, que é o
// default desejado), e ia parar de funcionar no dia que alguém desse ao
// token um valor concreto — aí o reset avulso passaria a ignorá-lo.
describe("reset.css — autossuficiente", () => {
  const RESET_CSS = RESET_RAW.replace(/\/\*[\s\S]*?\*\//g, "");

  it("todo token que ele LÊ, ele declara — ou tem fallback", () => {
    const declarados = new Set([...RESET_CSS.matchAll(/(--jpd-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const semFallback = [...RESET_CSS.matchAll(/var\(\s*(--jpd-[a-z0-9-]+)\s*\)/g)]
      .map((m) => m[1])
      .filter((n) => !declarados.has(n));
    expect(
      [...new Set(semFallback)],
      `reset.css lê token que só o theme.css declara, e sem fallback — a regra morre no uso avulso:\n  ${[...new Set(semFallback)].join("\n  ")}`
    ).toEqual([]);
  });

  it("controle: o reset REALMENTE usa var() (senão o teste acima é vácuo)", () => {
    expect(/var\(\s*--jpd-/.test(RESET_CSS), "nenhum var() no reset — a varredura acima não guarda nada").toBe(true);
  });
});

// Token que entra em LISTA de sombra é uma armadilha pública.
//
// `.jpd-input:focus` compõe `box-shadow: 0 0 0 2px var(--jpd-accent-ring),
// var(--jpd-shadow-sm)`. Um consumidor que ponha `--jpd-shadow-sm: none` —
// a coisa óbvia pra "quero sem sombra" — torna a declaração INTEIRA inválida
// e perde o ANEL DE FOCO junto, sem erro no console.
//
// Achado retematizando o `examples/composed-layout`. Este guard não impede o
// consumidor de errar (não dá), mas garante que o aviso continue escrito
// junto do token — e que ninguém acrescente um token novo a uma lista de
// sombra sem documentar o mesmo.
describe("theme.css — tokens usados dentro de lista de sombra", () => {
  it("todo token em lista de sombra tem o aviso de `none` documentado", () => {
    // Uma declaração `box-shadow` com vírgula ANTES de um `var(--jpd-...)`
    // significa que aquele token é um item de lista.
    const emLista = new Set<string>();
    for (const m of CSS.matchAll(/box-shadow:\s*([^;]+);/g)) {
      const valor = m[1];
      if (!valor.includes(",")) continue;
      for (const v of valor.matchAll(/var\((--jpd-[a-z0-9-]+)/g)) emLista.add(v[1]);
    }
    // O `--jpd-accent-ring` é sempre o primeiro item e é uma COR, não uma
    // sombra — `none` nele não faz sentido e ninguém tentaria.
    const sombras = [...emLista].filter((t) => t.includes("shadow"));
    expect(sombras.length, "controle: nenhum token de sombra em lista — a varredura não guarda nada").toBeGreaterThan(0);

    // O aviso tem de nomear cada um deles.
    const semAviso = sombras.filter((t) => !THEME_RAW.includes(`NÃO USE \`none\` NO \`${t}\``));
    expect(
      semAviso,
      `token de sombra usado em LISTA e sem o aviso de \`none\` junto da declaração:\n  ${semAviso.join("\n  ")}`
    ).toEqual([]);
  });
});
