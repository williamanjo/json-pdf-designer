import type { PageSize } from "../types";

// Widths/heights in mm, always in PORTRAIT here — the orientation (see
// applyOrientation) decides whether to swap width/height when applying.
// `label` is only a fallback — Designer.tsx does `t.pageSizeLabels[p.name] ?? p.label`,
// and every preset below already has an entry in pageSizeLabels (en.ts/pt-BR.ts),
// so that text (partly in PT) almost never really shows up; it exists only so
// a new/unknown preset is not left without a label at all.
export const PAGE_SIZE_PRESETS: { name: string; label: string; size: PageSize }[] = [
  { name: "a4", label: "A4 (210 x 297mm)", size: { width: 210, height: 297 } },
  { name: "a3", label: "A3 (297 x 420mm)", size: { width: 297, height: 420 } },
  { name: "a5", label: "A5 (148 x 210mm)", size: { width: 148, height: 210 } },
  { name: "letter", label: "Carta / Letter (215.9 x 279.4mm)", size: { width: 215.9, height: 279.4 } },
  { name: "legal", label: "Ofício / Legal (215.9 x 355.6mm)", size: { width: 215.9, height: 355.6 } },
];

export type Orientation = "portrait" | "landscape";

export function orientationOf(page: PageSize): Orientation {
  return page.width > page.height ? "landscape" : "portrait";
}

export function applyOrientation(size: PageSize, orientation: Orientation): PageSize {
  const portrait = size.width <= size.height ? size : { width: size.height, height: size.width };
  return orientation === "landscape" ? { width: portrait.height, height: portrait.width } : portrait;
}

// Finds the preset whose dimensions (in either orientation) match the
// current page — "custom" (undefined) if none match (e.g. an old template
// with a hand-typed size).
export function matchPreset(page: PageSize): string | undefined {
  const preset = PAGE_SIZE_PRESETS.find(
    (p) =>
      (Math.abs(p.size.width - page.width) < 0.5 && Math.abs(p.size.height - page.height) < 0.5) ||
      (Math.abs(p.size.width - page.height) < 0.5 && Math.abs(p.size.height - page.width) < 0.5)
  );
  return preset?.name;
}
