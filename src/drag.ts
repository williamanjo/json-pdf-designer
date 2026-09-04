// O CONTRATO DE ARRASTAR-E-SOLTAR DO EDITOR, num lugar só.
//
// Ele estava partido em dois, e nenhuma das metades tinha casa:
//
//   - o mime do arrasto INTERNO morava em `schemaFactory.ts`, que é a fábrica
//     de schemas e não tem nada a ver com drag;
//   - o payload EXTERNO morava em `components/dragField.ts`, um arquivo sem
//     componente nenhum dentro de uma pasta chamada `components`, com o mime
//     `"application/json"` escrito à mão três vezes.
//
// São dois canais distintos de propósito, e a distinção é o que importa aqui:
//
//   EXTERNO (`FIELD_MIME`) — a árvore de campos do app consumidor solta um
//   campo/caminho num input do painel ou no canvas. É contrato PÚBLICO de
//   fato: quem monta a própria árvore de campos escreve este payload, e o
//   `onCanvasDrop` do `<Designer>` recebe o evento cru.
//
//   INTERNO (`SECTION_COLUMN_MIME`) — o chip de coluna de seção vai pro
//   canvas. Mime próprio justamente pra o canvas conseguir distinguir "isto é
//   meu" de "isto é do app" (ver PageCanvas.tsx: ele testa o interno primeiro
//   e só então repassa pro `onCanvasDrop`).

// Payload externo. `application/json` é genérico de propósito: é o que uma
// árvore de campos escreve sem precisar conhecer nome de mime nosso.
export const FIELD_MIME = "application/json";

// Mime do arrasto interno "chip de coluna da seção" -> canvas. Distinto do
// drop externo (`onCanvasDrop`), que o app consumidor pode usar pra qualquer
// outra coisa.
export const SECTION_COLUMN_MIME = "application/x-json-pdf-designer-section-column";

// Payload arrastado da árvore de campos pro input de um campo/vínculo —
// compartilhado entre BindingEditor.tsx, PropertyPanelKpi.tsx e
// PropertyPanelText.tsx (antes cada um tinha sua própria cópia; Kpi/Text
// usavam um `{ path: string; kind: string }` solto, sem a tipagem real de
// `kind`, que só o BindingEditor tinha).
export type DroppedField = {
  path: string;
  kind: "scalar" | "arraySource" | "arrayColumn" | "native";
  sourcePath?: string;
  column?: string;
};

export function readDroppedField(e: React.DragEvent): DroppedField | null {
  const raw = e.dataTransfer.getData(FIELD_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DroppedField;
  } catch {
    return null;
  }
}

export const allowDrop = (e: React.DragEvent) => {
  if (e.dataTransfer.types.includes(FIELD_MIME)) e.preventDefault();
};
