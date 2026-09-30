import { useState } from "react";
import type { Binding, DataSourceOption, KpiElementKey, KpiSchema } from "../../types";
import type { FieldSources } from "../../designer/helpers";
import { BindingEditor } from "../BindingEditor";
import { FormulaButton } from "../formula/FormulaButton";
import { allowDrop, readDroppedField } from "../../drag";
import { MATERIAL_ICON_NAMES, materialIconLabels } from "../../materialIcons";
import { useLocale, useT, withInlineCode, type Locale } from "../../i18n";
import { DEFAULT_KPI_BORDER_RADIUS_PERCENT, DEFAULT_KPI_ICON_SIZE, DEFAULT_KPI_SUBTITLE_FONT_SIZE, DEFAULT_KPI_TITLE_FONT_SIZE, DEFAULT_KPI_VALUE_FONT_SIZE, kpiElementOffset, kpiElementOffsetPatch, kpiElementPresent, kpiElementRestorePatch } from "../../fields/kpi/card";
import { BulkLocked, ClearFieldButton, MaterialIcon } from "../ui";
import { useUiComponents } from "../ui/useUiComponents";

type Props = {
  schema: KpiSchema;
  activeTab: "dados" | "estilo";
  bulkEdit?: boolean;
  onChangeSchema: (patch: Partial<KpiSchema>) => void;
  binding: Binding | undefined;
  onChangeBinding: (b: Binding | null) => void;
  dataSources?: DataSourceOption[];
  // The fields this schema can reach — the left-hand list of the formula
  // modal (see designer/helpers.ts, fieldSourcesFor).
  fieldSources?: FieldSources;
  // The focused sub-element (see Designer.tsx/FieldList.tsx/KpiField.tsx) —
  // null/absent means Style shows the controls for the whole CARD
  // (background/text/rounding); set means it shows only the controls for
  // THAT element.
  selectedElement?: KpiElementKey | null;
  // Clears the focus (the "← Card style" button) — the same setter FieldList/
  // KpiField use to FOCUS an element (Designer.tsx), only called with `null`
  // here.
  onSelectElement?: (el: KpiElementKey | null) => void;
};

