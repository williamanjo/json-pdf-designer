import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

// A class scan over the SOURCE, shared by the migration's guards
// (test/noTailwind.test.ts and, once theme.css exists, the
// class-used x class-styled diff).
//
// WHY TEXT AND NOT AN AST: the repo has no TS parser in its devDeps, and what
// the guards need to know ("which class tokens does this file write") is
// answerable by text with enough precision — as long as comments are stripped
// first. That is NOT optional here: this repo comments a lot and quotes class
// names in prose (PaletteSwatches.tsx has "h-4 w-4", "gap-1" and "h-3.5 w-3.5"
// inside a comment), so scanning without stripping comments guarantees a false
// positive.

const SRC = join(__dirname, "..", "..", "src");

export function sourceFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
  })(SRC);
  return out.sort();
}

export function relativeToSrc(file: string): string {
  return relative(SRC, file).split(sep).join("/");
}

// Removes line and block comments. Strings that CONTAIN "//" (a URL, for
// instance) survive because the scan respects string delimiters.
export function stripComments(code: string): string {
  let out = "";
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < code.length) {
        if (code[i] === "\\") {
          out += code[i] + (code[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += code[i];
        if (code[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (c === "/" && code[i + 1] === "/") {
      while (i < code.length && code[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && code[i + 1] === "*") {
      i += 2;
      // It preserves the newline of each consumed line. Without this, every line
      // number reported after a BLOCK comment comes out shifted backwards — and
      // the shift accumulates down the file. In a repo as commented as this one
      // the error is large (measured: 282 instead of 289 in Designer.tsx), and
      // whoever navigates by the test's output edits the wrong line.
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) {
        if (code[i] === "\n") out += "\n";
        i++;
      }
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

export type Literal = { value: string; line: number };

// Every string literal in the file (single quotes, double quotes and
// templates). In a template literal, `${...}` is replaced by a space — what is
// left are the static pieces, which is exactly what matters.
export function stringLiterals(codeWithoutComments: string): Literal[] {
  const out: Literal[] = [];
  const code = codeWithoutComments;
  let i = 0;
  let line = 1;
  while (i < code.length) {
    const c = code[i];
    if (c === "\n") {
      line++;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      const startLine = line;
      let value = "";
      i++;
      let depth = 0;
      while (i < code.length) {
        if (code[i] === "\\") {
          value += code[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (quote === "`" && code[i] === "$" && code[i + 1] === "{") {
          depth = 1;
          i += 2;
          while (i < code.length && depth > 0) {
            if (code[i] === "{") depth++;
            else if (code[i] === "}") depth--;
            else if (code[i] === "\n") line++;
            i++;
          }
          value += " ";
          continue;
        }
        if (code[i] === quote) {
          i++;
          break;
        }
        if (code[i] === "\n") line++;
        value += code[i];
        i++;
      }
      out.push({ value, line: startLine });
      continue;
    }
    i++;
  }
  return out;
}

// String literals in CLASS position: inside `className={...}` /
// `className="..."`, inside a `cx(...)` call, and in a module constant whose
// name ends in `Cls` (the pattern that already existed in the kit:
// `controlCls`, `sizeCls`, `variantCls`).
export function classLiterals(codeWithoutComments: string): Literal[] {
  const code = codeWithoutComments;
  const out: Literal[] = [];
  const lineAt = (index: number) => code.slice(0, index).split("\n").length;

  const pushRegion = (start: number, end: number) => {
    const region = code.slice(start, end);
    const base = lineAt(start) - 1;
    for (const lit of stringLiterals(region)) out.push({ value: lit.value, line: base + lit.line });
  };

  // className="..." e className={ ... } (com casamento de chaves)
  for (const m of code.matchAll(/className\s*=\s*/g)) {
    let i = (m.index ?? 0) + m[0].length;
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      const end = code.indexOf(quote, i + 1);
      if (end > i) pushRegion(i, end + 1);
      continue;
    }
    if (code[i] === "{") {
      let depth = 0;
      const start = i;
      while (i < code.length) {
        if (code[i] === "{") depth++;
        else if (code[i] === "}") {
          depth--;
          if (depth === 0) break;
        }
        i++;
      }
      pushRegion(start, i + 1);
    }
  }

  // cx( ... ) e constantes *Cls
  for (const m of code.matchAll(/\bcx\s*\(|\b\w*Cls(?:\s*:\s*[^=]*)?\s*=\s*/g)) {
    let i = (m.index ?? 0) + m[0].length;
    const opener = m[0].trimEnd().endsWith("(") ? "(" : code[i] === "{" ? "{" : "";
    if (opener) {
      let depth = 0;
      const start = i - (opener === "(" ? 1 : 0);
      i = start;
      const close = opener === "(" ? ")" : "}";
      while (i < code.length) {
        if (code[i] === opener) depth++;
        else if (code[i] === close) {
          depth--;
          if (depth === 0) break;
        }
        i++;
      }
      pushRegion(start, i + 1);
    } else {
      // a single-string constant: `const controlCls = "..."`
      const end = code.indexOf(";", i);
      pushRegion(i, end === -1 ? code.length : end);
    }
  }

  return out;
}

export function tokensOf(literal: string): string[] {
  return literal.split(/\s+/).filter(Boolean);
}

// The accepted semantic class shapes: jpd-block, jpd-block__element,
// jpd-block--modifier, jpd-block__element--modifier. One element level only.
export const JPD_CLASS = /^jpd-[a-z0-9]+(?:-[a-z0-9]+)*(?:__[a-z0-9]+(?:-[a-z0-9]+)*)?(?:--[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

const TW_COLORS =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black|current|transparent|inherit";

// Tailwind utility shapes. Each one anchored at a token boundary so it does
// not match a loose word in UI text.
export const TW_SHAPES: RegExp[] = [
  // spacing: p-2, px-2.5, -mt-1, my-0.5
  /^-?(?:[a-z-]+:)*(?:p|m)[xytblrse]?-(?:\[[^\]]+\]|\d+(?:\.\d+)?|px|auto)$/,
  // cor: bg-slate-100, text-sky-600/50, border-gray-600, ring-sky-300
  new RegExp(`^(?:[a-z-]+:)*(?:bg|text|border|ring|outline|fill|stroke|divide|from|via|to|decoration|placeholder|caret|accent|shadow)-(?:${TW_COLORS})(?:-\\d{2,3})?(?:/\\d{1,3})?$`),
  // Utilitária de palavra SOLTA (`flex`, `hidden`, `table`, `relative`,
  // `truncate`, ...) NÃO entra aqui de propósito. Este blacklist roda sobre
  // TODA string literal do arquivo, e palavra solta é ambígua demais: neste
  // repo `"table"` é discriminador de schema (`schema.type`), `"hidden"` e
  // `"relative"` são texto de UI no dicionário i18n, e `"fixed"` é rótulo de
  // faixa de página. Medido: essa única forma gerava 30 falsos positivos em
  // 12 arquivos que não têm classe nenhuma.
  // Onde palavra solta importa — em posição de CLASSE — quem pega é o
  // allowlist (JPD_CLASS), que reprova qualquer token que não seja `jpd-*`.
  // As formas COMPOSTAS abaixo (com hífen + escala ou cor) são inequívocas e
  // continuam cobrindo `flex-col`, `inline-flex`, `table-cell` etc.
  // dimensão/raio/sombra/etc com escala
  /^(?:[a-z-]+:)*(?:w|h|size|min-w|min-h|max-w|max-h|gap|gap-x|gap-y|space-x|space-y|rounded|rounded-[tblrse]{1,2}|shadow|opacity|z|leading|tracking|border|inset|top|left|right|bottom|basis|grow|shrink|order|col-span|row-span|grid-cols|grid-rows|aspect|scale|rotate|translate-x|translate-y|duration|delay|indent)-(?:\[[^\]]+\]|\d+(?:\.\d+)?|px|full|none|auto|xs|sm|md|lg|xl|2xl|3xl|screen|fit|min|max|dvh|svh|lvh)$/,
  // grupos nomeados de utilitária
  /^(?:[a-z-]+:)*(?:items|justify|self|content|place-items|place-content|flex|font|text|align|whitespace|overflow|overflow-x|overflow-y|cursor|select|pointer-events|list|object|resize|appearance|transition|ease|origin|break|table)-[a-z0-9[\]./-]+$/,
];

export function looksTailwind(token: string): boolean {
  return TW_SHAPES.some((re) => re.test(token));
}
