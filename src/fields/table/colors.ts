// Ready-made table palettes (header + alternating/"banded" row + border) —
// the same idea for TableSchema.colorPalette that ChartSchema.colorPalette
// already uses (see chartColors.ts), only for a table instead of a chart: a
// fixed name, resolved into a set of ready-made colors; "custom" falls back
// to the usual manual fields (headBackgroundColor/headTextColor/
// bodyBandColor/borderColor). Inspired by Excel's "Format as Table" picker
// (Light/Medium/Dark groups, each with a few base colors).
export type TableStylePreset = {
  headBackgroundColor: string;
  headTextColor: string;
  // The alternating row's color (an odd row index, 0-based) — the even row
  // keeps the usual bodyBackgroundColor (white/transparent when absent).
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
// "custom" is not an entry of TABLE_PALETTES — it is a signal to use the
// manual fields (the usual headBackgroundColor/headTextColor/bodyBandColor/
// columnStyles...) instead of a preset. It sits in the same picker all the same.
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
