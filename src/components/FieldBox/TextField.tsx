import type { Schema, TextSchema } from "../../types";
import { mmToPx } from "../../units";

type Props = {
  schema: TextSchema;
  editing: boolean;
  onUpdate?: (patch: Partial<Schema>) => void;
  onStopEditing?: () => void;
};

export function TextField({ schema, editing, onUpdate, onStopEditing }: Props) {
  const baseStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    fontSize: mmToPx(schema.fontSize * 0.3528),
    color: schema.fontColor,
    textAlign: schema.alignment,
    padding: 2,
    backgroundColor: schema.backgroundColor,
    boxSizing: "border-box",
    border: schema.borderColor && schema.borderWidth ? `${mmToPx(schema.borderWidth)}px solid ${schema.borderColor}` : undefined,
  };

  if (editing) {
    return (
      <textarea
        autoFocus
        value={schema.content}
        onChange={(e) => onUpdate?.({ content: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Escape") onStopEditing?.();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          ...baseStyle,
          resize: "none",
          border: "none",
          outline: "none",
          fontFamily: "inherit",
          whiteSpace: "pre-wrap",
        }}
      />
    );
  }

  return <div style={{ ...baseStyle, overflow: "hidden", whiteSpace: "pre-wrap" }}>{schema.content}</div>;
}
