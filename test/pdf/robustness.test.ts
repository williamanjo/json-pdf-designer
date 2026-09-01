import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generatePdf } from "../../src/pdf/generate";
import { DEFAULT_MAX_PAGES, layoutDocument, PageLimitError } from "../../src/pdf/layout/layoutDocument";
import { buildInputs } from "../../src/bindings/bindings";
import { UnsupportedGlyphError, sanitizeText } from "../../src/pdf/textSafety";
import type { Binding, Schema, Template } from "../../src/types";

// O que pode e o que NÃO pode derrubar `generatePdf`.
//
// A linha divisória: problema de DADO ou de conteúdo mal formado degrada (campo
// vazio, caractere trocado, PDF sai); problema ESTRUTURAL, ou perda de conteúdo
// que alguém assinaria sem saber, falha alto. Um relatório de 200 páginas não
// pode morrer porque uma linha tinha um `\n`.

const A4 = { width: 210, height: 297 };
const LF = String.fromCharCode(10);
const TAB = String.fromCharCode(9);
const NUL = String.fromCharCode(0);

function text(content: string, extra: Partial<Schema> = {}): Schema {
  return {
    id: "t", name: "campo", type: "text", x: 10, y: 20, width: 180, height: 10,
    content, fontSize: 10, fontColor: "#000000", alignment: "left", ...extra,
  } as Schema;
}

const tableSchema: Schema = {
  id: "tab", name: "tab", type: "table", x: 10, y: 40, width: 190, height: 20,
  head: ["Nome"], content: [],
} as Schema;
const tableBinding: Binding[] = [{ schemaName: "tab", type: "array", path: "rows", columns: ["nome"] }];

const pagesOf = async (template: Template, data: unknown = {}, bindings: Binding[] = []) =>
  (await PDFDocument.load(await generatePdf(template, data, bindings))).getPageCount();

describe("sanitizeText", () => {
  it("troca caractere de controle por espaço", () => {
    expect(sanitizeText(`a${LF}b`)).toBe("a b");
    expect(sanitizeText(`a${TAB}b`)).toBe("a b");
    expect(sanitizeText(`a${NUL}b`)).toBe("a b");
    expect(sanitizeText(`a${String.fromCharCode(13)}b`)).toBe("a b");
    expect(sanitizeText(`a${String.fromCharCode(0x9f)}b`)).toBe("a b");
  });

  it("não mexe em nada que tenha glifo", () => {
    expect(sanitizeText("João — O’Brien ± 5% 🎉")).toBe("João — O’Brien ± 5% 🎉");
    expect(sanitizeText("")).toBe("");
  });
});

describe("dado com caractere de controle não derruba o documento", () => {
  // Este era o crash de maior impacto: newline é o caractere inesperado mais
  // comum em dado real, e vem do DADO, então quem monta o template não tem como
  // prevenir.
  it("campo de texto", async () => {
    expect(await pagesOf({ page: A4, schemas: [text("{nome}")] }, { nome: `a${LF}b${TAB}c` })).toBe(1);
  });

  it("célula de tabela", async () => {
    const t: Template = { page: A4, schemas: [tableSchema] };
    expect(await pagesOf(t, { rows: [{ nome: `linha${LF}quebrada` }] }, tableBinding)).toBe(1);
  });

  it("faixa repetida (cabeçalho)", async () => {
    const t: Template = { page: A4, headerHeight: 15, schemas: [text("{titulo}", { y: 5 }), tableSchema] };
    expect(await pagesOf(t, { titulo: `Rel${LF}2026`, rows: [{ nome: "a" }] }, tableBinding)).toBe(1);
  });

  it("KPI", async () => {
    const kpi: Schema = { id: "k", name: "kpi", type: "kpi", x: 10, y: 20, width: 60, height: 30, title: "{t}", value: "{v}" } as Schema;
    expect(await pagesOf({ page: A4, schemas: [kpi] }, { t: `a${LF}b`, v: `1${LF}2` })).toBe(1);
  });

  it("rótulo de gráfico", async () => {
    const chart: Schema = { id: "c", name: "graf", type: "chart", x: 10, y: 20, width: 80, height: 60, chartType: "bar" } as Schema;
    const bindings: Binding[] = [{ schemaName: "graf", type: "chart", path: "itens", labelColumn: "l", valueColumn: "v" }];
    expect(await pagesOf({ page: A4, schemas: [chart] }, { itens: [{ l: `a${LF}b`, v: 1 }] }, bindings)).toBe(1);
  });
});

