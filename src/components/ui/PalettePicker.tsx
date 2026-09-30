import { forwardRef, useState, type HTMLAttributes } from "react";
import { cx } from "./cx";
import { Labeled, type LabeledParts } from "./Labeled";
import { PaletteSwatches } from "./PaletteSwatches";

// One option inside the dropdown: a stable name (it is what `onSelect`
// receives and what decides the "selected" highlight) + the colors already
// resolved for that option (the caller resolves them — this component knows
// nothing about chart/table palettes) + an optional label to show next to the
// dots (variant "list", see below; variant "grid" ignores `label` and shows
// only the dots, as the table picker already did).
export type PaletteGroupItem = {
  name: string;
  colors: string[];
  label?: string;
};

// A group of options with an optional header. An empty `label` ("") draws no
// header at all — that is what the chart's caller uses to get a "flat" list
// (a single group, no title) while reusing the same structure as the table's
// 3 Light/Medium/Dark groups.
export type PaletteGroup = {
  label: string;
  items: PaletteGroupItem[];
};

export type PalettePickerProps = Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> & {
  /** Label above the button (e.g. "Color palette"). Omitted = no label. */
  label?: string;
  /** Name of the currently selected palette — used only to highlight the right option. */
  currentName: string;
  /** Already-resolved colors of the current palette, shown in the button's dots. An empty array shows `emptyPlaceholder` instead. */
  currentColors: string[];
  /** Text shown on the button next to the dots. Defaults to `currentName`. */
  currentLabel?: string;
  onSelect: (name: string) => void;
  groups: PaletteGroup[];
  /** Shown in place of the dots when `currentColors` is empty. Defaults to "—" (the table case with no preset/custom). */
  emptyPlaceholder?: string;
  /**
   * "list" (default, the chart case): options stacked in one column, each with
   * dots + `item.label`. Groups draw no header (they only make sense with a
   * single group whose `label` is empty).
   * "grid" (the table case): options per group, each group with a header
   * (when `group.label` is not empty) and a 2-column grid of options showing
   * dots only (no `item.label`).
   */
  variant?: "list" | "grid";
  /** Size of the dots. "md" (chart) | "sm" (table). */
  swatchSize?: "sm" | "md";
  parts?: LabeledParts;
};

// A reusable named-palette dropdown: the button shows the current palette
// (dots + text), a click opens/closes a list of options (each with its dots),
// picking one applies it and closes again. It generalizes the two nearly
// identical pickers that PropertyPanelChart.tsx and PropertyPanelTable.tsx
// each had one of.
//
// BREAKING in 3.0.0, two things:
//
// - `swatchSize`/`swatchGap`/`swatchShrink` (three Tailwind class strings)
//   collapsed into a two-valued `swatchSize`. The two real calls always passed
//   the same trio together, and always matched to the `variant`.
// - `staticArrow` is gone. It existed only to preserve what its own comment
//   called an "unintended detail of the original version": the TABLE picker's
//   arrow did not toggle ▾/▴ and had no dark mode color. With a token there
//   is an arrow color; the arrow toggles in both cases.
export const PalettePicker = forwardRef<HTMLDivElement, PalettePickerProps>(function PalettePicker(
  { label, currentName, currentColors, currentLabel, onSelect, groups, emptyPlaceholder = "—", variant = "list", swatchSize, className, parts, ...rest },
  ref
) {
  const [open, setOpen] = useState(false);
  const isGrid = variant === "grid";
  const size = swatchSize ?? (isGrid ? "sm" : "md");

  function choose(name: string) {
    onSelect(name);
    setOpen(false);
  }

  return (
    <Labeled label={label} parts={parts}>
      <div ref={ref} {...rest} className={cx("jpd-palette", className)}>
        <button type="button" onClick={() => setOpen((o) => !o)} className="jpd-palette__trigger">
          <span className="jpd-palette__current">
            {currentColors.length > 0 ? (
              <PaletteSwatches colors={currentColors} size={size} />
            ) : (
              <span className="jpd-palette__empty">{emptyPlaceholder}</span>
            )}
            <span>{currentLabel ?? currentName}</span>
          </span>
          <span className="jpd-palette__arrow">{open ? "▴" : "▾"}</span>
        </button>
        {open && (
          <div data-variant={variant} className="jpd-palette__menu">
            {isGrid
              ? groups.map((group) => (
                  <div key={group.label} className="jpd-palette__group">
                    {group.label && <span className="jpd-palette__grouplabel">{group.label}</span>}
                    <div className="jpd-palette__options">
                      {group.items.map((item) => (
                        <button
                          key={item.name}
                          type="button"
                          onClick={() => choose(item.name)}
                          data-selected={item.name === currentName || undefined}
                          className="jpd-palette__option"
                        >
                          <PaletteSwatches colors={item.colors} size={size} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              : groups
                  .flatMap((group) => group.items)
                  .map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => choose(item.name)}
                      data-selected={item.name === currentName || undefined}
                      className="jpd-palette__option"
                    >
                      <PaletteSwatches colors={item.colors} size={size} />
                      <span className="jpd-palette__optionlabel">{item.label ?? item.name}</span>
                    </button>
                  ))}
          </div>
        )}
      </div>
    </Labeled>
  );
});
