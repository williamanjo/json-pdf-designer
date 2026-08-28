// Paletas prontas de tabela (cabeçalho + linha alternada/"zebrada" + borda)
// — mesma ideia de TableSchema.colorPalette que ChartSchema.colorPalette já
// usa (ver chartColors.ts), só que pra tabela em vez de gráfico: nome fixo,
// resolvido pra um conjunto de cores prontas; "custom" cai pros campos
// manuais de sempre (headBackgroundColor/headTextColor/bodyBandColor/
// borderColor). Inspirado no seletor "Formatar como Tabela" do Excel
// (grupos Claro/Médio/Escuro, cada um com algumas cores-base).
export type TableStylePreset = {
  headBackgroundColor: string;
  headTextColor: string;
  // Cor da linha alternada (índice de linha ímpar, 0-based) — a linha par
  // fica com bodyBackgroundColor de sempre (branco/transparente se ausente).
  bandColor: string;
  borderColor: string;
};

export const TABLE_PALETTES = {
  default: { headBackgroundColor: "#0284c7", headTextColor: "#ffffff", bandColor: "#f1f5f9", borderColor: "#94a3b8" },

  blueLight: { headBackgroundColor: "#ffffff", headTextColor: "#1d4ed8", bandColor: "#eff6ff", borderColor: "#93c5fd" },
  blueMedium: { headBackgroundColor: "#2563eb", headTextColor: "#ffffff", bandColor: "#dbeafe", borderColor: "#1d4ed8" },
  blueDark: { headBackgroundColor: "#1e3a8a", headTextColor: "#ffffff", bandColor: "#bfdbfe", borderColor: "#1e3a8a" },

  greenLight: { headBackgroundColor: "#ffffff", headTextColor: "#15803d", bandColor: "#f0fdf4", borderColor: "#86efac" },
  greenMedium: { headBackgroundColor: "#16a34a", headTextColor: "#ffffff", bandColor: "#dcfce7", borderColor: "#15803d" },
  greenDark: { headBackgroundColor: "#14532d", headTextColor: "#ffffff", bandColor: "#bbf7d0", borderColor: "#14532d" },

  orangeLight: { headBackgroundColor: "#ffffff", headTextColor: "#c2410c", bandColor: "#fff7ed", borderColor: "#fdba74" },
  orangeMedium: { headBackgroundColor: "#ea580c", headTextColor: "#ffffff", bandColor: "#ffedd5", borderColor: "#c2410c" },
  orangeDark: { headBackgroundColor: "#7c2d12", headTextColor: "#ffffff", bandColor: "#fed7aa", borderColor: "#7c2d12" },

  grayLight: { headBackgroundColor: "#ffffff", headTextColor: "#334155", bandColor: "#f8fafc", borderColor: "#cbd5e1" },
  grayMedium: { headBackgroundColor: "#64748b", headTextColor: "#ffffff", bandColor: "#f1f5f9", borderColor: "#475569" },
  grayDark: { headBackgroundColor: "#1e293b", headTextColor: "#ffffff", bandColor: "#e2e8f0", borderColor: "#1e293b" },

  purpleLight: { headBackgroundColor: "#ffffff", headTextColor: "#7e22ce", bandColor: "#faf5ff", borderColor: "#d8b4fe" },
  purpleMedium: { headBackgroundColor: "#9333ea", headTextColor: "#ffffff", bandColor: "#f3e8ff", borderColor: "#7e22ce" },
} as const;

export type TableStylePresetName = keyof typeof TABLE_PALETTES;
// "custom" não é uma entrada de TABLE_PALETTES — sinal pra usar os campos
// manuais (headBackgroundColor/headTextColor/bodyBandColor/columnStyles...
// de sempre) em vez de um preset. Fica junto no mesmo seletor mesmo assim.
export type TablePaletteName = TableStylePresetName | "custom";

export const TABLE_PALETTE_GROUPS: { label: string; names: TableStylePresetName[] }[] = [
  { label: "light", names: ["blueLight", "greenLight", "orangeLight", "grayLight", "purpleLight"] },
  { label: "medium", names: ["blueMedium", "greenMedium", "orangeMedium", "grayMedium", "purpleMedium"] },
  { label: "dark", names: ["blueDark", "greenDark", "orangeDark"] },
];

export function resolveTablePreset(name: string | undefined): TableStylePreset | undefined {
  if (!name || name === "custom") return undefined;
  return TABLE_PALETTES[name as TableStylePresetName];
}
