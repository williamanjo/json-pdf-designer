import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cx, readPart, type PartStyle } from "./cx";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> & {
  /** Text next to the box. The <label> wraps both, so clicking the text ticks it. */
  label: ReactNode;
  parts?: { root?: PartStyle; label?: PartStyle };
};

// A checkbox with a label.
//
// NEW in 3.0.0, and not a convenience: they were three RAW
// `<input type="checkbox">` inside PropertyPanelTable.tsx. Without a
// component, a consumer who replaces every primitive of the kit with their
// own (see UiComponentsProvider) would be left with three native checkboxes
// in the middle of their own design system — the kit had a hole by inspection.
//
// The checked state has NO `data-*`: `:checked` is a native pseudo-class. The
// migration rule — where the browser already exposes the state, do not mirror it.
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, className, parts, ...rest },
  ref
) {
  const root = readPart(parts?.root);
  const text = readPart(parts?.label);
  return (
    <label className={cx("jpd-checkline", root.className)} style={root.style}>
      <input ref={ref} type="checkbox" {...rest} className={cx("jpd-checkline__box", className)} />
      <span className={cx(text.className)} style={text.style}>
        {label}
      </span>
    </label>
  );
});
