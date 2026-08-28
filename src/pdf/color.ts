import { rgb, type Color } from "pdf-lib";

// "#rgb"/"#rrggbb" -> canais normalizados (0-1) — undefined pra hex ausente/
// inválido (comprimento errado, dígito não-hex), cai no default/preto de
// quem chama. Núcleo único reaproveitado por colorOrDefault (abaixo) —
// antes cada consumidor (generate.ts, drawTable.ts, drawChart.ts,
// drawKpi.ts) reimplementava o mesmo parsing+fallback separado.
export function parseHex(hex: string | undefined): { r: number; g: number; b: number } | undefined {
  if (!hex) return undefined;
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (full.length !== 6) return undefined;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return undefined;
  return { r: ((num >> 16) & 255) / 255, g: ((num >> 8) & 255) / 255, b: (num & 255) / 255 };
}

// "#rrggbb"/"#rgb" -> Color do pdf-lib, ou `fallback` se hex ausente/
// inválido — wrapper único reaproveitado onde antes cada arquivo de
// desenho (generate.ts/drawTable.ts/drawChart.ts/drawKpi.ts) tinha sua
// própria versão de "parseHex ou fallback".
export function colorOrDefault(hex: string | undefined, fallback: Color): Color {
  const c = parseHex(hex);
  return c ? rgb(c.r, c.g, c.b) : fallback;
}
