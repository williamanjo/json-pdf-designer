// Paletas categóricas fixas (ordem nunca muda dentro de cada uma — é o que
// garante contraste suficiente entre fatias/barras vizinhas, inclusive pra
// daltonismo). 7 cores cada — além dessas, o resto vira "Outros" na cor
// neutra (CHART_OTHER_COLOR), nunca gera uma 8ª/9ª cor nova. Escolha de
// paleta é por nome (`ChartSchema.colorPalette`, ver PropertyPanelChart) —
// temas de cores prontos, tipo os de qualquer editor de planilha/gráfico.
export const CHART_PALETTES = {
  default: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"],
  classic: ["#4472c4", "#ed7d31", "#a5a5a5", "#ffc000", "#5b9bd5", "#70ad47", "#264478"],
  modern: ["#118dff", "#12239e", "#e66c37", "#6b007b", "#e044a7", "#744ec2", "#d9b300"],
  vibrant: ["#e63946", "#f77f00", "#fcbf49", "#06d6a0", "#118ab2", "#073b4c", "#9d4edd"],
  pastel: ["#a8d8ea", "#f7c8d8", "#c8e6c9", "#ffe0b2", "#d7bde2", "#b2ebf2", "#f5e6a8"],
  grayscale: ["#1a1a1a", "#3d3d3d", "#5c5c5c", "#7a7a7a", "#999999", "#b8b8b8", "#d6d6d6"],
} as const;

export type ChartPresetName = keyof typeof CHART_PALETTES;
// "custom" não é uma entrada de CHART_PALETTES (não tem cor fixa nenhuma) —
// é um sinal pra usar `ChartSchema.customPaletteColors` no lugar (ver
// resolveChartColors abaixo). Fica junto no mesmo seletor mesmo assim.
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

// `name` é `ChartSchema.colorPalette` — string livre (não fecha união, ver
// KpiIcon pelo mesmo motivo em types/schema.ts) pra template salvo com um
// nome de paleta removida/futura não quebrar: cai pra "default" sozinho.
// Não resolve "custom" (isso exige as cores escolhidas à mão, que só quem
// chama tem — ver resolveChartColors).
export function resolveChartPalette(name: string | undefined): readonly string[] {
  return CHART_PALETTES[name as ChartPresetName] ?? CHART_PALETTES.default;
}

// Junta paleta pronta + paleta manual num só resolver: "custom" com pelo
// menos 1 cor escolhida usa `customColors` (repete em ciclo se o array
// vinculado tiver mais itens que cores escolhidas, mesma lógica de
// `i % palette.length` do aggregateChartItems); qualquer outro caso cai no
// preset de sempre (inclusive "custom" sem nenhuma cor ainda escolhida).
export function resolveChartColors(colorPalette: string | undefined, customColors: string[] | undefined): readonly string[] {
  if (colorPalette === "custom" && customColors && customColors.length > 0) return customColors;
  return resolveChartPalette(colorPalette);
}

// Mantidos pra compatibilidade — o resto do código (bindings.ts default
// param, testes) já usava esses dois nomes antes de existir paleta.
export const CHART_COLORS = CHART_PALETTES.default;
export const CHART_OTHER_COLOR = "#94a3b8";
