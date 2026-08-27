import type { ReactNode } from "react";
import { IconLock } from "./icons";

// Envolve campos travados durante edição em bloco (vários campos do MESMO
// tipo selecionados juntos, ver Designer.tsx `bulkEditActive`) — visual de
// cadeado + pointer-events-none, pra não duplicar esse bloco em cada
// PropertyPanelXxx (Kpi/Chart/Text) que precisa disso.
export function BulkLocked({ hint, children }: { hint: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-slate-300 p-2 dark:border-gray-600">
      <p className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-gray-400">
        <IconLock /> {hint}
      </p>
      <div className="pointer-events-none flex flex-col gap-2 opacity-50">{children}</div>
    </div>
  );
}
