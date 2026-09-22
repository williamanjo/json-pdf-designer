import type { Schema, TextSchema } from "../../types";
import { mmToPx } from "../../page/units";

type Props = {
  schema: TextSchema;
  editing: boolean;
  onUpdate?: (patch: Partial<Schema>) => void;
  onStopEditing?: () => void;
};

export function TextField({ schema, editing, onUpdate, onStopEditing }: Props) {
  // Only what comes from the user's TEMPLATE stays inline. Size/color/alignment/
  // background/border are schema DATA, not theme — none of them can become a
  // stylesheet rule. The rest (100%x100%, padding 2, box-sizing, pre-wrap,
  // resize/outline/font-family) is fixed and lives in the CSS.
  const baseStyle: React.CSSProperties = {
    fontSize: mmToPx(schema.fontSize * 0.3528),
    color: schema.fontColor,
    textAlign: schema.alignment,
    backgroundColor: schema.backgroundColor,
  };

  if (editing) {
    // The schema border deliberately does NOT come in here: in editing mode it
    // was always cancelled (it was `border: "none"` after the spread). Since
    // `border: 0 solid` now lives in the class, passing the border inline
    // would bring it back — inline beats class.
    return (
      <textarea
        autoFocus
        value={schema.content}
        onChange={(e) => onUpdate?.({ content: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Escape") onStopEditing?.();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="jpd-textfield jpd-textfield--editing"
        style={baseStyle}
      />
    );
  }

  return (
    <div
      className="jpd-textfield jpd-textfield--static"
      style={{
        ...baseStyle,
        border: schema.borderColor && schema.borderWidth ? `${mmToPx(schema.borderWidth)}px solid ${schema.borderColor}` : undefined,
      }}
    >
      {schema.content}
    </div>
  );
}
