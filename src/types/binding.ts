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

export type Binding =
  | { schemaName: string; type: "scalar"; path: string }
  | { schemaName: string; type: "array"; path: string; columns: TableColumn[] }
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
    };
