import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";
import { Labeled, type LabeledParts } from "./Labeled";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  mono?: boolean;
  parts?: LabeledParts;
};

// `forwardRef` and not ref-as-a-prop: the peer accepts React 18 (see
// package.json), and there a function component does not yet receive `ref`
// directly. The one that needs it is the expression editor (FormulaModal.tsx),
// which repositions the caret after accepting a suggestion — the kit's only
// ref consumer that existed before 3.0.0, and what proves the ref reaches the
// control and not the label wrapper.
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, className, mono, parts, rows = 2, ...rest },
  ref
) {
  return (
    <Labeled label={label} parts={parts}>
      <textarea ref={ref} rows={rows} {...rest} data-mono={mono || undefined} className={cx("jpd-textarea", className)} />
    </Labeled>
  );
});
