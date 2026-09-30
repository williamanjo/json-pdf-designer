import { rgb, type Color } from "pdf-lib";

// "#rgb"/"#rrggbb" -> normalized channels (0-1) — undefined for an absent/
// invalid hex (wrong length, a non-hex digit), falling back to the caller's
// default/black. A single core reused by colorOrDefault (below) — each
// consumer (generate.ts, render/renderTable.ts, render/renderChart.ts,
// render/renderKpi.ts) used to reimplement the same parsing+fallback separately.
export function parseHex(hex: string | undefined): { r: number; g: number; b: number } | undefined {
  if (!hex) return undefined;
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (full.length !== 6) return undefined;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return undefined;
  return { r: ((num >> 16) & 255) / 255, g: ((num >> 8) & 255) / 255, b: (num & 255) / 255 };
}

// "#rrggbb"/"#rgb" -> a pdf-lib Color, or `fallback` if the hex is absent/
// invalid — a single wrapper reused where each drawing file
// (generate.ts/render/renderTable.ts/render/renderChart.ts/render/renderKpi.ts) used
// to have its own version of "parseHex or fallback".
export function colorOrDefault(hex: string | undefined, fallback: Color): Color {
  const c = parseHex(hex);
  return c ? rgb(c.r, c.g, c.b) : fallback;
}
