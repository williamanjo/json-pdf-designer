import { splitDelimited } from "../bindings/splitDelimited";

// Formula de coluna sem estado extra: tudo é derivado da PRÓPRIA string
// (parse) e reescrito nela (build) a cada troca do seletor "Tipo de dado"
// — só funciona pra um formato "limpo" (vazio, {path} nu, ou UMA chamada
// de função só, tipo {CURRENCY(preco, "R$", 2)}); fórmula com prefixo
// literal misturado (ex: "FAT-{fatura}") cai pra "raw" e só mostra o
// campo de texto livre de sempre — não dá pra decompor isso num seletor
// sem perder o prefixo.
export type ParsedColumnFormula =
  | { kind: "empty" }
  | { kind: "bare"; path: string }
  | { kind: "func"; fn: string; path: string; symbol: string; decimals: string; outFormat: string; inFormat: string }
  | { kind: "raw" };

function unquote(s: string): string {
  const m = s.match(/^"(.*)"$/);
  return m ? m[1] : s;
}

export function parseColumnFormula(formula: string): ParsedColumnFormula {
  const trimmed = formula.trim();
  if (!trimmed) return { kind: "empty" };
  const wrapped = trimmed.match(/^\{(.*)\}$/s);
  if (!wrapped) return { kind: "raw" };
  const inner = wrapped[1];
  const call = inner.match(/^([A-Za-z]+)\((.*)\)$/s);
  if (call) {
    const fn = call[1].toUpperCase();
    const args = splitDelimited(call[2]);
    return {
      kind: "func",
      fn,
      path: args[0] ?? "",
      symbol: fn === "CURRENCY" ? unquote(args[1] ?? "R$") : "",
      decimals: fn === "CURRENCY" ? args[2] ?? "2" : fn === "NUMBER" ? args[1] ?? "2" : "",
      outFormat: fn === "DATE" ? unquote(args[1] ?? "DD/MM/YYYY") : "",
      inFormat: fn === "DATE" ? unquote(args[2] ?? "") : "",
    };
  }
  if (/^[\w.]+$/.test(inner)) return { kind: "bare", path: inner };
  return { kind: "raw" };
}

export function buildColumnFormula(fn: string, path: string, symbol: string, decimals: string, outFormat: string, inFormat: string): string {
  if (!path.trim()) return "";
  if (!fn) return `{${path.trim()}}`;
  if (fn === "CURRENCY") return `{CURRENCY(${path.trim()}, "${symbol || "R$"}", ${decimals || "2"})}`;
  if (fn === "NUMBER") return `{NUMBER(${path.trim()}, ${decimals || "2"})}`;
  if (fn === "DATE") return `{DATE(${path.trim()}, "${outFormat || "DD/MM/YYYY"}"${inFormat ? `, "${inFormat}"` : ""})}`;
  return `{${fn}(${path.trim()})}`;
}

// Fora do modo de edição, esconde a função por trás do token (ex:
// "{CURRENCY(tarKandir, "R$", 2)}" vira só "{tarKandir}") — o tipo de
// dado (ver PropertyPanel) continua valendo na hora de gerar o PDF, só
// não polui o preview do canvas com a fórmula inteira. Célula com texto
// fixo + token misturado (ex: "FAT-{fatura}") não bate no formato função
// isolada, então fica como está.
export function displayCell(cell: string): string {
  const wrapped = cell.trim().match(/^\{(.*)\}$/s);
  if (!wrapped) return cell;
  const call = wrapped[1].match(/^[A-Za-z]+\((.*)\)$/s);
  if (!call) return cell;
  const path = call[1].split(",")[0]?.trim();
  return path ? `{${path}}` : cell;
}
