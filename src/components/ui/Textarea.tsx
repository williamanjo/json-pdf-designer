import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cx } from "./cx";
import { Labeled, type LabeledParts } from "./Labeled";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  mono?: boolean;
  parts?: LabeledParts;
};

// `forwardRef` e não ref-como-prop: o peer aceita React 18 (ver
// package.json), e ali função componente ainda não recebe `ref` direto. Quem
// precisa é o editor de expressão (FormulaModal.tsx), que reposiciona o caret
// depois de aceitar uma sugestão — o único consumidor de ref do kit que
// existia antes da 3.0.0, e o que prova que a ref chega no controle e não no
// wrapper de rótulo.
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
