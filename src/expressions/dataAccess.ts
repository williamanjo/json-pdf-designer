import type { ChartFilterOp } from "../types";

// Acesso ao dado e comparação de valores — as peças que TANTO o motor de
// expressões QUANTO os vínculos (filtros de chart/tabela/KPI) usam.
//
// Mora aqui, e não em bindings.ts, só por causa de ciclo de import: o
// bindings.ts passou a importar o motor de expressões, então o motor não pode
// importar de volta o bindings.ts. As implementações são as mesmas de antes,
// movidas sem alteração de comportamento.

// Busca `path` ("a.b.c") em `obj` ignorando maiúsculas/minúsculas em cada
// pedaço — JSON de sistema legado costuma vir com chave em caixa diferente
// da que o template escreveu.
// Caminha por SEGMENTOS já divididos. Existe separado porque um segmento pode
// conter ponto (`{["a.b"]}`), e aí dividir a string aqui dentro desfaria
// justamente a distinção que os brackets fizeram.
export function getCaseInsensitiveSegments(obj: unknown, segments: string[]): unknown {
  if (segments.length === 0) return obj;
  let cur = obj;
  for (const part of segments) {
    if (cur === null || cur === undefined || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    const rec = cur as Record<string, unknown>;
    const lo = part.toLowerCase();
    const key = Object.keys(rec).find((k) => k.toLowerCase() === lo);
    if (key === undefined) return undefined;
    cur = rec[key];
  }
  return cur;
}

// Forma por STRING, mantida porque ~6 chamadores fora do motor de expressão
// (KPI, gráfico, filtros) guardam o caminho como texto com pontos. Aqui o
// ponto separa, que é o contrato de sempre pra esses campos.
export function getCaseInsensitive(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return getCaseInsensitiveSegments(obj, path.split("."));
}

// "campo/valor ausente" -> "" — regra repetida em todo lugar que serializa um
// valor cru do JSON pra string de saída (path não bate, ou bate em
// null/undefined).
export function stringifyOrEmpty(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

// Normaliza um item de array pra Record antes de indexar por chave — item pode
// não ser objeto (string solta, número, null) num array "sujo"; nesse caso
// trata como sem nenhuma chave, em vez de deixar o indexamento explodir.
export function asRecord(item: unknown): Record<string, unknown> {
  return item && typeof item === "object" ? (item as Record<string, unknown>) : {};
}

// "rows.total_amount" -> array "rows" + coluna "total_amount" (sempre o último
// pedaço depois do ponto). Usada tanto pra extrair números
// (numbersFromArrayPath) quanto pra só contar itens (COUNT).
export function splitArrayPath(rawPath: string): { arrayPath: string; column: string } {
  const lastDot = rawPath.lastIndexOf(".");
  return {
    arrayPath: lastDot === -1 ? rawPath : rawPath.slice(0, lastDot),
    column: lastDot === -1 ? "" : rawPath.slice(lastDot + 1),
  };
}

// "rows.total_amount" -> os números da coluna "total_amount" do array "rows".
// Item não-numérico é descartado (não vira 0), pra uma linha suja não puxar a
// média pra baixo.
export function numbersFromArrayPath(data: unknown, rawPath: string): number[] {
  const { arrayPath, column } = splitArrayPath(rawPath);
  const arr = getCaseInsensitive(data, arrayPath);
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => Number(column ? asRecord(item)[column] : item)).filter((n) => !Number.isNaN(n));
}

// Compara o valor cru (`raw`) contra `value` (sempre string) segundo `op`.
// Number(...) dos dois lados quando possível (compara como número — "10" > "9"
// numérico, não lexicográfico); cai pra texto case-insensitive quando um dos
// dois não é número, ou sempre pra "contains". gt/gte/lt/lte exigem os dois
// lados numéricos — não bate se não der (nunca filtra tudo por engano/tipo
// errado, só não bate).
//
// Usada pelos filtros de chart/tabela/KPI e pela comparação do {IF(...)} —
// mesma regra nos dois, de propósito.
export function compareValues(raw: unknown, op: ChartFilterOp, value: string): boolean {
  if (op === "contains") return String(raw ?? "").toLowerCase().includes(value.toLowerCase());
  const numRaw = Number(raw);
  const numValue = Number(value);
  const bothNumeric =
    raw !== "" && raw !== null && raw !== undefined && value.trim() !== "" && !Number.isNaN(numRaw) && !Number.isNaN(numValue);
  if (op === "eq" || op === "neq") {
    const equal = bothNumeric ? numRaw === numValue : String(raw ?? "").toLowerCase() === value.toLowerCase();
    return op === "eq" ? equal : !equal;
  }
  if (!bothNumeric) return false;
  if (op === "gt") return numRaw > numValue;
  if (op === "gte") return numRaw >= numValue;
  if (op === "lt") return numRaw < numValue;
  return numRaw <= numValue; // "lte"
}
