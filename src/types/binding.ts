// Coluna de tabela: chave crua do JSON, ou coluna calculada (rótulo fixo +
// fórmula avaliada por linha, path relativo ao item do array).
export type TableColumn = string | { label: string; formula: string };

export type ChartFilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";

// Uma condição de filtro do gráfico — compara `column` (chave do item do
// array vinculado) contra `value` usando `op`. Comparação numérica quando
// os dois lados dão pra converter em número (ver bindings.ts), senão texto
// (case-insensitive) — "contains" é sempre texto.
export type ChartFilterCondition = { column: string; op: ChartFilterOp; value: string };

// Um grupo é uma lista de condições combinadas com E (todas precisam bater).
export type ChartFilterGroup = ChartFilterCondition[];

export type KpiAggregation = "sum" | "count" | "avg" | "min" | "max";

export type Binding =
  | { schemaName: string; type: "scalar"; path: string }
  // Vínculo de uma TableSchema — path aponta pro array, columns mapeia
  // cada coluna da tabela (chave crua ou {label,formula} calculada por
  // linha). `filters` (opcional) — mesmo formato do chart (grupos OU de
  // condições E) — item só vira linha se bater em pelo menos um grupo
  // inteiro; sem filtro nenhum, toda linha entra (comportamento de sempre).
  | { schemaName: string; type: "array"; path: string; columns: TableColumn[]; filters?: ChartFilterGroup[] }
  | { schemaName: string; type: "keyvalue"; paths: string[] }
  | { schemaName: string; type: "template"; template: string }
  // Vínculo de uma SectionSchema — path aponta pro array a repetir. Os
  // campos DENTRO da seção têm seus próprios vínculos nesta mesma lista
  // (por nome), resolvidos contra cada ITEM do array, não o documento
  // inteiro — ver generate.ts.
  | { schemaName: string; type: "section"; path: string }
  // Vínculo de uma ChartSchema — path aponta pro array a agregar;
  // labelColumn é a chave do rótulo de cada fatia/barra, valueColumn a
  // chave numérica somada por rótulo (ex: "valor" ou "quantidade").
  // `filters` (opcional) — lista de GRUPOS combinados com OU; dentro de
  // cada grupo, as condições combinam com E. Item do array só entra na
  // agregação se bater em pelo menos um grupo inteiro (ou sem filtro
  // nenhum = todo mundo entra, comportamento de sempre).
  | {
      schemaName: string;
      type: "chart";
      path: string;
      labelColumn: string;
      valueColumn: string;
      filters?: ChartFilterGroup[];
    }
  // Vínculo de uma KpiSchema — path aponta pro array a agregar; valueColumn
  // é a coluna numérica somada/mediada/etc (ignorada quando
  // aggregation === "count", que só conta as linhas filtradas). Sem esse
  // vínculo, o KPI resolve `value` como template livre de sempre (ver
  // bindings.ts) — presente, ele manda: `value` vira o resultado calculado,
  // o template do campo é ignorado.
  | {
      schemaName: string;
      type: "kpi";
      path: string;
      valueColumn?: string;
      aggregation: KpiAggregation;
      filters?: ChartFilterGroup[];
    };
