import type { PageSize, Schema } from "../types";

export type Zone = "header" | "footer" | "marginLeft" | "marginRight" | "body";

export type Bands = {
  headerHeight?: number;
  footerHeight?: number;
  marginLeft?: number;
  marginRight?: number;
};

// It fills every absent band with 0 — to avoid repeating the same fallback
// block in classifyZone and clampToZone.
function resolveBands(bands: Bands): Required<Bands> {
  return {
    headerHeight: bands.headerHeight ?? 0,
    footerHeight: bands.footerHeight ?? 0,
    marginLeft: bands.marginLeft ?? 0,
    marginRight: bands.marginRight ?? 0,
  };
}

// A field's zone is always derived from its position (x/y), never stored in
// the schema — it falls into the red band (header/footer/margin) automatically
// when it is contained in it. Used both by the editor (canvas, isolation
// toggle, drag lock) and by generate.ts (what repeats on every generated
// page).
export function classifyZone(schema: Schema, page: PageSize, bands: Bands): Zone {
  const { headerHeight, footerHeight, marginLeft, marginRight } = resolveBands(bands);
  if (schema.y + schema.height <= headerHeight) return "header";
  if (schema.y >= page.height - footerHeight) return "footer";
  if (schema.x + schema.width <= marginLeft) return "marginLeft";
  if (schema.x >= page.width - marginRight) return "marginRight";
  return "body";
}

export function isRedZone(zone: Zone): boolean {
  return zone !== "body";
}

// Computes the limits (min/max of x/y) allowed for the given zone — the pure
// part of the clampToZone computation, without the final clamping step.
function clampBoundsForZone(
  zone: Zone,
  page: PageSize,
  bands: Bands,
  width: number,
  height: number
): { minX: number; maxX: number; minY: number; maxY: number } {
  const { headerHeight, footerHeight, marginLeft, marginRight } = resolveBands(bands);

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

  return { minX, maxX, minY, maxY };
}

// Clamps x/y inside the given zone's limits — used when dragging or
// resizing, so a body field never invades the red band (header/footer/margin)
// and a band field never leaves it.
export function clampToZone(
  zone: Zone,
  x: number,
  y: number,
  width: number,
  height: number,
  page: PageSize,
  bands: Bands
): { x: number; y: number } {
  const { minX, maxX, minY, maxY } = clampBoundsForZone(zone, page, bands, width, height);

  return {
    x: Math.min(Math.max(x, minX), Math.max(minX, maxX)),
    y: Math.min(Math.max(y, minY), Math.max(minY, maxY)),
  };
}
