import type { CSSProperties } from "react";
import { PropertyPanel } from "../../components/PropertyPanel";
import { PositionFields, VisibleWhenField } from "../../components/PropertyPanel/PropertyPanelFields";
import { cx, type PartStyle } from "../../components/ui/cx";
import { fieldSourcesFor, findTableDataSource } from "../helpers";
import {
  useDesignerActions,
  useDesignerBulkEdit,
  useDesignerConfig,
  useDesignerData,
  useDesignerSelectedSchema,
  useDesignerSelection,
} from "../context/hooks";
import { SelectedFieldHeader } from "./SelectedFieldHeader";
import { useTabGate, type TabGate } from "./useTabGate";

export type DesignerPropertyPanelProps = {
  className?: string;
  style?: CSSProperties;
  whenTab?: TabGate;
  // Which half of the panel to draw. `"dados"` is content and binding,
  // `"estilo"` is appearance — the same split the tabs make.
  //
  // It is a PROP, and not a read of `sidebarTab`, precisely so the two halves
  // can be put side by side in a layout with no tabs: two instances, one with
  // each `section`. If this read the tab, the second instance would vanish.
  section?: "dados" | "estilo";
  // Position/size (X, Y, width, height) and "visible when". Default: only in
  // `section="dados"`, which is where the <Designer> shows them.
  position?: boolean;
  // A header with the field's name and the multiple-selection warning.
  header?: boolean;
  parts?: {
    // The `<p>` saying "N fields selected" / "bulk editing N".
    banner?: PartStyle;
  };
};

// A placeable part: the selected field's property panel.
//
// It dispatches on `schema.type` internally (text/table/image/section/chart/
// KPI) by calling the `<PropertyPanel>` that already exists. The individual
// `PropertyPanel{Text,Table,…}` are NOT parts and never will be: a standalone
// `<DesignerTextPanel/>` has no answer to "which schema?" other than "the
// selected one" — and then it is a worse DesignerPropertyPanel.
//
// The root is `.jpd-sidebar__panel`, the SAME one `Designer.tsx` had, and the
// header comes inside — because in the original the two were a single `<div>`
// with a gap of its own. Wrapping in an extra level would collapse that gap.
export function DesignerPropertyPanel({ whenTab, ...rest }: DesignerPropertyPanelProps) {
  if (!useTabGate(whenTab)) return null;
  return <DesignerPropertyPanelBody {...rest} />;
}

function DesignerPropertyPanelBody({
  className,
  style,
  section = "dados",
  position,
  header = true,
  parts,
}: Omit<DesignerPropertyPanelProps, "whenTab">) {
  const { template, bindings } = useDesignerData();
  const { dataSources } = useDesignerConfig();
  const { selectedIds, selectedKpiElement, setSelectedKpiElement } = useDesignerSelection();
  const { selected, selectedBinding } = useDesignerSelectedSchema();
  const { bulkEditActive } = useDesignerBulkEdit();
  const {
    updateSchema,
    updateSchemas,
    handleChangeBinding,
    setTableHead,
    renameTableColumn,
    addTableColumn,
    removeTableColumn,
    reorderTableColumn,
    setColumnStyle,
    setColumnWidth,
    setColumnFormula,
  } = useDesignerActions();

  if (!selected) return null;

  const mostraPosicao = position ?? section === "dados";

  return (
    <div className={cx("jpd-sidebar__panel", className)} data-part="property-panel" data-section={section} style={style}>
      {header && <SelectedFieldHeader banner={parts?.banner} />}

      {mostraPosicao && (
        <>
          <PositionFields schema={selected} onChangeSchema={(patch) => updateSchema(selected.id, patch)} />
          <VisibleWhenField schema={selected} onChangeSchema={(patch) => updateSchema(selected.id, patch)} />
        </>
      )}

      <PropertyPanel
        // `key` on the id: switching fields has to REMOUNT the panel, otherwise
        // its local state (inner tab, an open column mini-panel) leaks from
        // one field to the other.
        key={selected.id}
        schema={selected}
        binding={selectedBinding}
        activeTab={section}
        bulkEdit={bulkEditActive}
        onChangeSchema={(patch) => (bulkEditActive ? updateSchemas(selectedIds, patch) : updateSchema(selected.id, patch))}
        onChangeBinding={(b) => handleChangeBinding(selected.name, b)}
        dataSources={dataSources}
        tableDataSource={findTableDataSource(selected, template.schemas, bindings, dataSources)}
        fieldSources={fieldSourcesFor(selected, template.schemas, bindings, dataSources)}
        onSetHeadList={setTableHead}
        onRenameTableColumn={renameTableColumn}
        onAddTableColumn={addTableColumn}
        onRemoveTableColumn={removeTableColumn}
        onReorderTableColumn={reorderTableColumn}
        onSetColumnStyle={setColumnStyle}
        onSetColumnWidth={setColumnWidth}
        onSetColumnFormula={setColumnFormula}
        selectedKpiElement={selectedKpiElement}
        onSelectKpiElement={setSelectedKpiElement}
      />
    </div>
  );
}
