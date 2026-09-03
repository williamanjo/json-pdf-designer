import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

type Variant = "primary" | "danger" | "outline" | "ghost" | "dark";
type Size = "sm" | "md" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

// `variant`/`size` são ATRIBUTO, não classe. Antes eram dois mapas de string
// Tailwind (`sizeCls`/`variantCls`) que o componente escolhia e concatenava;
// agora o JSX escreve `data-variant`/`data-size` e quem decide aparência é o
// theme.css. É a regra geral da migração: se o componente teria de ESCOLHER
// uma classe, é atributo.
//
// `...rest` vem ANTES de `className`/`data-*` de propósito: assim um atributo
// funcional (`type`, `aria-*`, `onClick`) continua sobrescrevível pelo
// consumidor, mas o cálculo de classe e de estado é sempre o nosso.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "sm", className, type = "button", ...rest },
  ref
) {
  return <button ref={ref} type={type} {...rest} data-variant={variant} data-size={size} className={cx("jpd-btn", className)} />;
});
