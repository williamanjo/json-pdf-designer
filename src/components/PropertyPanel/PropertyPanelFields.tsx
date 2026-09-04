import type { Schema } from "../../types";
import { useT } from "../../i18n";
import { expressionError } from "../../expressions/resolve";
import { useUiComponents } from "../ui/useUiComponents";

type Props<S extends Schema> = {
  schema: S;
  onChangeSchema: (patch: Partial<S>) => void;
};

// X/Y/largura/altura — comum a qualquer tipo de campo. Tabela tem aba
// "Estilo" própria e mostra esses campos lá dentro, junto do resto da
// aparência, em vez de deixá-los soltos acima das abas (ver PropertyPanel).
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

// Visibilidade condicional (`schema.visibleWhen`) — comum a qualquer tipo de
// campo, igual PositionFields. A expressão vai SEM chaves (é a condição nua,
// não um template), e o erro de sintaxe aparece embaixo do input na hora, em
// vez de só no ícone da lista de campos: quem está digitando a condição é quem
// precisa do retorno imediato.
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
