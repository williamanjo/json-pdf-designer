import type { Schema, TextSchema } from "../../types";
import { mmToPx } from "../../units";

type Props = {
  schema: TextSchema;
  editing: boolean;
  onUpdate?: (patch: Partial<Schema>) => void;
  onStopEditing?: () => void;
};

export function TextField({ schema, editing, onUpdate, onStopEditing }: Props) {
  // Só o que vem do TEMPLATE do usuário fica inline. Tamanho/cor/alinhamento/
  // fundo/borda são DADO do schema, não tema — nenhum deles pode virar regra
  // de folha de estilo. O resto (100%x100%, padding 2, box-sizing, pre-wrap,
  // resize/outline/font-family) é fixo e mora no CSS.
  const baseStyle: React.CSSProperties = {
    fontSize: mmToPx(schema.fontSize * 0.3528),
    color: schema.fontColor,
    textAlign: schema.alignment,
    backgroundColor: schema.backgroundColor,
  };

  if (editing) {
    // A borda do schema NÃO entra aqui de propósito: no modo de edição ela
    // sempre foi anulada (era `border: "none"` depois do spread). Como agora o
    // `border: 0 solid` mora na classe, passar a borda inline a faria
    // reaparecer — inline vence classe.
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
