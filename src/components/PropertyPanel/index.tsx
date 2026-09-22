import type { Binding, DataSourceOption, KpiElementKey, Schema, TableColumnStyle } from "../../types";
import type { FieldSources } from "../../designer/helpers";
import { BindingEditor } from "../BindingEditor";
import { PropertyPanelChart } from "./PropertyPanelChart";
import { PropertyPanelImage } from "./PropertyPanelImage";
import { PropertyPanelKpi } from "./PropertyPanelKpi";
import { PropertyPanelSection } from "./PropertyPanelSection";
import { PropertyPanelTable } from "./PropertyPanelTable";
import { PropertyPanelText } from "./PropertyPanelText";

type Props = {
  schema: Schema;
  binding: Binding | undefined;
  // Which of the top-level tabs (Designer.tsx) is active — this component
  // only draws the right CONTENT for the field type, the tab bar itself
  // (and the "Filter" tab, chart-only) lives in the Designer.
  activeTab: "dados" | "estilo";
  // Several fields of the SAME type selected together (see Designer.tsx
  // `bulkEditActive`) — only text/KPI/chart support it; the other types
  // ignore that prop and keep editing only the `schema` they received (the
  // last one selected).
  bulkEdit?: boolean;
  onChangeSchema: (patch: Partial<Schema>) => void;
  onChangeBinding: (b: Binding | null) => void;
  dataSources?: DataSourceOption[];
  // The table's known data source (a section member OR its own binding
  // matching one of dataSources) — the column list to add with "+"
  // (see Designer.tsx `findTableDataSource`).
  tableDataSource?: { path: string; columns: string[] };
  // Rewrites the whole column list (the "Columns, comma" input) — it keeps
  // content/footer/columnStyles/binding.columns at the same length.
  onSetHeadList?: (heads: string[]) => void;
  onAddTableColumn?: (column: string) => void;
  onRemoveTableColumn?: (index: number) => void;
  // Dragging an item of the "Current table columns" list to another position.
  onReorderTableColumn?: (fromIndex: number, toIndex: number) => void;
  // Style (color/background/size) of ONE column — header and value kept
  // separate. The "style" button in the column list opens the mini panel.
  onSetColumnStyle?: (index: number, patch: Partial<TableColumnStyle>) => void;
  onSetColumnWidth?: (index: number, widthMm: number | undefined) => void;
  // Formula for ONE column of the "array" binding — the "ƒx" button in the
  // column list. It only makes sense for a table with a real array binding
  // (with no binding, the template is already editable in the cell itself).
  onSetColumnFormula?: (index: number, formula: string) => void;
  onRenameTableColumn?: (index: number, label: string) => void;
  // The fields the selected schema can reach (see designer/helpers.ts,
  // fieldSourcesFor) — the left-hand list of the formula modal, the same
  // set for any field type.
  fieldSources?: FieldSources;
  // The focused KPI sub-element (see Designer.tsx) — only the KPI panel uses it.
  selectedKpiElement?: KpiElementKey | null;
  onSelectKpiElement?: (el: KpiElementKey | null) => void;
};

// The selected field's content for the active "Data"/"Style" tab — each
// type in its own component (text/table/image/section/chart/KPI), with no
// declarative propPanel, plain React. Image/Section have no Data/Style
// split of their own (their content is too simple to need one) — all of it
// shows under "Data"; the generic binding (BindingEditor) serves only those
// two types directly here, the others already embed the right binding inside
// their own component (chart, kpi) or do not need one at all (text uses the
// template right on the field, table has its own inside "Data").
export function PropertyPanel({
  schema,
  binding,
  activeTab,
  bulkEdit,
  onChangeSchema,
  onChangeBinding,
  dataSources,
  tableDataSource,
  onSetHeadList,
  onAddTableColumn,
  onRemoveTableColumn,
  onReorderTableColumn,
  onSetColumnStyle,
  onSetColumnWidth,
  onSetColumnFormula,
  onRenameTableColumn,
  fieldSources,
  selectedKpiElement,
  onSelectKpiElement,
}: Props) {
  if (schema.type === "text") {
    return (
      <PropertyPanelText
        schema={schema}
        activeTab={activeTab}
        bulkEdit={bulkEdit}
        onChangeSchema={onChangeSchema}
        fieldSources={fieldSources}
      />
    );
  }

  if (schema.type === "table") {
    return (
      <PropertyPanelTable
        schema={schema}
        binding={binding}
        activeTab={activeTab}
        onChangeSchema={onChangeSchema}
        onChangeBinding={onChangeBinding}
        dataSources={dataSources}
        tableDataSource={tableDataSource}
        onSetHeadList={onSetHeadList}
        onAddTableColumn={onAddTableColumn}
        onRemoveTableColumn={onRemoveTableColumn}
        onReorderTableColumn={onReorderTableColumn}
        onSetColumnStyle={onSetColumnStyle}
        onSetColumnWidth={onSetColumnWidth}
        onSetColumnFormula={onSetColumnFormula}
        onRenameTableColumn={onRenameTableColumn}
        fieldSources={fieldSources}
      />
    );
  }

  if (schema.type === "image") {
    return activeTab === "dados" ? (
      <>
        <PropertyPanelImage schema={schema} onChangeSchema={onChangeSchema} />
        <BindingEditor schema={schema} binding={binding} onChangeBinding={onChangeBinding} dataSources={dataSources} />
      </>
    ) : null;
  }

  if (schema.type === "section") {
    return activeTab === "dados" ? (
      <>
        <PropertyPanelSection schema={schema} binding={binding} dataSources={dataSources} />
        <BindingEditor schema={schema} binding={binding} onChangeBinding={onChangeBinding} dataSources={dataSources} />
      </>
    ) : null;
  }

  if (schema.type === "chart") {
    return (
      <PropertyPanelChart
        schema={schema}
        activeTab={activeTab}
        bulkEdit={bulkEdit}
        onChangeSchema={onChangeSchema}
        binding={binding}
        onChangeBinding={onChangeBinding}
        dataSources={dataSources}
      />
    );
  }

  // "kpi"
  return (
    <PropertyPanelKpi
      schema={schema}
      activeTab={activeTab}
      bulkEdit={bulkEdit}
      onChangeSchema={onChangeSchema}
      binding={binding}
      onChangeBinding={onChangeBinding}
      dataSources={dataSources}
      fieldSources={fieldSources}
      selectedElement={selectedKpiElement}
      onSelectElement={onSelectKpiElement}
    />
  );
}
