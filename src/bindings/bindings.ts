import type { Binding, ChartFilterCondition, ChartFilterGroup, TableColumn } from "../types";
import { CHART_COLORS, CHART_OTHER_COLOR } from "../fields/chart/colors";
import { en } from "../i18n/locales/en";
import type { Dict } from "../i18n";
import { renderTemplateLenient, resolveTokenLenient } from "../expressions/resolve";
import { asRecord, compareValues, getCaseInsensitive, stringifyOrEmpty } from "../expressions/dataAccess";

// getCaseInsensitive mora em expressions/dataAccess.ts desde a AST (o motor
// de expressões não pode importar deste arquivo — seria ciclo). Continua
// exportado daqui porque é API pública e há quem já importe deste caminho
// (ex: pdf/render/renderSection.ts).
export { getCaseInsensitive };

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
// `snippet` aqui é o exemplo em PT-BR. O que a UI mostra vem do dicionário
// (`t.fieldFunctionSnippets[hintKey]`), porque só os nomes-de-exemplo dos
// argumentos mudam de idioma — os nomes de função são fixos. Mesmo arranjo de
// `MATERIAL_ICON_LABELS`/`materialIconLabels(locale)` em materialIcons.ts.
/** @deprecated `snippet` é fixo em PT-BR — use `t.fieldFunctionSnippets[fn.hintKey]`. */
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
  { name: "IF", snippet: 'IF(caminho == "valor", "então", "senão")', hintKey: "if" },
] as const satisfies readonly { name: string; snippet: string; hintKey: keyof Dict["fieldFunctions"] }[];

// Limite de aninhamento de {FUNCAO(FUNCAO(...))} — sem isso, um template
// mal-formado (ou malicioso, em cenário multi-tenant onde o template vem de
// fonte não confiável) tipo `{CURRENCY(CURRENCY(CURRENCY(...)))}` repetido
// milhares de vezes estoura a call stack do V8 silenciosamente (crash, não
// erro tratável). 40 níveis cobre qualquer aninhamento legítimo de verdade
// (uso real observado nunca passa de 2-3) com folga generosa.
// Resolve UM token de template (o conteúdo de dentro das chaves, sem elas).
//
// Assinatura e retorno preservados de propósito: `renderTemplate` abaixo e
// todo consumidor externo continuam iguais, e a suíte de testes que já existia
// vale como prova de que o motor novo não regrediu.
//
// Expressão sintaticamente inválida resolve pra "" em vez de estourar: um
// `{CONCAT(a,)}` esquecido deixa AQUELE campo vazio, não derruba o PDF
// inteiro (era o raio de alcance do motor anterior, e trocar "um campo em
// branco" por "nenhum relatório" não seria melhoria). O erro aparece no
// editor, pelo aviso do campo — ver expressionError/templateExpressionErrors
// em expressions/resolve.ts e fieldWarnings.ts.
//
// O parâmetro `depth` é aceito e ignorado — a profundidade agora é controlada
// dentro do parser (MAX_EXPRESSION_DEPTH em expressions/engine/parse.ts), onde ela
// mede aninhamento de verdade em vez de mascarar recursão infinita como no
// motor anterior. Mantido na assinatura para não quebrar quem chama com 3
// argumentos.
export function resolveToken(token: string, data: unknown, _depth = 0): string {
  return resolveTokenLenient(token, data);
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
  return renderTemplateLenient(template, data);
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
        // Resolvido à parte (ver render/renderChart.ts) — precisa do array bruto pra
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

export function matchesFilterGroups(item: Record<string, unknown>, groups: ChartFilterGroup[] | undefined): boolean {
  if (!groups || groups.length === 0) return true;
  return groups.some((group) => group.every((cond: ChartFilterCondition) => compareValues(item[cond.column], cond.op, cond.value)));
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
