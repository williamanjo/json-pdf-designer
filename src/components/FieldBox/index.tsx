import type { KpiElementKey, Schema } from "../../types";
import { ChartField } from "./ChartField";
import { ImageField } from "./ImageField";
import { KpiField } from "./KpiField";
import { SectionField } from "./SectionField";
import { TableField } from "./TableField";
import { TextField } from "./TextField";

type Props = {
  schema: Schema;
  editing?: boolean;
  onUpdate?: (patch: Partial<Schema>) => void;
  onStopEditing?: () => void;
  // Only used by the KPI (draggable sub-elements, see KpiField.tsx) — the
  // remaining types ignore them.
  selected?: boolean;
  zoom?: number;
  selectedKpiElement?: KpiElementKey | null;
  onSelectKpiElement?: (el: KpiElementKey) => void;
};

// Renders a field's content on the canvas — text/table/image/section/
// chart/kpi — according to the schema's design-time content (not the
// real data, which only enters when the PDF is generated). In `editing`
// mode, text and table turn into inputs editable right on top of the
// field (a double click turns the mode on). One file per type (see
// ./TextField, ./TableField...) — this file only decides which to use.
export function FieldBox({
  schema,
  editing = false,
  onUpdate,
  onStopEditing,
  selected,
  zoom,
  selectedKpiElement,
  onSelectKpiElement,
}: Props) {
  if (schema.type === "text") {
    return <TextField schema={schema} editing={editing} onUpdate={onUpdate} onStopEditing={onStopEditing} />;
  }

  if (schema.type === "table") {
    return <TableField schema={schema} editing={editing} onUpdate={onUpdate} onStopEditing={onStopEditing} zoom={zoom} />;
  }

  if (schema.type === "section") {
    return <SectionField schema={schema} />;
  }

  if (schema.type === "chart") {
    return <ChartField schema={schema} />;
  }

  if (schema.type === "kpi") {
    return (
      <KpiField
        schema={schema}
        selected={selected}
        zoom={zoom}
        selectedElement={selectedKpiElement}
        onSelectElement={onSelectKpiElement}
        onUpdate={onUpdate}
      />
    );
  }

  // image — a double click swaps the file directly (there is no "text" to edit)
  return <ImageField schema={schema} onUpdate={onUpdate} />;
}
