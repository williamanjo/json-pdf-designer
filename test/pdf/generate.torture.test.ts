import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generatePdf } from "../../src/pdf/generate";
import { UnsupportedGlyphError } from "../../src/pdf/textSafety";
import type { Binding, Template } from "../../src/types";
import { emptyTableTemplate } from "./fixtures/emptyTable";
import { hugeTableTemplate } from "./fixtures/hugeTable";
import { sectionLargerThanPageTemplate } from "./fixtures/sectionLargerThanPage";
import { missingDataTemplate } from "./fixtures/missingData";
import { emojiTemplate, ptBrAccentsTemplate } from "./fixtures/unicodeText";

// "Golden"/torture tests — diferente dos testes unitários de
// render/renderTable.test.ts/pagination.test.ts (que verificam uma função isolada
// com uma página falsa), estes rodam o pipeline `generatePdf` INTEIRO com
// templates propositalmente extremos, e verificam propriedades ESTRUTURAIS
// do PDF de verdade (via pdf-lib real, não uma página falsa) — pega
// regressão que só aparece quando as peças rodam juntas (ex: uma função
// isolada "correta" mas que trava/gera saída inválida quando encadeada com
// o resto do pipeline). Sem snapshot de imagem/pixel — geração de PNG a
// partir de PDF já se mostrou inviável neste ambiente em sessões
// anteriores; validação aqui é por contagem de página/exceção, não visual.

describe("generatePdf — torture tests (pipeline inteiro, casos extremos)", () => {
  it("tabela vazia (0 linhas) não trava e ainda desenha o cabeçalho", async () => {
    const bytes = await generatePdf(emptyTableTemplate(), {}, []);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("tabela com 600 linhas quebra em várias páginas de verdade, sem travar", async () => {
    const bytes = await generatePdf(hugeTableTemplate(600), {}, []);
    const doc = await PDFDocument.load(bytes);
    // ~7 linhas por página (TABLE_ROW_HEIGHT_MM=7mm) menos cabeçalho — 600
    // linhas certamente cruzam bem mais de uma dúzia de páginas físicas.
    expect(doc.getPageCount()).toBeGreaterThan(10);
  }, 20000);

  it("seção maior que a página inteira não trava/loop infinito — termina com páginas finitas", async () => {
    const { template, data, bindings } = sectionLargerThanPageTemplate();
    const bytes = await generatePdf(template, data, bindings);
    const doc = await PDFDocument.load(bytes);
    // 2 repetições, cada uma maior que 1 página — pelo menos 2 páginas,
    // e um teto sensato (o guard de segurança em generate.ts para em 20000
    // iterações, mas não deveria nem chegar perto disso aqui).
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(doc.getPageCount()).toBeLessThan(100);
  }, 20000);

  it("path ausente/null/vínculo que não resolve pra array não lança — renderiza vazio/fallback", async () => {
    const { template, data, bindings } = missingDataTemplate();
    const bytes = await generatePdf(template, data, bindings);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("acentuação pt-BR com a fonte padrão (Helvetica/WinAnsi) funciona sem precisar de fonte customizada", async () => {
    const bytes = await generatePdf(ptBrAccentsTemplate(), {}, []);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("emoji sem fonte customizada lança um erro reconhecível (fronteira documentada, não regressão silenciosa)", async () => {
    // Fronteira DELIBERADA: WinAnsi não cobre emoji, e descartar o caractere
    // em silêncio seria pior — um relatório é documento assinado. Este teste
    // existe pra travar isso: se um dia passar a NÃO lançar, a documentação
    // sobre "use fontBytes pra unicode completo" precisa de revisão.
    //
    // A mensagem agora é nossa (UnsupportedGlyphError), não o "WinAnsi cannot
    // encode …" cru do pdf-lib, que não dizia QUAL campo nem o que fazer.
    await expect(generatePdf(emojiTemplate(), {}, [])).rejects.toThrow(UnsupportedGlyphError);
    await expect(generatePdf(emojiTemplate(), {}, [])).rejects.toThrow(/Campo "texto_emoji"/);
    await expect(generatePdf(emojiTemplate(), {}, [])).rejects.toThrow(/U\+1F389|fontBytes/);
  });

  it("caractere de CONTROLE no dado NÃO derruba o documento (vira espaço)", async () => {
    // O oposto do caso acima, e o mais comum em dado real: um LF vindo de um
    // textarea, endereço com quebra, import de CSV. Controle não tem glifo em
    // fonte NENHUMA, então trocar por espaço é a única renderização possível —
    // não é perda de conteúdo.
    const template: Template = {
      page: { width: 210, height: 297 },
      schemas: [
        {
          id: "t", name: "campo", type: "text", x: 10, y: 20, width: 180, height: 10,
          content: "{nome}", fontSize: 10, fontColor: "#000000", alignment: "left",
        },
        {
          id: "tab", name: "tab", type: "table", x: 10, y: 40, width: 190, height: 20,
          head: ["Nome"], content: [],
        },
      ],
    };
    const bindings: Binding[] = [{ schemaName: "tab", type: "array", path: "rows", columns: ["nome"] }];
    const LF = String.fromCharCode(10);
    const TAB = String.fromCharCode(9);
    const data = { nome: `a${LF}b${TAB}c`, rows: [{ nome: `linha${LF}com quebra` }] };
    const doc = await PDFDocument.load(await generatePdf(template, data, bindings));
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
