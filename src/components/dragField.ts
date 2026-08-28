// Payload arrastado do FieldTree (fora deste módulo) pro input de um
// campo/vínculo — compartilhado entre BindingEditor.tsx, PropertyPanelKpi.tsx
// e PropertyPanelText.tsx (antes cada um tinha sua própria cópia; Kpi/Text
// usavam um `{ path: string; kind: string }` solto, sem a tipagem real de
// `kind`, que só o BindingEditor tinha).
export type DroppedField = {
  path: string;
  kind: "scalar" | "arraySource" | "arrayColumn" | "native";
  sourcePath?: string;
  column?: string;
};

export function readDroppedField(e: React.DragEvent): DroppedField | null {
  const raw = e.dataTransfer.getData("application/json");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DroppedField;
  } catch {
    return null;
  }
}

export const allowDrop = (e: React.DragEvent) => {
  if (e.dataTransfer.types.includes("application/json")) e.preventDefault();
};