// Icon search + picker (Material Symbols, see materialIcons.ts) — it filters
// by the technical name OR by the label in the active language (e.g. "money"
// finds attach_money without having to know the technical name).
function IconPicker({ value, onChange, locale, removeLabel, searchPlaceholder, noneFoundLabel }: {
  value: string;
  onChange: (icon: string) => void;
  locale: Locale;
  removeLabel: string;
  searchPlaceholder: string;
  noneFoundLabel: string;
}) {
  const { Input } = useUiComponents();
  const [query, setQuery] = useState("");
  const labels = materialIconLabels(locale);
  const q = query.trim().toLowerCase();
  const matches = q
    ? MATERIAL_ICON_NAMES.filter((name) => name.replace(/_/g, " ").includes(q) || labels[name].toLowerCase().includes(q))
    : MATERIAL_ICON_NAMES;

  return (
    <div className="jpd-stack jpd-stack--snug">
      <div className="jpd-row">
        <span className="jpd-box">
          {value && value !== "none" ? <MaterialIcon icon={value} size={18} /> : <span className="jpd-box__empty">—</span>}
        </span>
        <Input
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {value && value !== "none" && (
          <button type="button" className="jpd-linkbtn jpd-linkbtn--muted" onClick={() => onChange("none")}>
            {removeLabel}
          </button>
        )}
      </div>
      <div className="jpd-iconpick">
        {matches.length === 0 && <p className="jpd-hint jpd-iconpick__empty">{noneFoundLabel}</p>}
        {matches.map((name) => (
          <button
            key={name}
            type="button"
            title={labels[name]}
            onClick={() => onChange(name)}
            className="jpd-iconpick__item"
            data-selected={value === name || undefined}
          >
            <MaterialIcon icon={name} size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}

// The "reset position" button — it only appears when the element has a
// custom offset (dragged on the canvas); it returns to the default layout
// (same "clear an optional field back to the default" pattern as
// PropertyPanelText.tsx, backgroundColor/borderColor with IconX).
function ResetPositionButton({ schema, el, label, onChangeSchema }: {
  schema: KpiSchema;
  el: KpiElementKey;
  label: string;
  onChangeSchema: (patch: Partial<KpiSchema>) => void;
}) {
  if (!kpiElementOffset(schema, el)) return null;
  return <ClearFieldButton onClick={() => onChangeSchema(kpiElementOffsetPatch(el, undefined))} label={label} />;
}

export function PropertyPanelKpi({ schema, onChangeSchema, activeTab, bulkEdit, binding, onChangeBinding, dataSources, fieldSources, selectedElement, onSelectElement }: Props) {
  const t = useT();
  const { Button, ColorInput, Input, Select } = useUiComponents();
  const locale = useLocale();

  // The KPI's three content fields are templates ({token}/{FUNCTION()}), so
  // each of them gets the ƒx of the formula modal.
  const formulaButton = (key: "title" | "value" | "subtitle", label: string) => (
    <FormulaButton
      active={Boolean(schema[key])}
      sources={fieldSources}
      target={{ label, value: schema[key] ?? "", onSave: (next) => onChangeSchema({ [key]: next }) }}
    />
  );
  const contentFields = (
    <>
      {/* DELIBERATELY without `jpd-row--grow`. These three fields had
          `className="flex-1"` on the `<Input>`, which the component forwards
          to the INNER `<input>` of the label wrapper — a flex column, where
          the control is already full width through `align-items: stretch`.
          Measured in the browser: 181.33px with and without the `flex-1`,
          which is to say a no-op. Applying the grow here would make the
          control take the whole row — a plausible improvement, and probably
          what the author wanted, but it is a LAYOUT CHANGE, and this phase is
          a class rename. Recorded as debt, not slipped in. */}
      <div className="jpd-row jpd-row--tight jpd-row--baseline">
        <Input
          label={t.kpi.title}
          value={schema.title ?? ""}
          onChange={(e) => onChangeSchema({ title: e.target.value })}
        />
        {formulaButton("title", t.kpi.title)}
      </div>
      <div className="jpd-row jpd-row--tight jpd-row--baseline">
        <Input
          mono
          label={t.kpi.valueLabel}
          value={schema.value ?? ""}
          onChange={(e) => onChangeSchema({ value: e.target.value })}
          onDragOver={allowDrop}
          onDrop={(e) => {
            const f = readDroppedField(e);
            if (!f) return;
            e.preventDefault();
            const token = `{${f.path}}`;
            onChangeSchema({ value: schema.value ? `${schema.value} ${token}` : token });
          }}
        />
        {formulaButton("value", t.formulaModal.valueTarget)}
      </div>
      <div className="jpd-row jpd-row--tight jpd-row--baseline">
        <Input
          label={t.kpi.subtitle}
          value={schema.subtitle ?? ""}
          onChange={(e) => onChangeSchema({ subtitle: e.target.value })}
        />
        {formulaButton("subtitle", t.kpi.subtitle)}
      </div>
      <p className="jpd-hint">{withInlineCode(t.kpi.hint)}</p>
    </>
  );

  // Estilo de UM sub-elemento — ou o botão de readicionar (se foi
  // removido via aba Campos), ou os controles daquele elemento +
  // "resetar posição" (posição em si só é arrastada no canvas, não tem
  // input numérico aqui — ver KpiField.tsx).
  function elementStyleFields(el: KpiElementKey) {
    if (!kpiElementPresent(schema, el)) {
      return (
        <Button variant="outline" onClick={() => onChangeSchema(kpiElementRestorePatch(el, t))}>
          {t.kpi.addElement}
        </Button>
      );
    }

    if (el === "icon") {
      return (
        <>
          <IconPicker
            value={schema.icon}
            onChange={(icon) => onChangeSchema({ icon })}
            locale={locale}
            removeLabel={t.kpi.removeIcon}
            searchPlaceholder={t.kpi.iconSearchPlaceholder}
            noneFoundLabel={t.kpi.noIconFound}
          />
          <div className="jpd-row">
            <Input
              type="number"
              label={t.kpi.iconSize}
              value={schema.iconSize ?? DEFAULT_KPI_ICON_SIZE}
              onChange={(e) => onChangeSchema({ iconSize: Number(e.target.value) })}
            />
            <ResetPositionButton schema={schema} el="icon" label={t.kpi.resetPosition} onChangeSchema={onChangeSchema} />
          </div>
        </>
      );
    }

    if (el === "title") {
      return (
        <div className="jpd-row">
          <Input
            type="number"
            label={t.kpi.titleFontSize}
            value={schema.titleFontSize ?? DEFAULT_KPI_TITLE_FONT_SIZE}
            onChange={(e) => onChangeSchema({ titleFontSize: Number(e.target.value) })}
          />
          <ResetPositionButton schema={schema} el="title" label={t.kpi.resetPosition} onChangeSchema={onChangeSchema} />
        </div>
      );
    }

    if (el === "value") {
      return (
        <>
          <div className="jpd-row">
            <Input
              type="number"
              label={t.kpi.valueFontSize}
              value={schema.valueFontSize ?? DEFAULT_KPI_VALUE_FONT_SIZE}
              onChange={(e) => onChangeSchema({ valueFontSize: Number(e.target.value) })}
            />
            <ResetPositionButton schema={schema} el="value" label={t.kpi.resetPosition} onChangeSchema={onChangeSchema} />
          </div>
          <Select
            label={t.kpi.numberFormat}
            value={schema.numberFormat ?? "none"}
            onChange={(e) => onChangeSchema({ numberFormat: e.target.value as KpiSchema["numberFormat"] })}
          >
            <option value="none">{t.kpi.numberFormatNone}</option>
            <option value="plain">{t.kpi.numberFormatPlain}</option>
            <option value="grouped">{t.kpi.numberFormatGrouped}</option>
          </Select>
        </>
      );
    }

    // "subtitle"
    return (
      <div className="jpd-row">
        <Input
          type="number"
          label={t.kpi.subtitleFontSize}
          value={schema.subtitleFontSize ?? DEFAULT_KPI_SUBTITLE_FONT_SIZE}
          onChange={(e) => onChangeSchema({ subtitleFontSize: Number(e.target.value) })}
        />
        <ResetPositionButton schema={schema} el="subtitle" label={t.kpi.resetPosition} onChangeSchema={onChangeSchema} />
      </div>
    );
  }

  return (
    <div className="jpd-stack">
      {activeTab === "dados" && (
        <>
          {bulkEdit ? <BulkLocked hint={t.fieldsPanel.bulkDataLocked}>{contentFields}</BulkLocked> : contentFields}
          <Select
            label={t.kpi.numberFormat}
            value={schema.numberFormat ?? "none"}
            onChange={(e) => onChangeSchema({ numberFormat: e.target.value as KpiSchema["numberFormat"] })}
          >
            <option value="none">{t.kpi.numberFormatNone}</option>
            <option value="plain">{t.kpi.numberFormatPlain}</option>
            <option value="grouped">{t.kpi.numberFormatGrouped}</option>
          </Select>
          <BindingEditor schema={schema} binding={binding} onChangeBinding={onChangeBinding} dataSources={dataSources} />
          {binding?.type === "kpi" && (
            <p className="jpd-hint">{t.kpi.boundOverridesValueHint}</p>
          )}
        </>
      )}

      {activeTab === "estilo" && !bulkEdit && selectedElement && (
        <div className="jpd-stack">
          <button
            type="button"
            className="jpd-linkbtn jpd-linkbtn--back"
            onClick={() => onSelectElement?.(null)}
          >
            {t.kpi.backToCardStyle}
          </button>
          {elementStyleFields(selectedElement)}
        </div>
      )}

      {activeTab === "estilo" && (bulkEdit || !selectedElement) && (
        <div className="jpd-stack">
          <div className="jpd-grid2">
            <ColorInput label={t.kpi.background} value={schema.backgroundColor} onChange={(e) => onChangeSchema({ backgroundColor: e.target.value })} />
            <ColorInput label={t.kpi.textIcon} value={schema.textColor} onChange={(e) => onChangeSchema({ textColor: e.target.value })} />
          </div>
          <Input
            type="number"
            min={0}
            max={100}
            label={t.kpi.borderRadius}
            value={schema.borderRadius ?? DEFAULT_KPI_BORDER_RADIUS_PERCENT}
            onChange={(e) => onChangeSchema({ borderRadius: Number(e.target.value) })}
          />
          {!bulkEdit && <p className="jpd-hint">{t.kpi.elementStyleHint}</p>}
        </div>
      )}
    </div>
  );
}
