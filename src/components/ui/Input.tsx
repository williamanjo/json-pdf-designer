import type { InputHTMLAttributes } from "react";

const controlCls =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm transition-colors placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/20";

type Props = InputHTMLAttributes<HTMLInputElement> & { label?: string; mono?: boolean };

export function Input({ label, className = "", mono, ...props }: Props) {
  const control = <input className={`${controlCls} ${mono ? "font-mono" : ""} ${className}`} {...props} />;
  if (!label) return control;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-slate-600 dark:text-gray-400">{label}</span>
      {control}
    </label>
  );
}

export function ColorInput({ label, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const control = (
    <input
      type="color"
      className={`h-7 w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-700 ${className}`}
      {...props}
    />
  );
  if (!label) return control;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-slate-600 dark:text-gray-400">{label}</span>
      {control}
    </label>
  );
}
