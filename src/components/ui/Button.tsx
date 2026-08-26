import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "danger" | "outline" | "ghost" | "dark";
type Size = "sm" | "md" | "icon";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const sizeCls: Record<Size, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3.5 py-2 text-sm",
  icon: "h-6 w-6 p-0",
};

const variantCls: Record<Variant, string> = {
  primary: "bg-sky-600 text-white shadow-sm hover:bg-sky-700 focus-visible:ring-sky-300",
  danger: "bg-red-500 text-white shadow-sm hover:bg-red-600 focus-visible:ring-red-300",
  outline: "border border-sky-600 text-sky-600 hover:bg-sky-50 focus-visible:ring-sky-300",
  ghost: "text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-slate-300",
  // Pra usar em cima de fundo escuro (ex: header/toolbar), onde as outras
  // variantes (feitas pra fundo claro) ficam sem contraste.
  dark: "bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/30",
};

export function Button({ variant = "primary", size = "sm", className = "", type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-40",
        sizeCls[size],
        variantCls[variant],
        className,
      ].join(" ")}
      {...props}
    />
  );
}
