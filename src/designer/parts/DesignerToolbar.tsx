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
  // The "select a field…" hint above the buttons. On by default (it is what
  // the <Designer> shows); turn it off in a layout where the toolbar is not
  // glued to the field list and the sentence loses its referent.
  hint?: boolean;
};

// A placeable part: the 6 "add field" buttons, plus the section type picker
// that "+ section" opens.
//
// The root is `.jpd-sidebar__footer` — the SAME one `Designer.tsx` had
// around this block. The part adds no DOM level.
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

  // "+ section" does not create straight away — it opens this picker first
  // (empty, or already bound to a known data source). State LOCAL to the
  // part: closing the picker is the caller's decision, and
  // `actions.createSection` documents that on purpose (see its comment).
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  function createSection(sourcePath?: string) {
    actions.createSection(sourcePath);
    setShowSectionPicker(false);
  }

  // `nextFreeY` receives the grid step from the config — without it a custom
  // `gridSizeMm` aligned dragging but not the BIRTH of a field.
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
