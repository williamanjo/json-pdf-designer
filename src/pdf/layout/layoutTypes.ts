import type { Schema, SectionSchema, TableSchema, TemplatePage } from "../../types";

// Um item do corpo, na ordem em que aparece na página — tabela e seção
// paginam de verdade (podem consumir várias fatias/repetições, inclusive
// virando página); uma "row" (texto/imagem/gráfico/indicador) não pagina
// sozinha, só ocupa a própria altura no fluxo. Uma "row" pode ter mais de
// um schema — todo campo (não tabela/seção) que compartilha o MESMO y
// autorado vira uma linha só (ver buildBodyItems em bodyLayout.ts),
// preservando o X de cada um: sem isso, dois campos lado a lado (ex: dois
// indicadores de KPI na mesma linha) cascateariam um embaixo do outro,
// porque o fluxo sequencial reescreve o Y de cada item pelo cursor — sem
// essa junção, cada um vira seu próprio "próximo item da sequência" e
// perde a posição relativa aos vizinhos da mesma linha.
export type BodyItem =
  | { kind: "table"; schema: TableSchema }
  | { kind: "section"; schema: SectionSchema }
  | { kind: "row"; schemas: Schema[]; y: number; height: number };

// Forma comum de "onde/quanto espaço" um BodyItem ocupa no fluxo — usada
// por boundsOf (retorno) e gapAfter (parâmetros), em bodyLayout.ts.
export type FlowBounds = { y: number; height: number };

// Tudo que renderPageDef (generate.ts) precisa de UMA página-design já
// pré-processada — computado uma vez em generatePdf (deriveBodyLayout +
// countBodyPages), reusado tanto pro dry-run de {pageCount} quanto pro
// desenho de verdade.
export type PreparedPageDef = {
  pageDef: TemplatePage;
  repeatingSchemas: Schema[];
  bodyItems: BodyItem[];
  headerHeight: number;
  bodyBottomMm: number;
  pageCount: number;
};
