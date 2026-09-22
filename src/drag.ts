// THE EDITOR'S DRAG-AND-DROP CONTRACT, in one place.
//
// It was split in two, and neither half had a home:
//
//   - the INTERNAL drag's mime lived in `schemaFactory.ts`, which is the
//     schema factory and has nothing to do with dragging;
//   - the EXTERNAL payload lived in `components/dragField.ts`, a file with no
//     component at all inside a folder called `components`, with the mime
//     `"application/json"` written out by hand three times.
//
// They are two deliberately distinct channels, and the distinction matters:
//
//   EXTERNAL (`FIELD_MIME`) — the consumer app's field tree drops a
//   field/path into a panel input or onto the canvas. It is a PUBLIC contract
//   in practice: whoever builds their own field tree writes this payload, and
//   the `<Designer>`'s `onCanvasDrop` receives the raw event.
//
//   INTERNAL (`SECTION_COLUMN_MIME`) — the section's column chip goes to the
//   canvas. A mime of its own precisely so the canvas can tell "this is mine"
//   from "this is the app's" (see PageCanvas.tsx: it tests the internal one
//   first and only then forwards to `onCanvasDrop`).

// The external payload. `application/json` is generic on purpose: it is what
// a field tree writes without having to know a mime name of ours.
export const FIELD_MIME = "application/json";

// Mime of the internal "section column chip" -> canvas drag. Distinct from
// the external drop (`onCanvasDrop`), which the consumer app may use for
// anything else.
export const SECTION_COLUMN_MIME = "application/x-json-pdf-designer-section-column";

// The payload dragged from the field tree into a field/binding input —
// shared between BindingEditor.tsx, PropertyPanelKpi.tsx and
// PropertyPanelText.tsx (each used to have its own copy; Kpi/Text used a
// loose `{ path: string; kind: string }`, without the real typing of `kind`,
// which only the BindingEditor had).
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
