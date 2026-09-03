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
  // Cabeçalho com o nome do campo e o aviso de seleção múltipla — o mesmo
  // do DesignerPropertyPanel, porque no `Designer.tsx` os dois viviam
  // dentro do MESMO `<div className="jpd-sidebar__panel">`.
  header?: boolean;
  parts?: { banner?: PartStyle };
};

// Peça posicionável: o filtro de linhas do vínculo do campo selecionado.
//
// Uma das duas peças que o examples/headless-designer disse ter tido de
// abrir mão (a outra é DesignerBindingEditor).
//
// Três estados, e o primeiro renderiza `null` porque o campo simplesmente
// não tem filtro nenhum pra mostrar:
//
//   sem seleção / tipo que não filtra  -> null
//   filtra, mas ainda sem vínculo      -> dica ("vincule primeiro")
//   filtra e tem vínculo de array      -> <FilterTab>
//
// A dica FICA (em vez de virar null) porque ali a ausência é ACIONÁVEL: o
// campo aceita filtro, só falta o vínculo. É a mesma distinção que a barra
// de abas faz com `filtroWarning`.
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

  // O par tipo-de-campo × tipo-de-vínculo tem de casar: um gráfico com
  // vínculo de `array` (possível, se o usuário trocou o tipo do vínculo
  // depois) não tem as colunas que o FilterTab espera.
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
