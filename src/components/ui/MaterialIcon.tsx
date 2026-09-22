import type { SVGAttributes } from "react";
import { MATERIAL_ICON_GRID, MATERIAL_ICON_PATHS } from "../../materialIcons";
import { cx } from "./cx";

// The same icon (Material Symbols) drawn both in the panel picker
// (PropertyPanelKpi.tsx) and in the canvas preview (FieldBox/KpiField.tsx)
// — an unknown icon, or "none", simply shows nothing. The viewBox uses
// Material Symbols' standard 960 grid (see MATERIAL_ICON_GRID).
//
// `jpd-micon` and not `jpd-icon` only to keep the two roles apart; both
// classes declare nothing but `display: block` (what Preflight gave), and
// NEITHER declares a size — the size here comes from the `size` prop. Careful
// when touching this: in SVG2 `width`/`height` on `<svg>` are geometry
// properties, so a class with `width` BEATS the attribute (measured in the
// browser: attribute 14 plus a 10px class renders 10px). Declaring a size in
// the class would break `size` silently.
// `SVGAttributes` like the 20 icons in icons.tsx, and for the same reason:
// this component has been public since 3.0.0, and the kit's rule applies to it
// too — `className` merges, `style` and the rest of the attributes pass
// through. It is not `SVGProps`, which extends `ClassAttributes` and would
// accept a `ref` that goes nowhere here.
export type MaterialIconProps = SVGAttributes<SVGSVGElement> & {
  // Nome do glifo (chave de MATERIAL_ICON_PATHS). Desconhecido ou "none"
  // renderiza `null` em vez de um quadrado vazio.
  icon: string;
  // Side of the square, in px. It goes into the `width`/`height` ATTRIBUTES —
  // see the warning above about geometry properties before moving this to CSS.
  //
  // `width`/`height` are written AFTER the `...rest` on purpose: `size` is the
  // documented API, so a stray `width` arriving through the rest must not beat
  // it silently.
  size: number;
};

export function MaterialIcon({ icon, size, className, ...rest }: MaterialIconProps) {
  const path = MATERIAL_ICON_PATHS[icon as keyof typeof MATERIAL_ICON_PATHS];
  if (!path) return null;
  return (
    <svg
      {...rest}
      width={size}
      height={size}
      viewBox={`0 -${MATERIAL_ICON_GRID} ${MATERIAL_ICON_GRID} ${MATERIAL_ICON_GRID}`}
      fill="currentColor"
      className={cx("jpd-micon", className)}
    >
      <path d={path} />
    </svg>
  );
}
