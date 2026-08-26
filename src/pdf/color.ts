// "#rgb"/"#rrggbb" -> canais normalizados (0-1) — undefined pra hex ausente/
// inválido (comprimento errado, dígito não-hex), cai no default/preto de
// quem chama. Núcleo único reaproveitado por hexToColor (drawTable.ts, tipo
// Color do pdf-lib) e hexToRgb (generate.ts, {r,g,b} cru) — antes cada um
// reimplementava o mesmo parsing separado.
export function parseHex(hex: string | undefined): { r: number; g: number; b: number } | undefined {
  if (!hex) return undefined;
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (full.length !== 6) return undefined;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return undefined;
  return { r: ((num >> 16) & 255) / 255, g: ((num >> 8) & 255) / 255, b: (num & 255) / 255 };
}
