// A known data source (an array detected in the sample JSON) — whoever
// consumes the lib may pass this list (see Designer/PropertyPanel) to swap the
// table's free text field for a "Data Source" dropdown, common in visual
// report editors. Without that list, the table goes back to accepting a freely
// typed path (the usual behavior).
// "number" (JS typeof number in the sample JSON) — used by the "+" that adds a
// column so it is born with currency formatting, without having to open the
// type picker afterwards. An absent field/another type = treated as plain
// text (the usual behavior).
export type DataSourceColumnType = "number" | "string" | "boolean" | "other";

export type DataSourceOption = {
  path: string;
  label: string;
  columns?: string[];
  columnTypes?: Record<string, DataSourceColumnType>;
};

// The payload dragged from a column "chip" (PropertyPanel, a section bound to
// an array with known columns) onto the canvas — dropping it creates both
// fields (header + value), both already members of the section (see PageCanvas.tsx).
export type SectionColumnDragPayload = { sectionId: string; column: string };
