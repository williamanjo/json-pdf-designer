import { readFileSync } from "./support/read";
import { existsSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

// It guards each entry point's PACKAGING promises — the ones that would only
// break in someone else's `npm install`, never here:
//
// - "json-pdf-designer/server" runs in a Node backend with no React at all"
// - "importing the main entry does not force installing pdfjs-dist"
//
// Both depend on the same thing: certain packages must NOT be reachable from
// certain files. All of them are OPTIONAL peer dependencies (see
// package.json), so an import in the wrong file causes no build error here —
// it only shows up as a missing dependency, or as ~35MB/8MB installed without
// asking, in the consumer's project. Hence the source scan: it catches the
// leak in the PR.
//
// See docs/ARCHITECTURE.md, "How the boundary is enforced", for the other two
// guards (the no-preview example and CI's tarball check).

const SRC = resolve(__dirname, "../src");

// Only relative specifiers matter for walking the graph — an external
// dependency does not pull our code back in.
//
// The `(?!type[\s{])` ignores type-only statements (`import type {...} from`,
// `export type {...} from`): they are ERASED at compile time, so they become
// neither an import in the bundle nor in the .d.ts (tsup inlines the local
// types). Without that exception the test gave a false positive on
// `src/server.ts`, which does `export type { Locale, Dict } from "./i18n"` —
// and ./i18n/index.ts re-exports the I18nProvider, which is React. None of
// that reaches dist/server.* (checked: zero mention of react there). An
// `import { type X } from "m"` (inline type), on the other hand, STILL counts
// as an edge: TS keeps the module import, it only drops the specifier.
const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s+(?!type[\s{])[^;'"]*?from\s*["']([^"']+)["']/g;
const BARE_IMPORT_RE = /(?:^|\n)\s*import\s*["']([^"']+)["']/g;

function resolveModule(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".")) return null;
  const base = join(dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  for (const c of candidates) {
    if (c === base && !existsSync(c)) continue;
    if (existsSync(c) && !c.endsWith(".css")) {
      // Diretório sem index — não é um módulo por si só.
      if (c === base && !/\.(ts|tsx)$/.test(c)) continue;
      return c;
    }
  }
  return null;
}

// Todos os módulos alcançáveis a partir de `entry`, seguindo imports
// relativos, mais o conjunto de specifiers externos vistos no caminho.
function walk(entry: string) {
  const visited = new Set<string>();
  const external = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);

    const source = readFileSync(file, "utf8");
    for (const re of [IMPORT_RE, BARE_IMPORT_RE]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(source)) !== null) {
        const specifier = m[1];
        if (specifier.startsWith(".")) {
          const resolved = resolveModule(file, specifier);
          if (resolved) queue.push(resolved);
        } else {
          external.add(specifier);
        }
      }
    }
  }

  return { visited, external };
}

const rel = (file: string) => file.slice(SRC.length + 1).split(sep).join("/");

// Arquivos (relativos a src/) alcançáveis a partir de `entry` que importam
// `pkg` — apontar O ARQUIVO culpado importa: sem isso a falha diz só "vazou"
// e deixa quem for consertar procurar no grafo inteiro.
function importersOf(entry: string, pkg: string): string[] {
  const { visited, external } = walk(entry);
  const reaches = [...external].some((s) => s === pkg || s.startsWith(`${pkg}/`));
  if (!reaches) return [];
  const re = new RegExp(String.raw`(?:from|import)\s*["']${pkg}(?:/[^"']*)?["']`);
  return [...visited].filter((f) => re.test(readFileSync(f, "utf8"))).map(rel).sort();
}

const ENTRY = {
  index: join(SRC, "index.ts"),
  server: join(SRC, "server.ts"),
  preview: join(SRC, "preview.ts"),
};

describe("fronteira do entry /server (sem React)", () => {
  // react-rnd é peer OPCIONAL desde a 2.0.0 justamente por isto: como
  // `dependency` normal ele era instalado sempre, e como os peers
  // react/react-dom DELE não são opcionais, o npm instalava o stack React
  // inteiro (~8,7MB) até num projeto que só importa "/server".
  for (const pkg of ["react", "react-dom", "react-rnd"]) {
    it(`não alcança ${pkg}`, () => {
      expect(importersOf(ENTRY.server, pkg)).toEqual([]);
    });
  }
});

describe("fronteira do pdfjs-dist", () => {
  it("não é alcançável a partir da entry principal (src/index.ts)", () => {
    expect(importersOf(ENTRY.index, "pdfjs-dist")).toEqual([]);
  });

  it("não é alcançável a partir da entry /server (src/server.ts)", () => {
    expect(importersOf(ENTRY.server, "pdfjs-dist")).toEqual([]);
  });

  it("é alcançável a partir da entry /preview (src/preview.ts)", () => {
    // O lado positivo do invariante: se ESTE teste falhar, o preview
    // parou de usar pdf.js e os outros dois passam por vacuidade.
    expect(importersOf(ENTRY.preview, "pdfjs-dist")).toEqual([
      "components/PdfPreview.tsx",
      "pdf/pdfWorker.ts",
    ]);
  });
});

describe("controle: a varredura enxerga o que deve enxergar", () => {
  // Mesma proteção contra vacuidade do caso do /preview, agora pro React:
  // se um refactor quebrasse o walk(), os testes do /server passariam sem
  // olhar nada. A entry principal É React, então tem que acusar.
  it("acha react e react-rnd a partir da entry principal", () => {
    expect(importersOf(ENTRY.index, "react").length).toBeGreaterThan(0);
    expect(importersOf(ENTRY.index, "react-rnd")).toEqual(["components/PageCanvas.tsx"]);
  });
});