describe("caractere sem glifo na fonte: falha, mas dizendo onde", () => {
  // Diferente de controle: emoji/CJK TÊM glifo numa fonte completa, então
  // descartar seria perda de conteúdo num documento assinado. Falha — mas com
  // contexto suficiente pra agir.
  it("nomeia o campo, o caractere e o que fazer", async () => {
    const t: Template = { page: A4, schemas: [text("{nome}", { name: "cliente_nome" })] };
    await expect(generatePdf(t, { nome: "Ana 🎉" }, [])).rejects.toThrow(UnsupportedGlyphError);
    await expect(generatePdf(t, { nome: "Ana 🎉" }, [])).rejects.toThrow(/Campo "cliente_nome"/);
    await expect(generatePdf(t, { nome: "Ana 🎉" }, [])).rejects.toThrow(/U\+1F389/);
    await expect(generatePdf(t, { nome: "Ana 🎉" }, [])).rejects.toThrow(/fontBytes/);
  });

  it("reporta emoji fora do BMP como UM caractere, não dois surrogates", async () => {
    const t: Template = { page: A4, schemas: [text("{nome}")] };
    // U+1F389 ocupa duas unidades UTF-16; iterar por code point é o que evita
    // reportar "\ud83c" (metade de um par) como o problema.
    await expect(generatePdf(t, { nome: "🎉" }, [])).rejects.toThrow(/U\+1F389/);
  });

  it("nomeia o campo em TODOS os caminhos de texto, nao so no campo de texto", async () => {
    // Celula de tabela, KPI, rotulo de grafico e tabela aninhada numa secao
    // passavam o erro cru do pdf-lib, sem dizer onde. Cada um tem o seu
    // envelope agora - o da tabela mora dentro do drawTableSlice, que e o
    // funil dos tres caminhos de tabela.
    const E = "\u{1F389}";

    const tab: Schema = {
      id: "tab", name: "tabela_vendas", type: "table", x: 10, y: 20, width: 190, height: 20,
      head: ["Nome"], content: [],
    } as Schema;
    const tb: Binding[] = [{ schemaName: "tabela_vendas", type: "array", path: "rows", columns: ["nome"] }];
    await expect(generatePdf({ page: A4, schemas: [tab] }, { rows: [{ nome: E }] }, tb)).rejects.toThrow(
      /Campo "tabela_vendas"/
    );

    const kpi: Schema = { id: "k", name: "indicador_x", type: "kpi", x: 10, y: 20, width: 60, height: 30, value: "{v}" } as Schema;
    await expect(generatePdf({ page: A4, schemas: [kpi] }, { v: E }, [])).rejects.toThrow(/Campo "indicador_x"/);

    const chart: Schema = { id: "c", name: "grafico_x", type: "chart", x: 10, y: 20, width: 80, height: 60, chartType: "bar" } as Schema;
    const cb: Binding[] = [{ schemaName: "grafico_x", type: "chart", path: "itens", labelColumn: "l", valueColumn: "v" }];
    await expect(generatePdf({ page: A4, schemas: [chart] }, { itens: [{ l: E, v: 1 }] }, cb)).rejects.toThrow(
      /Campo "grafico_x"/
    );

    // Tabela membro de uma secao repetida - o caminho mais fundo.
    const sec: Schema = { id: "s", name: "secao_x", type: "section", x: 10, y: 20, width: 190, height: 40 } as Schema;
    const membro: Schema = {
      id: "mt", name: "tab_membro", type: "table", x: 10, y: 24, width: 180, height: 14,
      head: ["P"], content: [], sectionId: "s",
    } as Schema;
    const sb: Binding[] = [
      { schemaName: "secao_x", type: "section", path: "itens" },
      { schemaName: "tab_membro", type: "array", path: "linhas", columns: ["p"] },
    ];
    await expect(
      generatePdf({ page: A4, schemas: [sec, membro] }, { itens: [{ linhas: [{ p: E }] }] }, sb)
    ).rejects.toThrow(/Campo "tab_membro"/);
  });

  it("acentuação latina continua funcionando sem fonte customizada", async () => {
    const t: Template = { page: A4, schemas: [text("{nome}")] };
    expect(await pagesOf(t, { nome: "João Ção — O’Brien" })).toBe(1);
  });
});

