import type { PageSize, Schema } from "./types";

export type Zone = "header" | "footer" | "marginLeft" | "marginRight" | "body";

export type Bands = {
  headerHeight?: number;
  footerHeight?: number;
  marginLeft?: number;
  marginRight?: number;
};

// Zona de um campo é sempre derivada da posição (x/y), nunca guardada no
// schema — cai automaticamente na faixa vermelha (header/footer/margem)
// quando fica contido nela. Usado tanto pro editor (canvas, toggle de
// isolamento, trava de arrastar) quanto pro generate.ts (o que repete em
// toda página gerada).
export function classifyZone(schema: Schema, page: PageSize, bands: Bands): Zone {
  const headerHeight = bands.headerHeight ?? 0;
  const footerHeight = bands.footerHeight ?? 0;
  const marginLeft = bands.marginLeft ?? 0;
  const marginRight = bands.marginRight ?? 0;
  if (schema.y + schema.height <= headerHeight) return "header";
  if (schema.y >= page.height - footerHeight) return "footer";
  if (schema.x + schema.width <= marginLeft) return "marginLeft";
  if (schema.x >= page.width - marginRight) return "marginRight";
  return "body";
}

export function isRedZone(zone: Zone): boolean {
  return zone !== "body";
}

// Trava x/y dentro dos limites da zona informada — usada ao arrastar ou
// redimensionar, pra um campo do corpo nunca invadir a faixa
// vermelha (header/footer/margem) e um campo da faixa nunca sair dela.
export function clampToZone(
  zone: Zone,
  x: number,
  y: number,
  width: number,
  height: number,
  page: PageSize,
  bands: Bands
): { x: number; y: number } {
  const headerHeight = bands.headerHeight ?? 0;
  const footerHeight = bands.footerHeight ?? 0;
  const marginLeft = bands.marginLeft ?? 0;
  const marginRight = bands.marginRight ?? 0;

  let minX = 0;
  let maxX = page.width - width;
  let minY = 0;
  let maxY = page.height - height;

  if (zone === "header") {
    maxY = Math.max(0, headerHeight - height);
  } else if (zone === "footer") {
    minY = page.height - footerHeight;
  } else if (zone === "marginLeft") {
    maxX = Math.max(0, marginLeft - width);
  } else if (zone === "marginRight") {
    minX = page.width - marginRight;
  } else {
    minX = marginLeft;
    maxX = page.width - marginRight - width;
    minY = headerHeight;
    maxY = page.height - footerHeight - height;
  }

  return {
    x: Math.min(Math.max(x, minX), Math.max(minX, maxX)),
    y: Math.min(Math.max(y, minY), Math.max(minY, maxY)),
  };
}
