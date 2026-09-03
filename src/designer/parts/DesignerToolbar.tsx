import { useState, type CSSProperties } from "react";
import { Toolbar } from "../../components/Toolbar";
import { cx } from "../../components/ui/cx";
import { useUiComponents } from "../../components/ui/useUiComponents";
import { useT } from "../../i18n";
import { makeChartSchema, makeImageSchema, makeKpiSchema, makeTableSchema, makeTextSchema, nextFreeY } from "../../schemaFactory";
import { useDesignerActions, useDesignerConfig, useDesignerData } from "../context/hooks";
import { useTabGate, type TabGate } from "./useTabGate";

export type DesignerToolbarProps = {
  className?: string;
  style?: CSSProperties;
  whenTab?: TabGate;
  // A dica "selecione um campo…" acima dos botões. Ligada por default (é o
  // que o <Designer> mostra); desligue num layout onde a toolbar não fica
  // grudada na lista de campos e a frase perde referente.
  hint?: boolean;
};

// Peça posicionável: os 6 botões de "adicionar campo", mais o seletor de
// tipo de seção que o "+ seção" abre.
//
// A raiz é `.jpd-sidebar__footer` — a MESMA que o `Designer.tsx` tinha em
// volta deste bloco. A peça não adiciona nível de DOM.
export function DesignerToolbar({ whenTab, ...rest }: DesignerToolbarProps) {
  if (!useTabGate(whenTab)) return null;
  return <DesignerToolbarBody {...rest} />;
}

function DesignerToolbarBody({ className, style, hint = true }: Omit<DesignerToolbarProps, "whenTab">) {
  const t = useT();
  const { Button } = useUiComponents();
  const { template } = useDesignerData();
  const { dataSources, gridSizeMm } = useDesignerConfig();
  const actions = useDesignerActions();
  const { addSchema } = actions;

  // "+ seção" não cria na hora — abre este seletor primeiro (vazia, ou já
  // vinculada a uma fonte de dados conhecida). Estado LOCAL da peça: fechar
  // o seletor é decisão de quem chama, e `actions.createSection` documenta
  // isso de propósito (ver o comentário dela em actions.ts).
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  function createSection(sourcePath?: string) {
    actions.createSection(sourcePath);
    setShowSectionPicker(false);
  }

  // `nextFreeY` recebe o passo da grade da config — sem isso um
  // `gridSizeMm` customizado alinhava o arrasto mas não o NASCIMENTO.
  const y = () => nextFreeY(template.schemas, gridSizeMm);

  return (
    <div className={cx("jpd-sidebar__footer", className)} data-part="toolbar" style={style}>
      {hint && <p className="jpd-hint--md">{t.fieldsPanel.selectHint}</p>}
      <Toolbar
        onAddText={() => addSchema(makeTextSchema(y(), t))}
        onAddTable={() => addSchema(makeTableSchema(y(), t))}
        onAddImage={() => addSchema(makeImageSchema(y(), t))}
        onAddSection={() => setShowSectionPicker(true)}
        onAddChart={() => addSchema(makeChartSchema(y(), t))}
        onAddKpi={() => addSchema(makeKpiSchema(y(), t))}
      />
      {showSectionPicker && (
        <div className="jpd-callout jpd-callout--solid jpd-callout--roomy" data-tone="purple">
          <p className="jpd-callout__title jpd-callout__title--strong">{t.fieldsPanel.sectionTypeQuestion}</p>
          <div className="jpd-callout__actions">
            <Button variant="outline" onClick={() => createSection()}>
              {t.fieldsPanel.sectionEmpty}
            </Button>
            {(dataSources ?? []).map((d) => (
              <Button key={d.path} variant="outline" onClick={() => createSection(d.path)}>
                {d.label}
              </Button>
            ))}
          </div>
          {(!dataSources || dataSources.length === 0) && <p className="jpd-callout__hint">{t.fieldsPanel.noDataSource}</p>}
          <Button variant="ghost" onClick={() => setShowSectionPicker(false)}>
            {t.fieldsPanel.cancel}
          </Button>
        </div>
      )}
    </div>
  );
}
