import { forwardRef, type SelectHTMLAttributes } from "react";
import { cx } from "./cx";
import { Labeled, type LabeledParts } from "./Labeled";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  parts?: LabeledParts;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, className, parts, children, ...rest },
  ref
) {
  return (
    <Labeled label={label} parts={parts}>
      <select ref={ref} {...rest} className={cx("jpd-select", className)}>
        {children}
      </select>
    </Labeled>
  );
});
