import type { KpiElementKey, KpiElementOffset, KpiSchema } from "./types";
import { formatPtBrNumber } from "./numberFormat";
import { ptToMm } from "./units";
import type { Dict } from "./i18n";

// Defaults compartilhados entre o preview no canvas (components/FieldBox/KpiField.tsx)
// e o desenho real no PDF (pdf/render/renderKpi.ts) — mesmo valor nos dois lugares
// pra preview bater com o PDF gerado quando o schema não define um tamanho.
export const DEFAULT_KPI_TITLE_FONT_SIZE = 8;
export const DEFAULT_KPI_VALUE_FONT_SIZE = 20;
export const DEFAULT_KPI_SUBTITLE_FONT_SIZE = 8;
export const DEFAULT_KPI_ICON_SIZE = 14;
// Aproxima o raio fixo de 8pt que o cartão sempre teve, no tamanho padrão
// de um KPI novo (ver makeKpiSchema em schemaFactory.ts, 55x35mm).
export const DEFAULT_KPI_BORDER_RADIUS_PERCENT = 16;

// Raio de canto (mesma unidade de width/height, mm no canvas ou pt no PDF)
// a partir de uma porcentagem — 0% = canto reto, 100% = "pílula" (metade
// do lado menor do cartão). Percentual em vez de valor fixo pra escalar
// com o tamanho do cartão em vez de ficar sempre o mesmo tanto de mm/pt.
export function kpiBorderRadius(percent: number, width: number, height: number): number {
  return (percent / 100) * (Math.min(width, height) / 2);
}

// Só o separador de milhar (ponto) — não força casas decimais (10000 vira
// "10000"/"10.000", não "10000,00"); se o número já tinha decimais, limita
// em 2 casas sem preencher com zero. Só quando `format` não é "none"/ausente
// E o valor resolvido é um número puro — texto com prefixo/sufixo (ex: "R$
// 42", "42 unid.") não é numérico depois do Number(...) e passa direto,
// sem tocar (evita quebrar KPIs que não são um número solto).
export function formatKpiValue(value: string, format?: "none" | "plain" | "grouped"): string {
  if (!format || format === "none") return value;
  const trimmed = value.trim();
  if (trimmed === "") return value;
  const n = Number(trimmed);
  if (Number.isNaN(n)) return value;
  return formatPtBrNumber(n, { decimals: 2, forceDecimals: false, grouping: format === "grouped" });
}

// Mesma folga de sempre ao redor do conteúdo do cartão (PADDING_PT em
// pdf/render/renderKpi.ts), só que em mm — usada aqui pra calcular a posição
// PADRÃO (sem offset customizado) de cada sub-elemento, em mm. render/renderKpi.ts
// mantém sua própria conta em pt pro caso sem offset (idêntica de sempre,
// não refatorada, pra não arriscar regressão) — esta função é a posição
// default usada pelo CANVAS (KpiField.tsx, sempre) e pelo PDF só quando
// há um offset customizado (ver render/renderKpi.ts).
const PADDING_MM = ptToMm(8);

// Posição (canto superior-esquerdo, mm relativo ao cartão) de cada
// sub-elemento QUANDO NENHUM offset customizado foi definido — ícone no
// canto superior-direito, título no superior-esquerdo, valor centralizado
// verticalmente à esquerda, legenda no canto inferior-esquerdo (mesmo
// layout visual de sempre, ver pdf/render/renderKpi.ts).
export function defaultKpiElementPositions(
  schema: KpiSchema,
  sizesMm: Record<KpiElementKey, number>
): Record<KpiElementKey, KpiElementOffset> {
  const { width, height } = schema;
  return {
    title: { x: PADDING_MM, y: PADDING_MM },
    icon: { x: Math.max(PADDING_MM, width - PADDING_MM - sizesMm.icon), y: PADDING_MM },
    value: { x: PADDING_MM, y: height / 2 - sizesMm.value / 2 },
    subtitle: { x: PADDING_MM, y: Math.max(PADDING_MM, height - PADDING_MM - sizesMm.subtitle) },
  };
}

// Helpers pequenos e puros compartilhados entre KpiField.tsx (canvas),
// FieldList.tsx (cadeado/adicionar-remover na aba Campos) e
// PropertyPanelKpi.tsx (Estilo contextual) — uma leitura/escrita só do
// nome de campo certo (`<el>Offset`/`<el>Locked`) por sub-elemento, em vez
// de cada arquivo reimplementar o mesmo switch.
export function kpiElementPresent(schema: KpiSchema, el: KpiElementKey): boolean {
  if (el === "icon") return schema.icon !== "none";
  if (el === "title") return schema.title !== undefined;
  if (el === "value") return schema.value !== undefined;
  return schema.subtitle !== undefined;
}

export function kpiElementOffset(schema: KpiSchema, el: KpiElementKey): KpiElementOffset | undefined {
  if (el === "icon") return schema.iconOffset;
  if (el === "title") return schema.titleOffset;
  if (el === "value") return schema.valueOffset;
  return schema.subtitleOffset;
}

// Ausente/`true` = travado (default seguro, igual o cadeado do campo
// inteiro) — só `false` explícito destrava o arrasto (ver KpiField.tsx).
export function kpiElementLocked(schema: KpiSchema, el: KpiElementKey): boolean {
  if (el === "icon") return schema.iconLocked !== false;
  if (el === "title") return schema.titleLocked !== false;
  if (el === "value") return schema.valueLocked !== false;
  return schema.subtitleLocked !== false;
}

export function kpiElementOffsetPatch(el: KpiElementKey, offset: KpiElementOffset | undefined): Partial<KpiSchema> {
  if (el === "icon") return { iconOffset: offset };
  if (el === "title") return { titleOffset: offset };
  if (el === "value") return { valueOffset: offset };
  return { subtitleOffset: offset };
}

export function kpiElementLockedPatch(el: KpiElementKey, locked: boolean): Partial<KpiSchema> {
  if (el === "icon") return { iconLocked: locked };
  if (el === "title") return { titleLocked: locked };
  if (el === "value") return { valueLocked: locked };
  return { subtitleLocked: locked };
}

// Valor padrão pra "readicionar" um sub-elemento removido (botão "+" na
// aba Campos, ver FieldList.tsx, e botão "Adicionar" na aba Estilo, ver
// PropertyPanelKpi.tsx) — mesmo default de sempre por tipo, título/legenda
// usam o rótulo traduzido (ver i18n) como texto de placeholder inicial.
export function kpiElementRestorePatch(el: KpiElementKey, t: Dict): Partial<KpiSchema> {
  if (el === "icon") return { icon: "bar_chart" };
  if (el === "title") return { title: t.kpi.title };
  if (el === "value") return { value: "0" };
  return { subtitle: t.kpi.subtitle };
}
