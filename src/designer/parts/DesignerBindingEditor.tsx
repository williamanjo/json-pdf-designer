import type { CSSProperties } from "react";
import { BindingEditor } from "../../components/BindingEditor";
import { cx } from "../../components/ui/cx";
import { useDesignerActions, useDesignerConfig, useDesignerSelectedSchema } from "../context/hooks";
import { useTabGate, type TabGate } from "./useTabGate";

export type DesignerBindingEditorProps = {
  className?: string;
  style?: CSSProperties;
  whenTab?: TabGate;
};

// A placeable part: the binding editor (which JSON path feeds the selected
// field) ON ITS OWN, outside the property panel.
//
// It exists because it is exactly what examples/headless-designer said it had
// to give up: inside the `<Designer>` the `BindingEditor` only appears nested
// in `PropertyPanel*`, per field type. Whoever builds their own editor wants
// to be able to put the binding in a column of its own.
//
// With no field selected it renders `null` — and not a hint. Empty-state text
// depends on the layout ("click a field on the left" only makes sense if
// there is a "left"), so it belongs to the consumer.
export function DesignerBindingEditor({ whenTab, ...rest }: DesignerBindingEditorProps) {
  if (!useTabGate(whenTab)) return null;
  return <DesignerBindingEditorBody {...rest} />;
}

function DesignerBindingEditorBody({ className, style }: Omit<DesignerBindingEditorProps, "whenTab">) {
  const { dataSources } = useDesignerConfig();
  const { selected, selectedBinding } = useDesignerSelectedSchema();
  const { handleChangeBinding } = useDesignerActions();
  if (!selected) return null;
  return (
    <div className={cx("jpd-part", className)} data-part="binding-editor" style={style}>
      <BindingEditor
        schema={selected}
        binding={selectedBinding}
        onChangeBinding={(b) => handleChangeBinding(selected.name, b)}
        dataSources={dataSources}
      />
    </div>
  );
}