describe("imagem", () => {
  const img = (content: string, name = "logo"): Schema =>
    ({ id: "i", name, type: "image", x: 10, y: 20, width: 40, height: 20, content } as Schema);

  it("vínculo de imagem é usado na geração (antes o render ignorava)", async () => {
    // 1x1 PNG transparente.
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/wD/9AAAAABJRU5ErkJggg==";
    const bindings: Binding[] = [{ schemaName: "logo", type: "scalar", path: "logoUri" }];
    // Sem content nenhum no schema: se o vínculo fosse ignorado, nada seria
    // desenhado. O PDF com a imagem embutida é maior que o sem.
    const semImagem = await generatePdf({ page: A4, schemas: [img("")] }, { logoUri: png }, []);
    const comVinculo = await generatePdf({ page: A4, schemas: [img("")] }, { logoUri: png }, bindings);
    expect(comVinculo.length).toBeGreaterThan(semImagem.length);
  });

  it("vínculo que resolve pra algo que não é data URI deixa o campo vazio, sem estourar", async () => {
    const bindings: Binding[] = [{ schemaName: "logo", type: "scalar", path: "logoUri" }];
    for (const value of ["https://exemplo/logo.png", "texto solto", ""]) {
      expect(await pagesOf({ page: A4, schemas: [img("")] }, { logoUri: value }, bindings), value).toBe(1);
    }
  });

  it("PNG corrompido no campo dá erro nomeando o campo", async () => {
    await expect(generatePdf({ page: A4, schemas: [img("data:image/png;base64,AAAA")] }, {}, [])).rejects.toThrow(
      /Campo "logo".*corrompido/
    );
  });

  it("fundo de página corrompido dá um Error de verdade, não uma string crua", async () => {
    // O pdf-lib/pako lança uma STRING aqui ("The input is not a PNG file!"), e
    // `catch (e) { e.message }` de quem chama dava `undefined`.
    const t: Template = { page: A4, backgroundImage: "data:image/png;base64,AAAA", schemas: [text("x")] };
    await expect(generatePdf(t, {}, [])).rejects.toBeInstanceOf(Error);
    await expect(generatePdf(t, {}, [])).rejects.toThrow(/Imagem de fundo da página.*corrompido|não é PNG/);
  });
});

describe("números degenerados no schema", () => {
  it("fontSize NaN cai no default em vez de estourar", async () => {
    expect(await pagesOf({ page: A4, schemas: [text("x", { fontSize: NaN as number })] })).toBe(1);
  });

  it("tamanho de página inválido falha alto, nomeando a página", async () => {
    // Estrutural: não há default sensato pra adivinhar. Antes vinha um
    // TypeError opaco do pdf-lib, sem dizer de qual página.
    for (const page of [{ width: NaN, height: 297 }, { width: 210, height: 0 }, { width: -1, height: 297 }]) {
      await expect(generatePdf({ page, schemas: [text("x")] }, {}, []), JSON.stringify(page)).rejects.toThrow(
        /tamanho inválido/
      );
    }
  });

  it("fontSize/largura zerados ou negativos continuam gerando (não são estruturais)", async () => {
    expect(await pagesOf({ page: A4, schemas: [text("x", { fontSize: 0 })] })).toBe(1);
    expect(await pagesOf({ page: A4, schemas: [text("x", { width: -10 })] })).toBe(1);
  });
});

describe("dado de forma inesperada não derruba", () => {
  it("data null/array/string", async () => {
    const t: Template = { page: A4, schemas: [text("{nome}")] };
    for (const data of [null, undefined, [1, 2], "texto", 42]) {
      expect(await pagesOf(t, data), JSON.stringify(data ?? null)).toBe(1);
    }
  });

  it("array vinculado com tipo errado, itens não-objeto, célula objeto", async () => {
    const t: Template = { page: A4, schemas: [tableSchema] };
    for (const data of [{ rows: 42 }, { rows: [1, "x", null] }, { rows: [{ nome: { a: 1 } }] }]) {
      expect(await pagesOf(t, data, tableBinding), JSON.stringify(data)).toBe(1);
    }
  });
});

