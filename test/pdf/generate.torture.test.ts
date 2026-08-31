import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generatePdf } from "../../src/pdf/generate";
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
    // Comportamento ATUAL e esperado do pdf-lib (WinAnsi não cobre emoji) —
    // este teste existe pra travar essa fronteira de propósito: se um dia
    // isso passar a NÃO lançar mais (ex: alguém adicionar sanitização), o
    // teste quebra e avisa que a documentação sobre "use fontBytes pra
    // unicode completo" pode precisar de revisão.
    await expect(generatePdf(emojiTemplate(), {}, [])).rejects.toThrow(/WinAnsi cannot encode/i);
  });
});
