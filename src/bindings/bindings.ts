import type { Binding, ChartFilterCondition, ChartFilterGroup, ChartFilterOp, TableColumn } from "../types";
import { splitDelimited } from "./splitDelimited";
import { formatPtBrNumber } from "../numberFormat";
import { CHART_COLORS, CHART_OTHER_COLOR } from "../chart/colors";
import { en } from "../i18n/en";
import type { Dict } from "../i18n";

function getCaseInsensitive(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.split(".");
  let cur = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object" || Array.isArray(cur)) return undefined;
    const rec = cur as Record<string, unknown>;
    const lo = part.toLowerCase();
    const key = Object.keys(rec).find(k => k.toLowerCase() === lo);
    if (key === undefined) return undefined;
    cur = rec[key];
  }
  return cur;
}

// "campo/valor ausente" -> "" — regra repetida em todo lugar que serializa
// um valor cru do JSON pra string de saída (path não bate, ou bate em
// null/undefined).
function stringifyOrEmpty(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

// Normaliza um item de array pra Record antes de indexar por chave — item
// pode não ser objeto (string solta, número, null) num array "sujo"; nesse
// caso trata como sem nenhuma chave, em vez de deixar o indexamento explodir.
function asRecord(item: unknown): Record<string, unknown> {
  return item && typeof item === "object" ? (item as Record<string, unknown>) : {};
}

// "rows.total_amount" -> array "rows" + coluna "total_amount" (sempre o
// último pedaço depois do ponto). Usada tanto pra extrair números
// (numbersFromArrayPath) quanto pra só contar itens (COUNT).
function splitArrayPath(rawPath: string): { arrayPath: string; column: string } {
  const lastDot = rawPath.lastIndexOf(".");
  return {
    arrayPath: lastDot === -1 ? rawPath : rawPath.slice(0, lastDot),
    column: lastDot === -1 ? "" : rawPath.slice(lastDot + 1),
  };
}

export function columnLabel(col: TableColumn): string {
  return typeof col === "string" ? col : col.label;
}

// Sem uso interno no repo hoje (só columnLabel é consumida aqui dentro) —
// mantida como parte da API pública (reexportada em index.ts/server.ts)
// pra quem consome o pacote precisar de uma chave estável por coluna
// (rótulo sozinho não serve pra coluna calculada, que pode repetir label).
export function columnKey(col: TableColumn): string {
  return typeof col === "string" ? col : `formula:${col.label}`;
}

// Texto descrevendo o vínculo — pra listas/uso em UI (detalhe completo,
// com colunas). `t` só entra pro rótulo genérico de "chave/valor"/"seção
// repetida" — o resto (path, nomes de coluna) é o dado real, alheio a
// idioma.
export function describeBinding(binding: Binding, t: Dict = en): string {
  switch (binding.type) {
    case "scalar":
      return binding.path;
    case "template":
      return binding.template;
    case "array":
      return `${binding.path} [${binding.columns.map(columnLabel).join(", ")}]`;
    case "keyvalue":
      return `${t.binding.keyValue} [${binding.paths.join(", ")}]`;
    case "section":
      return `${binding.path} ${t.binding.repeatedSection}`;
    case "chart":
      return `${binding.path} [${binding.labelColumn} / ${binding.valueColumn}]`;
    case "kpi":
      return `${binding.path} [${binding.aggregation}${binding.valueColumn ? "/" + binding.valueColumn : ""}]`;
  }
}

// Versão curta — só a fonte do dado, sem listar colunas (pra espaço apertado).
export function describeBindingShort(binding: Binding, t: Dict = en): string {
  switch (binding.type) {
    case "scalar":
      return binding.path;
    case "template":
      return binding.template;
    case "array":
      return binding.path;
    case "keyvalue":
      return t.binding.keyValue;
    case "section":
      return binding.path;
    case "chart":
      return binding.path;
    case "kpi":
      return binding.path;
  }
}

// Funções disponíveis num campo personalizado, usadas dentro de {...} no
// template — ex: "Total: {SUM(rows.total_amount)} em {COUNT(rows)} linhas".
// `hintKey` aponta pro texto explicativo em `t.fieldFunctions` (ver
// BindingEditor.tsx/PropertyPanelTable.tsx) — nome/snippet ficam fixos
// (sintaxe da função, não texto de UI).
export const CUSTOM_FIELD_FUNCTIONS = [
  { name: "SUM", snippet: "SUM(caminho.coluna)", hintKey: "sum" },
  { name: "COUNT", snippet: "COUNT(caminho)", hintKey: "count" },
  { name: "AVG", snippet: "AVG(caminho.coluna)", hintKey: "avg" },
  { name: "CONCAT", snippet: 'CONCAT(a, " ", b)', hintKey: "concat" },
  { name: "UPPER", snippet: "UPPER(caminho)", hintKey: "upper" },
  { name: "LOWER", snippet: "LOWER(caminho)", hintKey: "lower" },
  { name: "TRIM", snippet: "TRIM(caminho)", hintKey: "trim" },
  { name: "DATE", snippet: 'DATE(caminho, "DD/MM/YYYY", "DD/MM/YYYY")', hintKey: "date" },
  { name: "CURRENCY", snippet: 'CURRENCY(caminho, "R$", 2)', hintKey: "currency" },
  { name: "NUMBER", snippet: "NUMBER(caminho, 2)", hintKey: "number" },
] as const satisfies readonly { name: string; snippet: string; hintKey: keyof Dict["fieldFunctions"] }[];

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
  return stringifyOrEmpty(getCaseInsensitive(data, arg));
}

