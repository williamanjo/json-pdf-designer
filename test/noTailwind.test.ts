import { readFileSync } from "./support/read";
import { describe, expect, it } from "vitest";
import { classLiterals, JPD_CLASS, looksTailwind, relativeToSrc, sourceFiles, stringLiterals, stripComments, tokensOf } from "./support/classScan";

// Guard da migração "Tailwind fora do pacote" (3.0.0).
//
// O risco que ele existe pra cobrir não é estético: uma migração de ~285
// sites de classe feita arquivo por arquivo pode ser publicada pela METADE, e
// meio migrada é o pior estado possível — o `theme.css` não estiliza as
// utilitárias que sobraram, e o Tailwind não existe mais pra gerá-las, então
// o pedaço não migrado fica sem estilo nenhum, sem erro nenhum.
//
// Mecânica: `PENDING` lista os arquivos que ainda não foram migrados. Cada
// commit da migração remove um; o último commit apaga a lista e liga o teste
// (c). O teste (b) impede a lista de mentir: arquivo já limpo que continua
// listado FALHA, o que força a lista a só encurtar (mesma proteção contra
// aprovação vazia que test/entryBoundaries.test.ts usa).
const PENDING: string[] = [];

type Offence = { file: string; line: number; token: string };

function scan(file: string) {
  const code = stripComments(readFileSync(file, "utf8"));
  const rel = relativeToSrc(file);

  // (a) allowlist — todo token em posição de CLASSE tem de ser `jpd-*`.
  // Pega utilitária Tailwind E, o que o blacklist não pegaria, classe SEM
  // namespace: foi exatamente assim que `section-body` e
  // `section-drag-handle` entraram num pacote de biblioteca, onde colidem
  // com o CSS do consumidor.
  const notNamespaced: Offence[] = [];
  for (const lit of classLiterals(code)) {
    for (const token of tokensOf(lit.value)) {
      if (!JPD_CLASS.test(token)) notNamespaced.push({ file: rel, line: lit.line, token });
    }
  }

  // (b) blacklist — forma de utilitária Tailwind em QUALQUER string literal.
  // Cobre o que o allowlist não alcança: mapa de variante (`sizeCls`/
  // `variantCls`), default de prop cujo VALOR é classe (PaletteSwatches
  // recebia `size = "h-4 w-4"`), e classe montada longe do `className`.
  const tailwindish: Offence[] = [];
  for (const lit of stringLiterals(code)) {
    for (const token of tokensOf(lit.value)) {
      if (looksTailwind(token)) tailwindish.push({ file: rel, line: lit.line, token });
    }
  }

  return { rel, notNamespaced, tailwindish, clean: notNamespaced.length === 0 && tailwindish.length === 0 };
}

const scanned = sourceFiles().map(scan);
const format = (offences: Offence[]) => offences.map((o) => `  src/${o.file}:${o.line}  ${o.token}`).join("\n");

describe("migração para classes jpd-*", () => {
  it("(a+b) arquivo já migrado não volta a ter utilitária Tailwind nem classe sem namespace", () => {
    const pending = new Set(PENDING);
    const offences = scanned.filter((s) => !pending.has(s.rel) && !s.clean);
    const report = offences
      .map((s) => `src/${s.rel}\n${format([...s.notNamespaced, ...s.tailwindish])}`)
      .join("\n\n");
    expect(report, `Arquivo migrado com classe fora do padrão:\n\n${report}`).toBe("");
  });

  it("(b) PENDING não tem entrada obsoleta — arquivo já limpo tem de sair da lista", () => {
    const stale = scanned.filter((s) => PENDING.includes(s.rel) && s.clean).map((s) => s.rel);
    expect(stale, `Estes arquivos já estão limpos e devem sair de PENDING em test/noTailwind.test.ts:\n  ${stale.join("\n  ")}`).toEqual([]);
  });

  it("(b) PENDING não lista arquivo que não existe", () => {
    const known = new Set(scanned.map((s) => s.rel));
    const ghosts = PENDING.filter((p) => !known.has(p));
    expect(ghosts, `Entradas de PENDING sem arquivo correspondente:\n  ${ghosts.join("\n  ")}`).toEqual([]);
  });

  // O guard só serve se apontar a linha CERTA: quem lê o output vai editar
  // aquela linha. Já falhou uma vez — stripComments engolia o newline de
  // comentário de bloco e o deslocamento acumulava arquivo abaixo.
  it("a linha reportada bate com a linha real do arquivo", () => {
    const wrong: string[] = [];
    for (const file of sourceFiles()) {
      const raw = readFileSync(file, "utf8");
      const lines = raw.split("\n");
      for (const lit of classLiterals(stripComments(raw))) {
        const first = lit.value.trim().split(/\s+/)[0];
        if (!first) continue;
        const actual = lines[lit.line - 1] ?? "";
        if (!actual.includes(first)) wrong.push(`src/${relativeToSrc(file)}:${lit.line} reportou "${first}", mas a linha é: ${actual.trim().slice(0, 60)}`);
      }
    }
    expect(wrong, `Linha reportada errada:\n  ${wrong.slice(0, 10).join("\n  ")}`).toEqual([]);
  });

  // (c) Liga no ÚLTIMO commit da migração, junto com a remoção do Tailwind
  // do package.json. Enquanto PENDING não estiver vazia este teste ficaria
  // vermelho de propósito, então ele nasce marcado.
  it("(c) migração concluída — PENDING vazia", () => {
    expect(PENDING).toEqual([]);
  });
});
