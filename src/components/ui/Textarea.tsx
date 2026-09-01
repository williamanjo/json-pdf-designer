import { forwardRef, type TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; mono?: boolean };

// `forwardRef` e não ref-como-prop: o peer aceita React 18 (ver
// package.json), e ali função componente ainda não recebe `ref` direto. Quem
// precisa é o editor de expressão (FormulaModal.tsx), que reposiciona o caret
// depois de aceitar uma sugestão.
export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { label, className = "", mono, rows = 2, ...props },
  ref
) {
  const control = (
    <textarea
      ref={ref}
      rows={rows}
      className={[
        "w-full resize-y rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm transition-colors",
        "placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100",
        "dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-400 dark:focus:border-blue-400 dark:focus:ring-blue-400/20",
        mono ? "font-mono" : "",
        className,
      ].join(" ")}
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
});
