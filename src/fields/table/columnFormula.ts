import { splitDelimited } from "../../bindings/splitDelimited";

// A column formula with no extra state: everything is derived from the
// STRING itself (parse) and rewritten into it (build) on every change of the
// "Data type" picker — it only works for a "clean" format (empty, a bare
// {path}, or ONE single function call, such as {CURRENCY(price, "R$", 2)});
// a formula with a literal prefix mixed in (e.g. "FAT-{fatura}") falls back
// to "raw" and only shows the usual free text field — there is no way to
// decompose that into a picker without losing the prefix.
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
  if (call) {
    const path = call[1].split(",")[0]?.trim();
    return path ? `{${unbracketPath(path)}}` : cell;
  }
  // Sem chamada de função: ainda vale esconder os brackets. Eles são a forma
  // GRAVADA (explícita, sem ambiguidade), mas na célula do canvas viram
  // ruído — `{[id]}` numa tabela de 68 colunas é 68 pares de brackets pra
  // ler. O que sai daqui é só display; o dado continua bracketado.
  const curto = unbracketPath(wrapped[1]);
  return curto === wrapped[1] ? cell : `{${curto}}`;
}

// `[id]` -> `id`, `["a b"]` -> `a b`, `[a].[b]` -> `a.b`. Só desenho: nunca
// alimenta parse nem gravação, porque a volta seria ambígua (é exatamente a
// ambiguidade que os brackets existem pra resolver).
function unbracketPath(path: string): string {
  return path.replace(/\[(?:"([^"]*)"|'([^']*)'|([^\]]*))\]/g, (_m, dq, sq, bare) => dq ?? sq ?? bare ?? "");
}

// --- tokenFor: a ÚNICA coisa que decide como uma chave vira token ---------
//
// Passam por aqui: a tabela recém-vinculada (makeBoundTable), a normalização
// do que já está salvo, e os chips do ƒx. Uma segunda regra em qualquer um
// desses lugares divergiria da primeira no dia em que uma fosse ajustada.
//
// Sempre com brackets, mesmo pra chave trivial como `id`. Uniforme: quem lê a
// fórmula vê a mesma forma em toda coluna e não precisa saber quais chaves são
// "perigosas". O `displayCell` esconde os brackets na célula do canvas, então
// o que se lê ali continua curto.
export function tokenFor(key: string): string {
  return `{${segmentFor(key)}}`;
}

// Um segmento bracketado, com quotes só quando o conteúdo exige. A escolha da
// quote é por CONTEÚDO, não fixa: chave que contém `"` sai entre `'`, e
// vice versa — the lexer accepts both and has no escape, so swapping the
// quote is what resolves it without inventing syntax.
export function segmentFor(key: string): string {
  // A bracket in the key ALSO requires quotes, not just a space: without
  // this, `segmentFor("[a]")` came out as `[[a]]`, and the lexer would close
  // the segment at the first `]` — reading the key as `"[a"`. It was the
  // round-trip test that caught it.
  if (!/[\s"'[\]]/.test(key)) return `[${key}]`;
  const quote = key.includes('"') ? "'" : '"';
  return `[${quote}${key}${quote}]`;
}

// --- columnFormulaFor: a MESMA precedência que o PDF usa ------------------
//
// O bug relatado ("o ƒx da coluna abre vazio") era esta precedência invertida:
// o painel lia `binding.columns[i]` e só quando era objeto, enquanto o PDF lê
// `content[0][i]` primeiro (ver pdf/resolvers.ts). Numa tabela vinculada por
// fonte de dados, `columns[i]` é string crua e `content[0][i]` tem o token —
// ou seja o editor lia o depósito de fallback e o PDF o principal, então o
// token existia, funcionava, e a interface nunca o mostrava.
//
// Uma função só, usada pelo painel e pelos testes, pra ela não voltar a
// divergir do resolver.
export function columnFormulaFor(
  content: string[][] | undefined,
  columns: readonly (string | { label: string; formula: string })[] | null | undefined,
  index: number
): string {
  const cell = content?.[0]?.[index];
  // Mesma condição do resolver: célula SEM chave nenhuma (ex: "PNR0000", o
  // preview de uma tabela recém-criada) não conta como template.
  if (cell && cell.includes("{")) return cell;
  const col = columns?.[index];
  if (col && typeof col !== "string") return col.formula;
  return "";
}
