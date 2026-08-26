// Coluna de tabela: chave crua do JSON, ou coluna calculada (rótulo fixo +
// fórmula avaliada por linha, path relativo ao item do array).
export type TableColumn = string | { label: string; formula: string };

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
  | { schemaName: string; type: "chart"; path: string; labelColumn: string; valueColumn: string };
