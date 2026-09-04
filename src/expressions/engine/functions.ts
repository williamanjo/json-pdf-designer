import type { Expr } from "./parse";
import { getCaseInsensitive, numbersFromArrayPath, splitArrayPath } from "../dataAccess";
import { formatCurrency, formatDate } from "./formatters";

export type Value = string | number;

// O que uma função de template recebe. Os argumentos chegam como AST **não
// avaliada**, mais os callbacks de avaliação — de propósito:
//
// - `IF` é preguiçoso: só o ramo escolhido é avaliado. `{IF(existe, valor,
//   "N/A")}` não pode explodir porque o ramo NÃO usado tem um path que não
//   resolve.
// - `SUM`/`COUNT`/`AVG` recebem um **path de array**, não um valor: em
//   `SUM(itens.total)`, `itens.total` não é "o valor em itens.total" e sim
//   "a coluna total do array itens". Por isso usam `argSources` (o texto cru)
//   em vez do argumento avaliado.
export type FnContext = {
  data: unknown;
  args: Expr[];
  argSources: string[];
  // Avalia o argumento `index` como string. "" quando o argumento não existe.
  str(index: number): string;
  // Avalia como valor (string ou número), preservando o tipo.
  val(index: number): Value;
  // Verdade/falsidade do argumento `index` — comparação quando é uma, senão a
  // regra de truthiness do formato (ver isTruthy em evaluate.ts).
  truthy(index: number): boolean;
};

type ExpressionFunction = (ctx: FnContext) => Value;

// Casas decimais de um argumento opcional. Number("") é 0, não NaN — se o
// argumento não resolver pra nada (path errado etc), "" não pode virar "0
// casas decimais" em silêncio; cai no default.
function decimalsArg(ctx: FnContext, index: number, fallback = 2): number {
  if (ctx.args[index] === undefined) return fallback;
  const raw = ctx.str(index);
  if (raw === "") return fallback;
  const n = Number(raw);
  return Number.isNaN(n) ? fallback : n;
}

export const FUNCTIONS: Record<string, ExpressionFunction> = {
  SUM: (ctx) => numbersFromArrayPath(ctx.data, ctx.argSources[0] ?? "").reduce((a, b) => a + b, 0),

  COUNT: (ctx) => {
    const { arrayPath } = splitArrayPath(ctx.argSources[0] ?? "");
    const arr = getCaseInsensitive(ctx.data, arrayPath);
    return Array.isArray(arr) ? arr.length : 0;
  },

  AVG: (ctx) => {
    const nums = numbersFromArrayPath(ctx.data, ctx.argSources[0] ?? "");
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  },

  CONCAT: (ctx) => ctx.args.map((_, i) => ctx.str(i)).join(""),

  UPPER: (ctx) => ctx.str(0).toUpperCase(),

  LOWER: (ctx) => ctx.str(0).toLowerCase(),

  // Tira espaço do início/fim — comum em export de sistema legado com campo
  // de largura fixa (ex: "fatura": " 01156189"). {CONCAT}/{token} direto
  // preservam o valor exatamente como veio (de propósito); pra tirar o espaço
  // sem depender do efeito colateral de Number(" x") (que também comeria zero
  // à esquerda), use TRIM explícito.
  TRIM: (ctx) => ctx.str(0).trim(),

  // 3º arg (opcional) diz o formato de ENTRADA — ex: DATE(vencto,
  // "DD/MM/YYYY", "DD/MM/YYYY") lê "10/04/2025" como 10 de abril, não deixa o
  // new Date(...) do JS adivinhar (americano, viraria outubro).
  DATE: (ctx) =>
    formatDate(
      ctx.str(0),
      ctx.args[1] !== undefined ? ctx.str(1) : "DD/MM/YYYY",
      ctx.args[2] !== undefined ? ctx.str(2) : undefined
    ),

  // 3º arg (opcional) = casas decimais, default 2 (padrão de moeda).
  CURRENCY: (ctx) => formatCurrency(ctx.str(0), ctx.args[1] !== undefined ? ctx.str(1) : "", decimalsArg(ctx, 2)),

  // Casas decimais controladas — tipo "%.2f" do C. Ex: NUMBER(qtd * preco, 2)
  // -> "160.00". Sem separador de milhar/símbolo (isso é o CURRENCY) — só
  // arredonda e fixa a quantidade de casas.
  NUMBER: (ctx) => {
    const raw = ctx.val(0);
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isNaN(n)) return "";
    return n.toFixed(decimalsArg(ctx, 1));
  },

  // {IF(condição, "então", "senão")} — condição pode ser uma comparação
  // ("status == \"paid\"", "total > 100") ou um path/expressão isolada
  // (checagem de verdadeiro/falso). Só o lado escolhido é avaliado.
  IF: (ctx) => (ctx.truthy(0) ? ctx.val(1) : ctx.val(2)),
};

export const FUNCTION_NAMES = Object.keys(FUNCTIONS);