// "rows.total_amount" -> soma/conta a coluna "total_amount" do array "rows".
// O nome da coluna é sempre o último pedaço depois do ponto.
function numbersFromArrayPath(data: unknown, rawPath: string): number[] {
  const { arrayPath, column } = splitArrayPath(rawPath);
  const arr = getCaseInsensitive(data, arrayPath);
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
  const formatted = formatPtBrNumber(n, { decimals: d, forceDecimals: true });
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
      const { arrayPath } = splitArrayPath(args[0] ?? "");
      const arr = getCaseInsensitive(data, arrayPath);
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
      return stringifyOrEmpty(v);
    })
  );
}

// Renderiza um template livre tipo "Cliente: {nome} — Total: {SUM(rows.total)}",
// trocando cada {token} pelo valor do JSON (path direto) ou pelo resultado de
// uma função (SUM/COUNT/AVG/CONCAT/UPPER/LOWER/DATE/CURRENCY).
export function renderTemplate(template: string, data: unknown): string {
  return template.replace(/\{([^{}]+)\}/g, (_, inner) => resolveToken(inner, data));
}

function resolveScalarInput(binding: Extract<Binding, { type: "scalar" }>, data: unknown): string {
  return stringifyOrEmpty(getCaseInsensitive(data, binding.path));
}

function resolveTemplateInput(binding: Extract<Binding, { type: "template" }>, data: unknown): string {
  return renderTemplate(binding.template, data);
}

// Tabela "campo / valor": cada linha é um path escolhido manualmente, não um
// item de array.
function resolveKeyValueInput(binding: Extract<Binding, { type: "keyvalue" }>, data: unknown): string {
  const rows2d = binding.paths.map((path) => [path, stringifyOrEmpty(getCaseInsensitive(data, path))]);
  return JSON.stringify(rows2d);
}

// Transforma o array de objetos em array de arrays (uma linha por item, uma
// coluna por chave), já filtrado (binding.filters).
function resolveArrayInput(binding: Extract<Binding, { type: "array" }>, data: unknown): string {
  const filtered = filteredArrayAt(data, binding.path, binding.filters) ?? [];
  return JSON.stringify(rowsFromArrayBinding(filtered, binding.columns));
}

/**
 * Recebe o JSON real retornado pela sua query (ex: { rows: [...] }) e a
 * lista de bindings feitos no editor, e monta o objeto "inputs" — uma
 * string (ou JSON de linhas, pra tabela) por schemaName.
 */
export function buildInputs(data: unknown, bindings: Binding[]): Record<string, string> {
  const input: Record<string, string> = {};

  for (const binding of bindings) {
    switch (binding.type) {
      case "scalar":
        input[binding.schemaName] = resolveScalarInput(binding, data);
        break;
      case "template":
        input[binding.schemaName] = resolveTemplateInput(binding, data);
        break;
      case "keyvalue":
        input[binding.schemaName] = resolveKeyValueInput(binding, data);
        break;
      case "array":
        input[binding.schemaName] = resolveArrayInput(binding, data);
        break;
      case "section":
        // Resolvida à parte no generate.ts, item por item (repete o schema
        // inteiro) — não tem um valor único pra pré-computar aqui.
        break;
      case "chart":
        // Resolvido à parte (ver drawChart.ts) — precisa do array bruto pra
        // agregar, não de uma string pré-computada.
        break;
      case "kpi":
        // Resolvido à parte (ver generate.ts) — precisa do array bruto pra
        // filtrar/agregar, não de uma string pré-computada.
        break;
    }
  }

  return input;
}

export type ChartItem = { label: string; value: number; color: string };

