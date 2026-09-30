import type { CSSProperties } from "react";
import { TemplateInspector } from "../../components/TemplateInspector";
import { cx } from "../../components/ui/cx";
import { useDesignerData, useDesignerSelection } from "../context/hooks";
import { useTabGate, type TabGate } from "./useTabGate";

export type DesignerInspectorProps = {
  // They go to the part's root element. `className` MERGES with ours
  // (yours comes last); your `style` beats ours.
  className?: string;
  style?: CSSProperties;
  // Render only on this tab (or tabs). Omitted = always render — see
  // useTabGate.ts for why that is the default.
  whenTab?: TabGate;
};

// A placeable part: the template inspector (fields by zone, binding/
// expression warnings).
//
// The part is an ADAPTER, not a replacement: `<TemplateInspector>` is still
// exported with today's props, and this here is "read the context, call what
// already exists". That way the headless path through props keeps working
// with no provider at all, and this extraction's diff reads as a MOVE.
//
// This is one of the three parts that WRAP (`.jpd-part`) instead of
// reproducing the inner root: `TemplateInspector` has TWO possible roots (the
// list, and an empty-state `<p>`), so there is no stable element to receive
// the consumer's `className`. The other parts do not wrap — they render the
// same root `Designer.tsx` had, and the DOM gains no level at all.
export function DesignerInspector({ whenTab, ...rest }: DesignerInspectorProps) {
  // The gate first, and NO hook after the return — which is why the body
  // lives in a separate component. See useTabGate.ts.
  if (!useTabGate(whenTab)) return null;
  return <DesignerInspectorBody {...rest} />;
}

function DesignerInspectorBody({ className, style }: Omit<DesignerInspectorProps, "whenTab">) {
  const { template, bindings } = useDesignerData();
  const { selectedIds, handleSelect } = useDesignerSelection();
  return (
    <div className={cx("jpd-part", className)} data-part="inspector" style={style}>
      <TemplateInspector template={template} bindings={bindings} selectedIds={selectedIds} onSelect={handleSelect} />
    </div>
  );
}
