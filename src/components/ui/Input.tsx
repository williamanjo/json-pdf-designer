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

// A ref vai pro `<input>`, não pro `<label>` que o embrulha. É a mesma regra
// do `className`: os dois endereçam o elemento que dá NOME ao componente, e o
// wrapper é `parts.root`.
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, className, mono, parts, ...rest }, ref) {
  return (
    <Labeled label={label} parts={parts}>
      {/* `mono` era a classe `font-mono`; virou atributo, igual variant/size
          do Button. `|| undefined` porque o React serializa `data-x={false}`
          como a string "false", que ainda casaria `[data-mono]`. */}
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
