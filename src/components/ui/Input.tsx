import { forwardRef, type InputHTMLAttributes } from "react";
import { cx } from "./cx";
import { Labeled, type LabeledParts } from "./Labeled";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  mono?: boolean;
  parts?: LabeledParts;
};

export type ColorInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  parts?: LabeledParts;
};

// The ref goes to the `<input>`, not to the `<label>` wrapping it. Same rule
// as `className`: both address the element that NAMES the component, and the
// wrapper is `parts.root`.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, className, mono, parts, ...rest }, ref) {
  return (
    <Labeled label={label} parts={parts}>
      {/* `mono` was the `font-mono` class; it became an attribute, like the
          Button's variant/size. `|| undefined` because React serializes
          `data-x={false}` as the string "false", which would match `[data-mono]`. */}
      <input ref={ref} {...rest} data-mono={mono || undefined} className={cx("jpd-input", className)} />
    </Labeled>
  );
});

export const ColorInput = forwardRef<HTMLInputElement, ColorInputProps>(function ColorInput({ label, className, parts, ...rest }, ref) {
  return (
    <Labeled label={label} parts={parts}>
      <input ref={ref} type="color" {...rest} className={cx("jpd-color-input", className)} />
    </Labeled>
  );
});
