import type { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & { label?: string };

export function Select({ label, className = "", children, ...props }: Props) {
  const control = (
    <select
      className={[
        "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm transition-colors",
        "focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </select>
  );
  if (!label) return control;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-slate-600">{label}</span>
      {control}
    </label>
  );
}
