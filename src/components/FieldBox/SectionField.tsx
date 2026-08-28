import type { SectionSchema } from "../../types";
import { useT } from "../../i18n";

// A seção só arrasta pela barra do topo (classe "section-drag-handle",
// travada no dragHandleClassName do Rnd em PageCanvas.tsx) — sem isso,
// qualquer clique dentro dela (que agora pode ter campo membro desenhado
// por cima) arriscava mover a seção sem querer em vez do campo.
export function SectionField(_props: { schema: SectionSchema }) {
  const t = useT();
  return (
    <div className="section-body relative h-full w-full overflow-hidden rounded-md border-2 border-dashed border-purple-400 bg-purple-50/50">
      <div className="section-drag-handle absolute inset-x-0 top-0 z-10 flex h-4 cursor-move items-center rounded-t bg-purple-600 px-1.5 text-[9px] font-medium text-white">
        {t.section.dragHandleHint}
      </div>
    </div>
  );
}
