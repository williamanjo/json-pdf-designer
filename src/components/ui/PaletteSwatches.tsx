import { forwardRef, type HTMLAttributes } from "react";
import { cx, readPart, type PartStyle } from "./cx";

export type PaletteSwatchesProps = HTMLAttributes<HTMLDivElement> & {
  colors: readonly string[];
  /**
   * "md" (default, the chart case) | "sm" (the table case: smaller dot and
   * gap, and no `flex-shrink`, so three dots fit in a cell of a 2-column
   * grid).
   */
  size?: "sm" | "md";
  parts?: { swatch?: PartStyle };
};

// A row of dots with the given colors — used both by the chart's palette
// picker and by the table's.
//
// BREAKING in 3.0.0: the `size`/`gap`/`shrink` props took a TAILWIND CLASS as
// their value (`size="h-4 w-4"`, `gap="gap-1"`) — three strings that existed
// only to reproduce the small differences between the two original copies,
// and that were invisible to any search for `className`. They became a
// two-valued `size`, which is what the two real calls used.
export const PaletteSwatches = forwardRef<HTMLDivElement, PaletteSwatchesProps>(function PaletteSwatches(
  { colors, size = "md", className, parts, ...rest },
  ref
) {
  const swatch = readPart(parts?.swatch);
  return (
    <div ref={ref} {...rest} data-size={size} className={cx("jpd-swatches", className)}>
      {colors.map((c, i) => (
        // The inline `backgroundColor` stays: it IS the palette, not decoration —
        // the value comes from the data, not from the theme.
        <span key={i} className={cx("jpd-swatch", swatch.className)} style={{ ...swatch.style, backgroundColor: c }} />
      ))}
    </div>
  );
});