// Compara o valor cru do item (`raw`) contra `value` (sempre string, vem do
// input do painel) segundo `op`. Number(...) dos dois lados quando possível
// (compara como número — "10" > "9" numérico, não lexicográfico); cai pra
// texto case-insensitive quando um dos dois não é número, ou sempre pra
// "contains". gt/gte/lt/lte exigem os dois lados numéricos — não bate se
// não der (nunca filtra tudo por engano/tipo errado, só não bate).
function matchesFilterCondition(raw: unknown, op: ChartFilterOp, value: string): boolean {
  if (op === "contains") return String(raw ?? "").toLowerCase().includes(value.toLowerCase());
  const numRaw = Number(raw);
  const numValue = Number(value);
  const bothNumeric = raw !== "" && raw !== null && raw !== undefined && value.trim() !== "" && !Number.isNaN(numRaw) && !Number.isNaN(numValue);
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

export function matchesFilterGroups(item: Record<string, unknown>, groups: ChartFilterGroup[] | undefined): boolean {
  if (!groups || groups.length === 0) return true;
  return groups.some((group) => group.every((cond: ChartFilterCondition) => matchesFilterCondition(item[cond.column], cond.op, cond.value)));
}

// Array bruto no `path` (getCaseInsensitive — mesma busca case-insensitive
// de qualquer outro vínculo), já filtrado por `filters`. `undefined` (não
// `[]`) quando o path não resolve pra array de verdade — distinção que quem
// chama precisa pra saber se cai num fallback (ex: conteúdo estático de
// design) ou se é só "array existe mas filtro zerou tudo" (aí É `[]` mesmo).
// Usada por buildInputs/resolveChartItems/resolveKpiValue aqui e por
// resolveTopLevelTableRows/resolveNestedTableRows (pdf/resolvers.ts) —
// um lugar só pra "pega array no path, filtra", em vez de cada consumidor
// reimplementar o próprio getCaseInsensitive+filter.
export function filteredArrayAt(data: unknown, path: string, filters: ChartFilterGroup[] | undefined): unknown[] | undefined {
  const arr = getCaseInsensitive(data, path);
  if (!Array.isArray(arr)) return undefined;
  return arr.filter((item) => matchesFilterGroups(asRecord(item), filters));
}

// Lê o array bruto do vínculo "chart", aplica `filters` (grupos OU de
// condições E — ver types/binding.ts) e extrai {label, value} de cada item
// restante (labelColumn/valueColumn) — sem agregar ainda.
export function resolveChartItems(binding: Extract<Binding, { type: "chart" }>, data: unknown): { label: string; value: number }[] {
  const filtered = filteredArrayAt(data, binding.path, binding.filters) ?? [];
  return filtered
    .map((item) => {
      const obj = asRecord(item);
      const rawLabel = obj[binding.labelColumn];
      const rawValue = Number(obj[binding.valueColumn]);
      return {
        label: stringifyOrEmpty(rawLabel),
        value: Number.isNaN(rawValue) ? 0 : rawValue,
      };
    });
}

// Lê o array bruto do vínculo "kpi", aplica `filters` (mesma regra do
// chart) e agrega a coluna `valueColumn` segundo `aggregation` — "count"
// ignora `valueColumn` (conta as linhas filtradas).
export function resolveKpiValue(binding: Extract<Binding, { type: "kpi" }>, data: unknown): number {
  const filtered = filteredArrayAt(data, binding.path, binding.filters) ?? [];
  if (binding.aggregation === "count") return filtered.length;
  const nums = filtered
    .map((item) => Number(asRecord(item)[binding.valueColumn ?? ""]))
    .filter((n) => !Number.isNaN(n));
  if (nums.length === 0) return 0;
  switch (binding.aggregation) {
    case "avg":
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "min":
      return Math.min(...nums);
    case "max":
      return Math.max(...nums);
    default:
      return nums.reduce((a, b) => a + b, 0); // "sum"
  }
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
  sortBy: ChartSortBy = "value_desc",
  palette: readonly string[] = CHART_COLORS
): { items: ChartItem[]; total: number } {
  const sorted = raw.slice().sort(compareChartItems(sortBy));
  const cutoff = topN > 0 ? topN : sorted.length;
  const top = sorted.slice(0, cutoff);
  const rest = sorted.slice(cutoff);
  const total = sorted.reduce((sum, d) => sum + d.value, 0);
  const items: ChartItem[] = top.map((d, i) => ({ label: d.label, value: d.value, color: palette[i % palette.length] }));
  if (rest.length > 0) {
    const restSum = rest.reduce((sum, d) => sum + d.value, 0);
    items.push({ label: `Outros (${rest.length})`, value: restSum, color: CHART_OTHER_COLOR });
  }
  return { items, total };
}
