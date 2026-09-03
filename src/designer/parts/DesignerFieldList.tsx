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
  // O título "Campos" acima da lista. Ligado por default; desligue quando o
  // seu layout já rotula a região por fora.
  heading?: boolean;
  parts?: {
    // O `<h3>` do título.
    heading?: PartStyle;
    // A caixa que ROLA em volta da lista. É onde mora a altura máxima —
    // sobrescreva aqui pra dar mais (ou nenhuma) rolagem.
    scroll?: PartStyle;
  };
};

// Peça posicionável: a lista de campos (selecionar, renomear, travar,
// reordenar z, remover).
//
// A raiz é `.jpd-stack`, a MESMA que o `Designer.tsx` tinha. Sem nível novo
// de DOM.
export function DesignerFieldList({ whenTab, ...rest }: DesignerFieldListProps) {
  if (!useTabGate(whenTab)) return null;
  return <DesignerFieldListBody {...rest} />;
}

function DesignerFieldListBody({ className, style, heading = true, parts }: Omit<DesignerFieldListProps, "whenTab">) {
  const t = useT();
  const { template, bindings } = useDesignerData();
  const { selectedIds, selectedKpiElement, setSelectedKpiElement, handleSelect } = useDesignerSelection();
  const { updateSchema, removeSchema, bringToFront, sendToBack, renameSchema } = useDesignerActions();
  // A lista espelha o que o canvas mostra (modo isolado troca o conjunto) —
  // ver fieldListSchemasOf em context/derived.ts.
  const schemas = useDesignerFieldListSchemas();

  const h = readPart(parts?.heading);
  const scroll = readPart(parts?.scroll);

  return (
    <div className={cx("jpd-stack", className)} data-part="field-list" style={style}>
      {/* `jpd-stack` (gap 8px) faz o papel do `mb-2` que estava no <h3>:
          `.jpd-sectionhead` carrega `margin: 0` do grupo de reset, então a
          margem tinha de sair do título de qualquer forma. */}
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
