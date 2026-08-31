import type { ReactNode } from "react";

// Shell repetido 3x em PropertyPanelTable.tsx (Cabeçalho/Valor/Totais,
// dentro da aba "estilo") — um <details>/<summary> nativo, sem estado
// React, porque o navegador já cuida do expandir/colapsar sozinho.
// Extraído aqui pra não copiar as mesmas classes 3 vezes; wiring nos 3
// lugares deve dar zero mudança visual (mesmas classes, mesma estrutura).
export function CollapsibleSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="rounded-lg border border-dashed border-slate-300 p-2 dark:border-gray-600">
      <summary className="cursor-pointer select-none text-[10px] font-medium text-slate-500 dark:text-gray-400">
        {title}
      </summary>
      <div className="mt-2 flex flex-col gap-1.5">{children}</div>
    </details>
  );
}
