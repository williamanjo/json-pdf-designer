import type { PageSize } from "./types";

// Larguras/alturas em mm, sempre em RETRATO aqui — a orientação (ver
// applyOrientation) decide se inverte width/height na hora de aplicar.
// `label` é só fallback — Designer.tsx faz `t.pageSizeLabels[p.name] ?? p.label`,
// e todo preset abaixo já tem entrada em pageSizeLabels (en.ts/pt-BR.ts),
// então esse texto (parte em PT) quase nunca aparece de verdade; existe
// só pra um preset novo/desconhecido não ficar sem rótulo nenhum.
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

// Acha o preset cujas dimensões (em qualquer orientação) batem com a
// página atual — "personalizado" (undefined) se não bater com nenhum
// (ex: template antigo com tamanho digitado à mão).
export function matchPreset(page: PageSize): string | undefined {
  const preset = PAGE_SIZE_PRESETS.find(
    (p) =>
      (Math.abs(p.size.width - page.width) < 0.5 && Math.abs(p.size.height - page.height) < 0.5) ||
      (Math.abs(p.size.width - page.height) < 0.5 && Math.abs(p.size.height - page.width) < 0.5)
  );
  return preset?.name;
}
