import type { CSSProperties } from "react";
import type { Binding } from "../../types";
import { FilterTab } from "../../components/FilterTab";
import { cx, type PartStyle } from "../../components/ui/cx";
import { useT } from "../../i18n";
import { useDesignerActions, useDesignerFilterColumns, useDesignerSelectedSchema } from "../context/hooks";
import { FILTERABLE_TYPES } from "../useTabBar";
import { SelectedFieldHeader } from "./SelectedFieldHeader";
import { useTabGate, type TabGate } from "./useTabGate";

export type DesignerFilterPanelProps = {
  className?: string;
  style?: CSSProperties;
  whenTab?: TabGate;
  // A header with the field's name and the multiple-selection warning — the
  // same one as DesignerPropertyPanel, because in `Designer.tsx` the two
  // lived inside the SAME `<div className="jpd-sidebar__panel">`.
  header?: boolean;
  parts?: { banner?: PartStyle };
};

// A placeable part: the row filter of the selected field's binding.
//
// One of the two parts examples/headless-designer said it had to give up
// (the other is DesignerBindingEditor).
//
// Three states, and the first renders `null` because the field simply has no
// filter to show:
//
//   no selection / a type that does not filter  -> null
//   filters, but still has no binding           -> a hint ("bind it first")
//   filters and has an array binding            -> <FilterTab>
//
// The hint STAYS (instead of becoming null) because there the absence is
// ACTIONABLE: the field accepts a filter, it is only missing the binding. It
// is the same distinction the tab bar makes with `filtroWarning`.
export function DesignerFilterPanel({ whenTab, ...rest }: DesignerFilterPanelProps) {
  if (!useTabGate(whenTab)) return null;
  return <DesignerFilterPanelBody {...rest} />;
}

function DesignerFilterPanelBody({ className, style, header = true, parts }: Omit<DesignerFilterPanelProps, "whenTab">) {
  const t = useT();
  const { selected, selectedBinding } = useDesignerSelectedSchema();
  const { handleChangeBinding } = useDesignerActions();
  const columns = useDesignerFilterColumns();

  if (!selected || !(FILTERABLE_TYPES as readonly string[]).includes(selected.type)) return null;

  // The field-type × binding-type pair has to match: a chart with an `array`
  // binding (possible, if the user changed the binding's type afterwards)
  // does not have the columns FilterTab expects.
  const pareado =
    (selected.type === "chart" && selectedBinding?.type === "chart") ||
    (selected.type === "table" && selectedBinding?.type === "array") ||
    (selected.type === "kpi" && selectedBinding?.type === "kpi");

  return (
    <div className={cx("jpd-sidebar__panel", className)} data-part="filter-panel" style={style}>
      {header && <SelectedFieldHeader banner={parts?.banner} />}
      {pareado ? (
        <FilterTab
          binding={selectedBinding as Extract<Binding, { type: "chart" | "array" | "kpi" }>}
          onChangeBinding={(b) => handleChangeBinding(selected.name, b)}
          columns={columns}
        />
      ) : (
        <p className="jpd-hint--md">{t.fieldsPanel.filterNeedsBinding}</p>
      )}
    </div>
  );
}
