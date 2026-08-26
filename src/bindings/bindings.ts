import get from "lodash.get";
import type { Binding, TableColumn } from "../types";
import { splitDelimited } from "./splitDelimited";
import { CHART_COLORS, CHART_OTHER_COLOR } from "../chartColors";

export function columnLabel(col: TableColumn): string {
  return typeof col === "string" ? col : col.label;
}

export function columnKey(col: TableColumn): string {
  return typeof col === "string" ? col : `formula:${col.label}`;
}

// Texto descrevendo o vínculo — pra listas/uso em UI (detalhe completo,
// com colunas).
export function describeBinding(b: Binding): string {
  switch (b.type) {
    case "scalar":
      return b.path;
    case "template":
      return b.template;
    case "array":
      return `${b.path} [${b.columns.map(columnLabel).join(", ")}]`;
    case "keyvalue":
      return `chave/valor [${b.paths.join(", ")}]`;
    case "section":
      return `${b.path} (seção repetida)`;
    case "chart":
      return `${b.path} [${b.labelColumn} / ${b.valueColumn}]`;
  }
}

// Versão curta — só a fonte do dado, sem listar colunas (pra espaço apertado).
export function describeBindingShort(b: Binding): string {
  switch (b.type) {
    case "scalar":
      return b.path;
    case "template":
      return b.template;
    case "array":
      return b.path;
    case "keyvalue":
      return "chave/valor";
    case "section":
      return b.path;
    case "chart":
      return b.path;
  }
}

// Funções disponíveis num campo personalizado, usadas dentro de {...} no
// template — ex: "Total: {SUM(rows.total_amount)} em {COUNT(rows)} linhas".
export const CUSTOM_FIELD_FUNCTIONS = [
  { name: "SUM", snippet: "SUM(caminho.coluna)", hint: "soma uma coluna de um array" },
  { name: "COUNT", snippet: "COUNT(caminho)", hint: "conta itens de um array" },
  { name: "AVG", snippet: "AVG(caminho.coluna)", hint: "média de uma coluna de um array" },
  { name: "CONCAT", snippet: 'CONCAT(a, " ", b)', hint: "junta campos e textos fixos" },
  { name: "UPPER", snippet: "UPPER(caminho)", hint: "deixa em MAIÚSCULAS" },
  { name: "LOWER", snippet: "LOWER(caminho)", hint: "deixa em minúsculas" },
  { name: "TRIM", snippet: "TRIM(caminho)", hint: "tira espaço do início/fim do valor" },
  { name: "DATE", snippet: 'DATE(caminho, "DD/MM/YYYY", "DD/MM/YYYY")', hint: "formata data — 3º arg opcional diz o formato de entrada, evita americano '/' virar mês/dia trocado" },
  { name: "CURRENCY", snippet: 'CURRENCY(caminho, "R$", 2)', hint: "formata valor monetário — 3º arg opcional, casas decimais (default 2)" },
  { name: "NUMBER", snippet: "NUMBER(caminho, 2)", hint: "controla casas decimais, tipo %.2f do C" },
] as const;

function resolveArg(arg: string, data: unknown): string {
  const quoted = arg.match(/^"(.*)"$/);
  if (quoted) return quoted[1];
  // Literal numérico puro — ex: o "2" de NUMBER(valor, 2). Sem isso viraria
  // busca de path por engano (chave "2" não existe no JSON).
  if (/^-?\d+(\.\d+)?$/.test(arg)) return arg;
  // Argumento em si parece outra chamada de função ou uma expressão
  // aritmética (tem parênteses, ou operador com espaço dos dois lados) —
  // resolve recursivamente em vez de tratar como path cru, senão
  // CURRENCY(SUM(...)) ou NUMBER(qtd * preco, 2) nunca resolveriam (a busca
  // de path olharia pra string inteira "SUM(...)"/"qtd * preco" como se
  // fosse uma chave, e não achando nada, ficava vazio).
  if (/\(.*\)/.test(arg) || /\s[+\-*/]\s/.test(arg)) return resolveToken(arg, data);
  const v = get(data, arg);
  return v === undefined || v === null ? "" : String(v);
}

// "rows.total_amount" -> soma/conta a coluna "total_amount" do array "rows".
// O nome da coluna é sempre o último pedaço depois do ponto.
function numbersFromArrayPath(data: unknown, rawPath: string): number[] {
  const lastDot = rawPath.lastIndexOf(".");
  const arrayPath = lastDot === -1 ? rawPath : rawPath.slice(0, lastDot);
  const column = lastDot === -1 ? "" : rawPath.slice(lastDot + 1);
  const arr = get(data, arrayPath);
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => Number(column ? item?.[column] : item))
    .filter((n) => !Number.isNaN(n));
}

