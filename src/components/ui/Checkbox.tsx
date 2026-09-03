import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cx, readPart, type PartStyle } from "./cx";

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> & {
  /** Texto ao lado da caixa. O <label> embrulha os dois, então clicar no texto marca. */
  label: ReactNode;
  parts?: { root?: PartStyle; label?: PartStyle };
};

// Caixa de marcar com rótulo.
//
// NOVO na 3.0.0, e não é conveniência: eram três `<input type="checkbox">`
// CRUS dentro de PropertyPanelTable.tsx. Sem um componente, um consumidor
// que substitua todos os primitivos do kit pelos dele (ver
// UiComponentsProvider) ficaria com três checkbox nativos no meio do design
// system próprio — o kit tinha um buraco por inspeção.
//
// O estado marcado NÃO tem `data-*`: `:checked` é pseudo-classe nativa. Regra
// da migração — onde o navegador já expõe o estado, não espelha em atributo.
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
