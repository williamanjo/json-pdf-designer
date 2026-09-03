import type { SectionSchema } from "../../types";
import { useT } from "../../i18n";

// A seção só arrasta pela barra do topo (classe "jpd-section__handle",
// travada no dragHandleClassName do Rnd em PageCanvas.tsx) — sem isso,
// qualquer clique dentro dela (que agora pode ter campo membro desenhado
// por cima) arriscava mover a seção sem querer em vez do campo.
//
// AS DUAS CLASSES DAQUI SÃO LIDAS POR JAVASCRIPT, não só por CSS:
// "jpd-section__body" é testada com classList.contains() no hit-test de área
// vazia e "jpd-section__handle" vai pro dragHandleClassName do react-rnd (que
// faz o casamento no DOM por conta própria). Renomear uma delas sem renomear
// o par em PageCanvas.tsx quebra arrasto/seleção SEM erro no console.
export function SectionField(_props: { schema: SectionSchema }) {
  const t = useT();
  return (
    <div className="jpd-section__body">
      <div className="jpd-section__handle">{t.section.dragHandleHint}</div>
    </div>
  );
}