// Lê "raw" segundo um formato DADO (mesmos tokens do formato de saída) em
// vez de deixar o `new Date(raw)` do JS adivinhar — esse adivinha
// separador "/" como MM/DD/YYYY (americano), então uma data brasileira tipo
// "10/04/2025" (10 de abril) virava 10 de outubro, errado e calado (sem
// erro nenhum, só a data trocada). Só entra em jogo se o 3º arg do DATE(...)
// for informado; sem ele, mantém o `new Date(raw)` de sempre (compatível
// com entrada ISO "YYYY-MM-DD", que É não-ambígua e não precisa disso).
function parseDateWithFormat(raw: string, format: string): Date | null {
  const order: string[] = [];
  const escaped = format.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replace(/YYYY|MM|DD|HH|mm|ss/g, (tok) => {
    order.push(tok);
    return "(\\d+)";
  });
  const match = raw.match(new RegExp(`^${pattern}$`));
  if (!match) return null;
  const parts: Record<string, number> = {};
  order.forEach((tok, i) => {
    parts[tok] = Number(match[i + 1]);
  });
  // Construído em UTC (não no fuso local) — combina com a leitura em
  // formatDate abaixo, senão essa data (sempre "meia-noite exata" do dia
  // escrito) sofreria o MESMO deslocamento que essa função existe pra evitar.
  const d = new Date(
    Date.UTC(
      parts.YYYY ?? new Date().getUTCFullYear(),
      (parts.MM ?? 1) - 1,
      parts.DD ?? 1,
      parts.HH ?? 0,
      parts.mm ?? 0,
      parts.ss ?? 0
    )
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(raw: string, outputFormat: string, inputFormat?: string): string {
  if (!raw) return "";
  const d = inputFormat ? parseDateWithFormat(raw, inputFormat) : new Date(raw);
  if (!d || Number.isNaN(d.getTime())) return raw;
  // Getters UTC, não locais — "YYYY-MM-DD" (sem hora) é lido pelo motor JS
  // como meia-noite UTC; getFullYear()/getDate() locais then aplicam o
  // fuso do NAVEGADOR/SERVIDOR em cima disso, e em qualquer fuso atrás de
  // UTC (Brasil, EUA...) meia-noite UTC vira o dia ANTERIOR local — "2026-
  // 07-01" saía "30/06/2026", errado e silencioso. UTC aqui elimina isso:
  // a data sai igual ao que foi escrito, não importa o fuso de quem gera.
  const pad = (n: number) => String(n).padStart(2, "0");
  const tokens: Record<string, string> = {
    YYYY: String(d.getUTCFullYear()),
    MM: pad(d.getUTCMonth() + 1),
    DD: pad(d.getUTCDate()),
    HH: pad(d.getUTCHours()),
    mm: pad(d.getUTCMinutes()),
    ss: pad(d.getUTCSeconds()),
  };
  return outputFormat.replace(/YYYY|MM|DD|HH|mm|ss/g, (m) => tokens[m]);
}

function formatCurrency(raw: string, symbol: string, decimals: number): string {
  const n = Number(raw);
  if (Number.isNaN(n)) return raw;
  const d = Number.isNaN(decimals) ? 2 : decimals;
  const formatted = n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  return symbol ? `${symbol} ${formatted}` : formatted;
}

// Expressão aritmética simples dentro do próprio {...} — ex:
// "{valor_a + valor_b}", "{subtotal - desconto}", "{preco * quantidade}".
// Avalia da esquerda pra direita (sem precedência de operador, tipo
// calculadora) — cada operando é resolvido como path/número, igual um
// argumento normal. Não mexe em texto entre aspas nem em chamada de função
// (FUNC(...)) — só entra em jogo se sobrar operador de verdade separado
// por espaço dos dois lados.
function resolveArithmetic(trimmed: string, data: unknown): string | null {
  if (/^".*"$/.test(trimmed)) return null;
  const parts = trimmed.split(/\s+([+\-*/])\s+/);
  if (parts.length < 3 || parts.length % 2 === 0) return null;
  let acc = Number(resolveArg(parts[0], data));
  if (Number.isNaN(acc)) return null;
  for (let i = 1; i < parts.length; i += 2) {
    const op = parts[i];
    const rhs = Number(resolveArg(parts[i + 1], data));
    if (Number.isNaN(rhs)) return null;
    if (op === "+") acc += rhs;
    else if (op === "-") acc -= rhs;
    else if (op === "*") acc *= rhs;
    else if (rhs === 0) return null;
    else acc /= rhs;
  }
  // Arredonda ruído de ponto flutuante (ex: 12 * 22.9 -> 274.79999999999995)
  // sem cortar precisão de verdade — 6 casas decimais cobre qualquer conta
  // com dinheiro/quantidade, string final não carrega o lixo binário.
  return String(Math.round(acc * 1e6) / 1e6);
}

export function resolveToken(token: string, data: unknown): string {
  const trimmed = token.trim();
  const call = trimmed.match(/^([A-Za-z]+)\((.*)\)$/s);
  if (!call) {
    const arithmetic = resolveArithmetic(trimmed, data);
    return arithmetic ?? resolveArg(trimmed, data);
  }

  const fn = call[1].toUpperCase();
  const args = splitDelimited(call[2]);

  switch (fn) {
    case "SUM":
      return String(numbersFromArrayPath(data, args[0] ?? "").reduce((a, b) => a + b, 0));
    case "COUNT": {
      const arr = get(data, args[0] ?? "");
      return String(Array.isArray(arr) ? arr.length : 0);
    }
    case "AVG": {
      const nums = numbersFromArrayPath(data, args[0] ?? "");
      return nums.length ? String(nums.reduce((a, b) => a + b, 0) / nums.length) : "0";
    }
    case "CONCAT":
      return args.map((a) => resolveArg(a, data)).join("");
    case "UPPER":
      return resolveArg(args[0] ?? "", data).toUpperCase();
    case "LOWER":
      return resolveArg(args[0] ?? "", data).toLowerCase();
    case "TRIM":
      // Tira espaço do início/fim — comum em export de sistema legado com
      // campo de largura fixa (ex: "fatura": " 01156189"). {CONCAT}/{token}
      // direto preservam o valor exatamente como veio (de propósito); pra
      // tirar o espaço sem depender do efeito colateral de Number(" x")
      // (que também comeria zero à esquerda), use TRIM explícito.
      return resolveArg(args[0] ?? "", data).trim();
    case "DATE":
      // 3º arg (opcional) diz o formato de ENTRADA — ex: DATE(vencto,
      // "DD/MM/YYYY", "DD/MM/YYYY") lê "10/04/2025" como 10 de abril, não
      // deixa o new Date(...) do JS adivinhar (americano, viraria outubro).
      return formatDate(
        resolveArg(args[0] ?? "", data),
        args[1] ? resolveArg(args[1], data) : "DD/MM/YYYY",
        args[2] ? resolveArg(args[2], data) : undefined
      );
    case "CURRENCY": {
      // 3º arg (opcional) = casas decimais — default 2 (padrão de moeda).
      const rawDecimals = args[2] ? resolveArg(args[2], data) : "";
      return formatCurrency(
        resolveArg(args[0] ?? "", data),
        args[1] ? resolveArg(args[1], data) : "",
        rawDecimals === "" ? 2 : Number(rawDecimals)
      );
    }
    case "NUMBER": {
      // Casas decimais controladas — tipo "%.2f" do C. Ex: NUMBER(qtd *
      // preco, 2) -> "160.00". Sem separador de milhar/símbolo (isso é o
      // CURRENCY) — só arredonda e fixa a quantidade de casas.
      const n = Number(resolveArg(args[0] ?? "", data));
      // Number("") é 0, não NaN — se o 2º arg não resolver pra nada
      // (path errado etc), "" não pode virar 0 casas decimais silenciosamente.
      const rawDecimals = args[1] ? resolveArg(args[1], data) : "";
      const decimals = rawDecimals === "" ? 2 : Number(rawDecimals);
      return Number.isNaN(n) ? "" : n.toFixed(Number.isNaN(decimals) ? 2 : decimals);
    }
    default:
      return "";
  }
}

// Array de objetos -> array de linhas (uma por item, uma célula por
// coluna) — coluna calculada (formula) é avaliada por linha, com o path
// relativo ao próprio item. Usada tanto pra tabela vinculada ao documento
// inteiro (buildInputs) quanto pra tabela aninhada numa seção, vinculada
// ao ITEM atual (generate.ts).
export function rowsFromArrayBinding(list: unknown[], columns: TableColumn[]): string[][] {
  return list.map((item) =>
    columns.map((col) => {
      if (typeof col !== "string") {
        // Mesma regra de sempre: só o que tá dentro de {} vira token/função,
        // resto é texto fixo — ex: "FAT-{fatura}" (prefixo + token) ou
        // "{CURRENCY(total)}" (token isolado). Sem chave nenhuma, fica tudo
        // literal (sem mágica de "string inteira = 1 função implícita").
        return renderTemplate(col.formula.trim(), item);
      }
      const v = item ? (item as Record<string, unknown>)[col] : undefined;
      return v === undefined || v === null ? "" : String(v);
    })
  );
}

// Renderiza um template livre tipo "Cliente: {nome} — Total: {SUM(rows.total)}",
// trocando cada {token} pelo valor do JSON (path direto) ou pelo resultado de
// uma função (SUM/COUNT/AVG/CONCAT/UPPER/LOWER/DATE/CURRENCY).
export function renderTemplate(template: string, data: unknown): string {
  return template.replace(/\{([^{}]+)\}/g, (_, inner) => resolveToken(inner, data));
}

/**
 * Recebe o JSON real retornado pela sua query (ex: { rows: [...] }) e a
 * lista de bindings feitos no editor, e monta o objeto "inputs" — uma
 * string (ou JSON de linhas, pra tabela) por schemaName.
 */
export function buildInputs(data: unknown, bindings: Binding[]): Record<string, string> {
  const input: Record<string, string> = {};

  for (const b of bindings) {
    if (b.type === "scalar") {
      const value = get(data, b.path);
      input[b.schemaName] = value === undefined || value === null ? "" : String(value);
      continue;
    }

    if (b.type === "template") {
      input[b.schemaName] = renderTemplate(b.template, data);
      continue;
    }

    if (b.type === "keyvalue") {
      // Tabela "campo / valor": cada linha é um path escolhido manualmente,
      // não um item de array.
      const rows2d = b.paths.map((path) => {
        const v = get(data, path);
        return [path, v === undefined || v === null ? "" : String(v)];
      });
      input[b.schemaName] = JSON.stringify(rows2d);
      continue;
    }

    if (b.type === "section") {
      // Resolvida à parte no generate.ts, item por item (repete o schema
      // inteiro) — não tem um valor único pra pré-computar aqui.
      continue;
    }

    if (b.type === "chart") {
      // Resolvido à parte (ver drawChart.ts) — precisa do array bruto pra
      // agregar, não de uma string pré-computada.
      continue;
    }

    // "array": transforma o array de objetos em array de arrays (uma
    // linha por item, uma coluna por chave).
    const arr = get(data, b.path);
    const list = Array.isArray(arr) ? arr : [];
    input[b.schemaName] = JSON.stringify(rowsFromArrayBinding(list, b.columns));
  }

  return input;
}

export type ChartItem = { label: string; value: number; color: string };

// Lê o array bruto do vínculo "chart" e extrai {label, value} de cada item
// (labelColumn/valueColumn, ver types/binding.ts) — sem agregar ainda.
export function resolveChartItems(binding: Extract<Binding, { type: "chart" }>, data: unknown): { label: string; value: number }[] {
  const arr = get(data, binding.path);
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => {
    const obj = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const rawLabel = obj[binding.labelColumn];
    const rawValue = Number(obj[binding.valueColumn]);
    return {
      label: rawLabel === undefined || rawLabel === null ? "" : String(rawLabel),
      value: Number.isNaN(rawValue) ? 0 : rawValue,
    };
  });
}

export type ChartSortBy = "value_desc" | "value_asc" | "label_asc" | "label_desc";

function compareChartItems(sortBy: ChartSortBy) {
  return (a: { label: string; value: number }, b: { label: string; value: number }) => {
    if (sortBy === "value_asc") return a.value - b.value;
    if (sortBy === "label_asc") return a.label.localeCompare(b.label);
    if (sortBy === "label_desc") return b.label.localeCompare(a.label);
    return b.value - a.value; // "value_desc" — default, sempre foi assim
  };
}

// Ordena (por valor ou por rótulo, ver ChartSortBy), mantém os `topN`
// primeiros com cor fixa (ordem da paleta) e agrupa o resto numa
// fatia/barra "Outros" — nunca gera uma cor extra além das já validadas em
// chartColors.ts, não importa o critério de ordenação escolhido. `topN <= 0`
// desliga o agrupamento (mostra todo mundo, sem "Outros").
export function aggregateChartItems(
  raw: { label: string; value: number }[],
  topN = 7,
  sortBy: ChartSortBy = "value_desc"
): { items: ChartItem[]; total: number } {
  const sorted = raw.slice().sort(compareChartItems(sortBy));
  const cutoff = topN > 0 ? topN : sorted.length;
  const top = sorted.slice(0, cutoff);
  const rest = sorted.slice(cutoff);
  const total = sorted.reduce((sum, d) => sum + d.value, 0);
  const items: ChartItem[] = top.map((d, i) => ({ label: d.label, value: d.value, color: CHART_COLORS[i % CHART_COLORS.length] }));
  if (rest.length > 0) {
    const restSum = rest.reduce((sum, d) => sum + d.value, 0);
    items.push({ label: `Outros (${rest.length})`, value: restSum, color: CHART_OTHER_COLOR });
  }
  return { items, total };
}
