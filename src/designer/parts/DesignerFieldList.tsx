import type { CSSProperties } from "react";
import { FieldList } from "../../components/FieldList";
import { cx, readPart, type PartStyle } from "../../components/ui/cx";
import { useT } from "../../i18n";
import { useDesignerActions, useDesignerData, useDesignerFieldListSchemas, useDesignerSelection } from "../context/hooks";
import { useTabGate, type TabGate } from "./useTabGate";

export type DesignerFieldListProps = {
  className?: string;
  style?: CSSProperties;
  whenTab?: TabGate;
  // The "Fields" title above the list. On by default; turn it off when your
  // layout already labels the region from outside.
  heading?: boolean;
  parts?: {
    // The title's `<h3>`.
    heading?: PartStyle;
    // The box that SCROLLS around the list. That is where the maximum height
    // lives — override it here to give more (or no) scrolling.
    scroll?: PartStyle;
  };
};

// A placeable part: the field list (select, rename, lock, reorder z,
// remove).
//
// The root is `.jpd-stack`, the SAME one `Designer.tsx` had. No new DOM
// level.
export function DesignerFieldList({ whenTab, ...rest }: DesignerFieldListProps) {
  if (!useTabGate(whenTab)) return null;
  return <DesignerFieldListBody {...rest} />;
}

function DesignerFieldListBody({ className, style, heading = true, parts }: Omit<DesignerFieldListProps, "whenTab">) {
  const t = useT();
  const { template, bindings } = useDesignerData();
  const { selectedIds, selectedKpiElement, setSelectedKpiElement, handleSelect } = useDesignerSelection();
  const { updateSchema, removeSchema, bringToFront, sendToBack, renameSchema } = useDesignerActions();
  // The list mirrors what the canvas shows (isolated mode swaps the set) —
  // see fieldListSchemasOf in context/derived.ts.
  const schemas = useDesignerFieldListSchemas();

  const h = readPart(parts?.heading);
  const scroll = readPart(parts?.scroll);

  return (
    <div className={cx("jpd-stack", className)} data-part="field-list" style={style}>
      {/* `jpd-stack` (8px gap) plays the role of the `mb-2` that was on the
          <h3>: `.jpd-sectionhead` carries `margin: 0` from the reset group, so
          the margin had to leave the title one way or another. */}
      {heading && (
        <h3 className={cx("jpd-sectionhead", h.className)} style={h.style}>
          {t.fieldsPanel.heading}
        </h3>
      )}
      <div className={cx("jpd-fieldlist__scroll", scroll.className)} style={scroll.style}>
        <FieldList
          schemas={schemas}
          selectedIds={selectedIds}
          onSelect={handleSelect}
          onRemove={removeSchema}
          onToggleLock={(id) => updateSchema(id, { locked: !template.schemas.find((s) => s.id === id)?.locked })}
          onBringToFront={bringToFront}
          onSendToBack={sendToBack}
          bindings={bindings}
          onRename={renameSchema}
          selectedKpiElement={selectedKpiElement}
          onSelectKpiElement={setSelectedKpiElement}
          onChangeSchema={updateSchema}
        />
      </div>
    </div>
  );
}
