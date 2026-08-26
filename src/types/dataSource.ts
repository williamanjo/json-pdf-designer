// Fonte de dados conhecida (array detectado no JSON de exemplo) — quem
// consome a lib pode passar essa lista (ver Designer/PropertyPanel) pra
// trocar o campo de texto livre da tabela por um dropdown, tipo o
// "Data Source" do Stimulsoft/FastReport. Sem essa lista, a tabela volta
// a aceitar path digitado livre (comportamento de sempre).
// "number" (JS typeof number no JSON de exemplo) — usado pelo "+" de
// adicionar coluna pra já nascer com formatação de moeda, sem precisar
// abrir o seletor de tipo depois. Campo ausente/outro tipo = trata como
// texto puro (comportamento de sempre).
export type DataSourceColumnType = "number" | "string" | "boolean" | "other";

export type DataSourceOption = {
  path: string;
  label: string;
  columns?: string[];
  columnTypes?: Record<string, DataSourceColumnType>;
};

// Payload arrastado de um "chip" de coluna (PropertyPanel, seção vinculada
// a um array com colunas conhecidas) até o canvas — soltar cria os dois
// campos (header + valor), ambos já membros da seção (ver PageCanvas.tsx).
export type SectionColumnDragPayload = { sectionId: string; column: string };
