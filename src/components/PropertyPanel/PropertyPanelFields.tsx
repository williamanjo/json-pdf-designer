import type { Schema } from "../../types";
import { useT } from "../../i18n";
import { expressionError } from "../../expressions/resolve";
import { useUiComponents } from "../ui/useUiComponents";

type Props<S extends Schema> = {
  schema: S;
  onChangeSchema: (patch: Partial<S>) => void;
};

// X/Y/width/height — common to any field type. The table has a "Style" tab
// of its own and shows these fields inside it, next to the rest of the
// appearance, instead of leaving them loose above the tabs (see PropertyPanel).
export function PositionFields<S extends Schema>({ schema, onChangeSchema }: Props<S>) {
  const t = useT();
  const { Input } = useUiComponents();
  return (
    <div className="jpd-grid2">
      <Input
        label={t.position.x}
        type="number"
        value={schema.x}
        onChange={(e) => onChangeSchema({ x: Number(e.target.value) } as Partial<S>)}
      />
      <Input
        label={t.position.y}
        type="number"
        value={schema.y}
        onChange={(e) => onChangeSchema({ y: Number(e.target.value) } as Partial<S>)}
      />
      <Input
        label={t.position.width}
        type="number"
        value={schema.width}
        onChange={(e) => onChangeSchema({ width: Number(e.target.value) } as Partial<S>)}
      />
      <Input
        label={t.position.height}
        type="number"
        value={schema.height}
        onChange={(e) => onChangeSchema({ height: Number(e.target.value) } as Partial<S>)}
      />
    </div>
  );
}

// Conditional visibility (`schema.visibleWhen`) — common to any field type,
// like PositionFields. The expression goes in WITHOUT braces (it is the bare
// condition, not a template), and a syntax error shows up under the input
// immediately, instead of only on the icon in the field list: whoever is
// typing the condition is the one who needs the instant feedback.
export function VisibleWhenField<S extends Schema>({ schema, onChangeSchema }: Props<S>) {
  const t = useT();
  const { Input } = useUiComponents();
  const raw = schema.visibleWhen ?? "";
  const error = raw.trim() ? expressionError(raw.trim(), t) : null;
  return (
    <div className="jpd-stack jpd-stack--tight">
      <Input
        label={t.visibleWhen.label}
        value={raw}
        placeholder={t.visibleWhen.placeholder}
        onChange={(e) => onChangeSchema({ visibleWhen: e.target.value || undefined } as Partial<S>)}
      />
      {error ? (
        <span className="jpd-error jpd-error--sm">{error}</span>
      ) : (
        <span className="jpd-meta jpd-meta--sm">{t.visibleWhen.hint}</span>
      )}
    </div>
  );
}