describe("volume: completa ou falha, nunca trunca em silencio", () => {
  // Os contadores de iteracao que existiam aqui (1000 fatias de tabela, 20000
  // repeticoes de secao) truncavam sem avisar: 60 mil linhas saiam como 40.998
  // num PDF que parecia completo. Omitir linha de um relatorio sem dizer nada e
  // o pior resultado possivel. Hoje o teto e em PAGINA e estoura-lo e erro.
  const bigSection = (n: number) => {
    const sec: Schema = { id: "s", name: "secao_pedidos", type: "section", x: 10, y: 10, width: 190, height: 20 } as Schema;
    return {
      template: { page: A4, schemas: [sec] } as Template,
      data: { itens: Array.from({ length: n }, (_, i) => ({ i })) },
      bindings: [{ schemaName: "secao_pedidos", type: "section", path: "itens" }] as Binding[],
    };
  };
  const bigTable = (n: number) => {
    const tab: Schema = {
      id: "t", name: "tabela_linhas", type: "table", x: 10, y: 15, width: 190, height: 20,
      head: ["a"], content: [],
    } as Schema;
    return {
      template: { page: A4, schemas: [tab] } as Template,
      data: { rows: Array.from({ length: n }, (_, i) => ({ a: String(i) })) },
      bindings: [{ schemaName: "tabela_linhas", type: "array", path: "rows", columns: ["a"] }] as Binding[],
    };
  };
  const layoutOf = (c: { template: Template; data: unknown; bindings: Binding[] }, o = {}) =>
    layoutDocument(c.template, c.data, c.bindings, buildInputs(c.data, c.bindings), o);

  it("20 mil repeticoes de secao saem TODAS (antes perdia 1.333)", () => {
    const c = bigSection(20000);
    const placed = layoutOf(c).pages.flatMap((p) => p.placements).length;
    expect(placed).toBe(20000);
  }, 30000);

  it("60 mil linhas de tabela saem TODAS (antes perdia 19.002)", () => {
    const c = bigTable(60000);
    const rows = layoutOf(c)
      .pages.flatMap((p) => p.placements)
      .reduce((sum, p) => sum + (p.kind === "tableSlice" ? p.rows.length : 0), 0);
    expect(rows).toBe(60000);
  }, 30000);

  it("acima do teto de paginas: erro nomeando o campo, nao PDF truncado", () => {
    // Um teto baixo com dado pequeno testa a mesma coisa que 300 mil linhas
    // contra o teto default, em milissegundos em vez de segundos.
    const tabela = bigTable(5000);
    expect(() => layoutOf(tabela, { maxPages: 20 })).toThrow(PageLimitError);
    expect(() => layoutOf(tabela, { maxPages: 20 })).toThrow(/tabela_linhas/);
    expect(() => layoutOf(tabela, { maxPages: 20 })).toThrow(/20 páginas/);
    expect(() => layoutOf(bigSection(5000), { maxPages: 20 })).toThrow(/secao_pedidos/);
  });

  it("o teto default e o DEFAULT_MAX_PAGES, nao um numero solto", () => {
    // Sem `maxPages`, a mensagem tem de citar o default exportado — se alguém
    // mudar a constante e esquecer a mensagem, isto acusa.
    expect(() => layoutOf(bigTable(300000))).toThrow(new RegExp(`${DEFAULT_MAX_PAGES} páginas`));
  }, 30000);

  it("maxPages e configuravel nas duas direcoes", () => {
    const tabela = bigTable(60000);
    expect(() => layoutOf(tabela, { maxPages: 100 })).toThrow(PageLimitError);
    const rows = layoutOf(tabela, { maxPages: 20000 })
      .pages.flatMap((p) => p.placements)
      .reduce((sum, p) => sum + (p.kind === "tableSlice" ? p.rows.length : 0), 0);
    expect(rows).toBe(60000);
  }, 30000);

  it("generatePdf repassa maxPages", async () => {
    const c = bigTable(2000);
    await expect(generatePdf(c.template, c.data, c.bindings, { maxPages: 3 })).rejects.toThrow(PageLimitError);
  });

  it("a mensagem diz o que fazer, nao so que falhou", () => {
    try {
      layoutOf(bigTable(5000), { maxPages: 20 });
      throw new Error("deveria ter falhado");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/filtre antes de gerar|divida em vários PDFs/);
      expect(msg).toMatch(/maxPages/);
    }
  });
});
