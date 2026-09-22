// THE KPI CARD'S RULES: defaults, corner radius, and the position/state of
// each sub-element (title, value, subtitle, icon).
//
// It used to be `src/kpiFormat.ts`, at the root. The name described ONE of
// thirteen exports — the rest is geometry and sub-element handling, nothing
// to do with formatting. And the KPI was the only field type without a folder
// of its own, while `chart/` had three files; the asymmetry had no reason.

import type { KpiElementKey, KpiElementOffset, KpiSchema } from "../../types";
import { ptToMm } from "../../page/units";
import type { Dict } from "../../i18n";

// Defaults shared between the canvas preview (components/FieldBox/KpiField.tsx)
// and the real drawing in the PDF (pdf/render/renderKpi.ts) — the same value in both
// places so the preview matches the generated PDF when the schema sets no size.
export const DEFAULT_KPI_TITLE_FONT_SIZE = 8;
export const DEFAULT_KPI_VALUE_FONT_SIZE = 20;
export const DEFAULT_KPI_SUBTITLE_FONT_SIZE = 8;
export const DEFAULT_KPI_ICON_SIZE = 14;
// It approximates the fixed 8pt radius the card always had, at the default
// size of a new KPI (see makeKpiSchema in schemaFactory.ts, 55x35mm).
export const DEFAULT_KPI_BORDER_RADIUS_PERCENT = 16;

// Corner radius (the same unit as width/height, mm on the canvas or pt in
// the PDF) out of a percentage — 0% = a square corner, 100% = a "pill" (half
// the card's shorter side). A percentage instead of a fixed value so it
// scales with the card's size rather than staying the same amount of mm/pt.
export function kpiBorderRadius(percent: number, width: number, height: number): number {
  return (percent / 100) * (Math.min(width, height) / 2);
}

// The same padding around the card's content as always (PADDING_PT in
// pdf/render/renderKpi.ts), only in mm — used here to compute the DEFAULT
// position (with no custom offset) of each sub-element, in mm. render/renderKpi.ts
// keeps its own arithmetic in pt for the offset-free case (identical to what it
// always was, not refactored, so as not to risk a regression) — this function
// is the default position used by the CANVAS (KpiField.tsx, always) and by the
// PDF only when there is a custom offset (see render/renderKpi.ts).
const PADDING_MM = ptToMm(8);

// The position (top-left corner, in mm relative to the card) of each
// sub-element WHEN NO custom offset has been set — the icon at the top
// right, the title at the top left, the value centered vertically on the
// left, the subtitle at the bottom left (the same visual layout as always,
// see pdf/render/renderKpi.ts).
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

// Small pure helpers shared between KpiField.tsx (the canvas),
// FieldList.tsx (the padlock/add-remove on the Fields tab) and
// PropertyPanelKpi.tsx (the contextual Style) — a single read/write of the
// right field name (`<el>Offset`/`<el>Locked`) per sub-element, instead of
// each file reimplementing the same switch.
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

// Absent/`true` = locked (a safe default, like the padlock of the whole
// field) — only an explicit `false` unlocks dragging (see KpiField.tsx).
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

// The default value for "re-adding" a removed sub-element (the "+" button on
// the Fields tab, see FieldList.tsx, and the "Add" button on the Style tab,
// see PropertyPanelKpi.tsx) — the same default per type as always, with
// title/subtitle using the translated label (see i18n) as initial placeholder.
export function kpiElementRestorePatch(el: KpiElementKey, t: Dict): Partial<KpiSchema> {
  if (el === "icon") return { icon: "bar_chart" };
  if (el === "title") return { title: t.kpi.title };
  if (el === "value") return { value: "0" };
  return { subtitle: t.kpi.subtitle };
}
