// Fixed categorical palettes (the order never changes within each one — it is
// what guarantees enough contrast between neighboring slices/bars, including
// for color blindness). 7 colors each — beyond those, the rest becomes
// "Others" in the neutral color (CHART_OTHER_COLOR), it never generates a new
// 8th/9th color. The palette choice is by name (`ChartSchema.colorPalette`,
// see PropertyPanelChart) — ready-made color themes, like any chart editor's.
export const CHART_PALETTES = {
  default: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"],
  classic: ["#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47", "#264478"],
  modern: ["#118dff", "#12239e", "#e66c37", "#6b007b", "#e044a7", "#744ec2", "#d9b300"],
  vibrant: ["#e63946", "#f77f00", "#fcbf49", "#06d6a0", "#118ab2", "#073b4c", "#9d4edd"],
  pastel: ["#a8d8ea", "#f7c8d8", "#c8e6c9", "#ffe0b2", "#d7bde2", "#b2ebf2", "#f5e6a8"],
  grayscale: ["#1a1a1a", "#3d3d3d", "#5c5c5c", "#7a7a7a", "#999999", "#b8b8b8", "#d6d6d6"],
} as const;

export type ChartPresetName = keyof typeof CHART_PALETTES;
// "custom" is not an entry of CHART_PALETTES (it has no fixed colors at all)
// — it is a signal to use `ChartSchema.customPaletteColors` instead (see
// resolveChartColors below). It sits in the same picker all the same.
export type ChartPaletteName = ChartPresetName | "custom";

export const CHART_PALETTE_LABELS: Record<ChartPaletteName, string> = {
  default: "Padrão",
  classic: "Clássica",
  modern: "Moderna",
  vibrant: "Vibrante",
  pastel: "Pastel",
  grayscale: "Escala de cinza",
  custom: "Personalizada",
};

export const CHART_PALETTE_NAMES: ChartPaletteName[] = [...(Object.keys(CHART_PALETTES) as ChartPresetName[]), "custom"];

export const CHART_PALETTE_SIZE = CHART_PALETTES.default.length;

// `name` is `ChartSchema.colorPalette` — a free string (it does not close the
// union, see KpiIcon for the same reason in types/schema.ts) so a template
// saved with a removed/future palette name does not break: it falls back to
// "default" on its own. It does not resolve "custom" (that requires the
// hand-picked colors, which only the caller has — see resolveChartColors).
export function resolveChartPalette(name: string | undefined): readonly string[] {
  return CHART_PALETTES[name as ChartPresetName] ?? CHART_PALETTES.default;
}

// It joins a ready-made palette and a manual palette into one resolver:
// "custom" with at least 1 chosen color uses `customColors` (cycling if the
// bound array has more items than chosen colors, the same `i % palette.length`
// logic as aggregateChartItems); any other case falls back to the usual preset
// (including "custom" with no color chosen yet).
export function resolveChartColors(colorPalette: string | undefined, customColors: string[] | undefined): readonly string[] {
  if (colorPalette === "custom" && customColors && customColors.length > 0) return customColors;
  return resolveChartPalette(colorPalette);
}

// Kept for compatibility — the rest of the code (bindings.ts default param,
// the tests) already used these two names before palettes existed.
export const CHART_COLORS = CHART_PALETTES.default;
export const CHART_OTHER_COLOR = "#94a3b8";
