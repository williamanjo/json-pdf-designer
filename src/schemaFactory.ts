import type { Binding, ChartSchema, ImageSchema, KpiSchema, Schema, SectionSchema, TableSchema, TextSchema } from "./types";
import { snapToGrid } from "./page/units";
import { en } from "./i18n/locales/en";
import type { Dict } from "./i18n";
import { tokenFor } from "./fields/table/columnFormula";

// O mime do arrasto interno mudou de casa pra `src/drag.ts`, junto do payload
// externo — os dois são o mesmo contrato visto de lados diferentes, e um deles
// morando na fábrica de schemas era só onde sobrou espaço. Reexportado aqui
// porque vários call sites importam daqui.
export { SECTION_COLUMN_MIME } from "./drag";

export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

// Preâmbulo repetido de todo make*Schema abaixo — id novo, nome com
// sufixo aleatório (evita colisão entre campos do mesmo tipo), sempre
// nasce em x=10 (só y varia, empilhado abaixo do último campo — ver
// nextFreeY). width/height/type/resto ficam a cargo de cada função,
// que são específicos por tipo de campo.
function makeBase(namePrefix: string, nextY: number): { id: string; name: string; x: number; y: number } {
  return { id: uid(), name: `${namePrefix}_${Math.random().toString(36).slice(2, 6)}`, x: 10, y: nextY };
}

export function makeTextSchema(nextY: number, t: Dict = en): TextSchema {
  return {
    ...makeBase(t.schemaDefaults.textNamePrefix, nextY),
    type: "text",
    width: 80,
    height: 10,
    content: t.schemaDefaults.textContent,
    fontSize: 11,
    fontColor: "#000000",
    alignment: "left",
  };
}

export function makeTableSchema(nextY: number, t: Dict = en): TableSchema {
  return {
    ...makeBase(t.schemaDefaults.tableNamePrefix, nextY),
    type: "table",
    width: 150,
    height: 30,
    head: [t.schemaDefaults.column1, t.schemaDefaults.column2],
    content: [[t.schemaDefaults.value1, t.schemaDefaults.value2]],
  };
}

// Tabela JÁ VINCULADA a um caminho de array, com o token de cada coluna
// preenchido.
//
// Isto estava FORA do pacote: `onCanvasDrop` é passthrough cru, então quem
// montava schema+binding a partir de um caminho de array era o app. Os cinco
// examples do repo escreviam a mesma coisa à mão, e escreviam errado do mesmo
// jeito — `content: [columns.map((c) => c.toUpperCase())]`, um placeholder SEM
// chaves (`"DESCRICAO"`), que o resolver não conta como template. Resultado: a
// tabela ARRASTADA nascia sem token e o `ƒx` de cada coluna abria vazio,
// enquanto a vinculada pelo painel nascia com. Era o bug relatado.
//
// Aqui `content` e `binding.columns` saem os dois de `tokenFor`, então não há
// como um discordar do outro, e coluna de chave crua não é produzida em lugar
// nenhum.
export function makeBoundTable(
  nextY: number,
  path: string,
  columns: string[],
  t: Dict = en
): { schema: TableSchema; binding: Binding } {
  const base = makeBase(t.schemaDefaults.tableNamePrefix, nextY);
  const schema: TableSchema = {
    ...base,
    type: "table",
    width: 180,
    height: 30,
    // O título começa igual à chave; renomear depois (duplo clique na lista de
    // colunas) muda só ele e a referência fica, porque a referência mora na
    // fórmula.
    head: [...columns],
    content: [columns.map((c) => tokenFor(c))],
  };
  return {
    schema,
    binding: {
      schemaName: base.name,
      type: "array",
      path,
      columns: columns.map((c) => ({ label: c, formula: tokenFor(c) })),
    },
  };
}

export function makeImageSchema(nextY: number, t: Dict = en): ImageSchema {
  return {
    ...makeBase(t.schemaDefaults.imageNamePrefix, nextY),
    type: "image",
    width: 40,
    height: 40,
    content: "",
  };
}

export function makeSectionSchema(nextY: number, t: Dict = en): SectionSchema {
  return {
    ...makeBase(t.schemaDefaults.sectionNamePrefix, nextY),
    type: "section",
    width: 190,
    height: 20,
  };
}

// Soltar uma coluna da seção no canvas cria DOIS campos membros dela
// (mesmo padrão clássico de cabeçalho+dado, só que como par de campos
// livres em vez de linha de tabela): um rótulo estático (nome da coluna) e
// um valor já vinculado por template ({coluna}), lado a lado. x/y já
// chegam prontos de quem chama (PageCanvas.tsx já decide se cai na grade
// ou não, conforme Shift) — não arredonda de novo aqui.
export function makeSectionColumnPair(
  sectionId: string,
  column: string,
  x: number,
  y: number,
  t: Dict = en
): { header: TextSchema; value: TextSchema; valueBinding: Binding } {
  const safeCol = column.replace(/[^a-zA-Z0-9]/g, "_");
  const suffix = Math.random().toString(36).slice(2, 6);
  const fieldWidth = 45;
  const gap = 5;
  const header: TextSchema = {
    id: uid(),
    name: `${t.schemaDefaults.headerNamePrefix}_${safeCol}_${suffix}`,
    type: "text",
    x,
    y,
    width: fieldWidth,
    height: 10,
    content: column,
    fontSize: 9,
    fontColor: "#64748b",
    alignment: "left",
    sectionId,
  };
  const value: TextSchema = {
    id: uid(),
    name: `${t.schemaDefaults.valueNamePrefix}_${safeCol}_${suffix}`,
    type: "text",
    x: x + fieldWidth + gap,
    y,
    width: fieldWidth,
    height: 10,
    content: `{${column}}`,
    fontSize: 10,
    fontColor: "#000000",
    alignment: "left",
    sectionId,
  };
  return { header, value, valueBinding: { schemaName: value.name, type: "template", template: `{${column}}` } };
}

export function makeChartSchema(nextY: number, t: Dict = en): ChartSchema {
  return {
    ...makeBase(t.schemaDefaults.chartNamePrefix, nextY),
    type: "chart",
    width: 100,
    height: 70,
    chartType: "pie",
    pieStyle: "donut",
    legendPosition: "right",
    displayMode: "percent",
    topN: 7,
  };
}

export function makeKpiSchema(nextY: number, t: Dict = en): KpiSchema {
  return {
    ...makeBase(t.schemaDefaults.kpiNamePrefix, nextY),
    type: "kpi",
    width: 55,
    height: 35,
    icon: "bar_chart",
    title: t.schemaDefaults.kpiTitle,
    value: t.schemaDefaults.kpiValue,
    subtitle: t.schemaDefaults.kpiSubtitle,
    backgroundColor: "#2563eb",
    textColor: "#ffffff",
  };
}

// `gridMm` vem da config do <Designer> (gridSizeMm). Sem o parametro, um
// grid customizado alinhava o ARRASTO (PageCanvas ja recebia a prop) mas nao
// o NASCIMENTO do campo — campo novo caia fora da propria grade do consumidor.
export function nextFreeY(schemas: Schema[], gridMm?: number): number {
  if (schemas.length === 0) return 10;
  return snapToGrid(Math.max(...schemas.map((s) => s.y + s.height)) + 5, gridMm);
}
