import type { Schema } from "../types";
import { pxToMm } from "../page/units";

// Altura (mm) da barra "jpd-section__handle" no topo da seção
// (FieldBox/SectionField.tsx, h-4 = 16px) — usada pra caixa de seleção só
// pegar a seção quando cruza essa faixa, não o corpo inteiro.
const SECTION_HEADER_HEIGHT_MM = pxToMm(16);

// Centro do campo caindo dentro do retângulo de uma seção = vira membro
// dela (sectionId) — fora de qualquer seção = limpa o vínculo de grupo.
export function findSectionAt(schemas: Schema[], x: number, y: number, width: number, height: number, excludeId: string) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  return schemas.find(
    (s) => s.id !== excludeId && s.type === "section" && cx >= s.x && cx <= s.x + s.width && cy >= s.y && cy <= s.y + s.height
  );
}

// Hit-test da caixa de seleção (marquee): quais schemas cruzam o retângulo
// (mm) desenhado no fundo do canvas. Seção só entra na seleção se a caixa
// cruzar a faixa do HEADER dela (mesma altura da barra
// "jpd-section__handle") — cruzar só o corpo (onde os campos membros ficam
// desenhados) nunca seleciona a seção, só os campos que estiverem por baixo
// da caixa.
export function schemasInRect(schemas: Schema[], rectMm: { x1: number; y1: number; x2: number; y2: number }) {
  return schemas.filter((s) => {
    const testHeight = s.type === "section" ? Math.min(s.height, SECTION_HEADER_HEIGHT_MM) : s.height;
    return s.x < rectMm.x2 && s.x + s.width > rectMm.x1 && s.y < rectMm.y2 && s.y + testHeight > rectMm.y1;
  });
}
