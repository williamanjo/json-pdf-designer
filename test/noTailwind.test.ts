import { readFileSync } from "./support/read";
import { describe, expect, it } from "vitest";
import { classLiterals, JPD_CLASS, looksTailwind, relativeToSrc, sourceFiles, stringLiterals, stripComments, tokensOf } from "./support/classScan";

// A guard for the "Tailwind out of the package" migration (3.0.0).
//
// The risk it exists to cover is not aesthetic: a migration of ~285 class
// sites done file by file may be published HALF WAY, and half migrated is the
// worst possible state — `theme.css` does not style the leftover utilities,
// and Tailwind no longer exists to generate them, so the unmigrated piece is
// left with no style at all, and no error at all.
//
// Mechanics: `PENDING` lists the files not yet migrated. Each commit of the
// migration removes one; the last commit deletes the list and turns test (c)
// on. Test (b) stops the list from lying: a file already clean that is still
// listed FAILS, which forces the list only to shrink (the same protection
// against empty approval that test/entryBoundaries.test.ts uses).
const PENDING: string[] = [];

type Offence = { file: string; line: number; token: string };

function scan(file: string) {
  const code = stripComments(readFileSync(file, "utf8"));
  const rel = relativeToSrc(file);

  // (a) allowlist — every token in CLASS position has to be `jpd-*`. It
  // catches a Tailwind utility AND, which the blacklist would not, a class
  // with NO namespace: that is exactly how `section-body` and
  // `section-drag-handle` got into a library package, where they collide with
  // the consumer's CSS.
  const notNamespaced: Offence[] = [];
  for (const lit of classLiterals(code)) {
    for (const token of tokensOf(lit.value)) {
      if (!JPD_CLASS.test(token)) notNamespaced.push({ file: rel, line: lit.line, token });
    }
  }

  // (b) blacklist — the shape of a Tailwind utility in ANY string literal.
  // It covers what the allowlist cannot reach: a variant map (`sizeCls`/
  // `variantCls`), a prop default whose VALUE is a class (PaletteSwatches
  // took `size = "h-4 w-4"`), and a class assembled far from the `className`.
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
