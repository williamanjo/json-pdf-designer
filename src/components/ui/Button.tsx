import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

type Variant = "primary" | "danger" | "outline" | "ghost" | "dark";
type Size = "sm" | "md" | "icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

// `variant`/`size` are an ATTRIBUTE, not a class. They used to be two maps of
// Tailwind strings (`sizeCls`/`variantCls`) that the component picked from and
// concatenated; now the JSX writes `data-variant`/`data-size` and appearance is
// decided by theme.css. That is the general rule of the migration: if the
// component would have to CHOOSE a class, it is an attribute.
//
// `...rest` deliberately comes BEFORE `className`/`data-*`: that way a
// functional attribute (`type`, `aria-*`, `onClick`) stays overridable by the
// consumer, but the class and state computation is always ours.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "sm", className, type = "button", ...rest },
  ref
) {
  return <button ref={ref} type={type} {...rest} data-variant={variant} data-size={size} className={cx("jpd-btn", className)} />;
});
