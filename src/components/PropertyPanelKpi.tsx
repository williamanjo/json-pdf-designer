import { useState } from "react";
import type { Binding, DataSourceOption, KpiElementKey, KpiSchema } from "../types";
import type { FieldSources } from "../designer/helpers";
import { BindingEditor } from "./BindingEditor";
import { FormulaButton } from "./FormulaButton";
import { allowDrop, readDroppedField } from "./dragField";
import { MATERIAL_ICON_NAMES, materialIconLabels } from "../materialIcons";
import { useLocale, useT, withInlineCode, type Locale } from "../i18n";
import {
  DEFAULT_KPI_BORDER_RADIUS_PERCENT,
  DEFAULT_KPI_ICON_SIZE,
  DEFAULT_KPI_SUBTITLE_FONT_SIZE,
  DEFAULT_KPI_TITLE_FONT_SIZE,
  DEFAULT_KPI_VALUE_FONT_SIZE,
  kpiElementOffset,
  kpiElementOffsetPatch,
  kpiElementPresent,
  kpiElementRestorePatch,
} from "../kpiFormat";
import { BulkLocked, ClearFieldButton, MaterialIcon } from "./ui";
import { useUiComponents } from "./ui/useUiComponents";

type Props = {
  schema: KpiSchema;
  activeTab: "dados" | "estilo";
  bulkEdit?: boolean;
  onChangeSchema: (patch: Partial<KpiSchema>) => void;
  binding: Binding | undefined;
  onChangeBinding: (b: Binding | null) => void;
  dataSources?: DataSourceOption[];
  // Campos que este schema alcança — a lista da esquerda do modal de
  // fórmula (ver designer/helpers.ts, fieldSourcesFor).
  fieldSources?: FieldSources;
  // Sub-elemento focado (ver Designer.tsx/FieldList.tsx/KpiField.tsx) —
  // null/ausente = Estilo mostra os controles do CARTÃO inteiro
  // (fundo/texto/arredondamento); definido = mostra só os controles
  // DAQUELE elemento.
  selectedElement?: KpiElementKey | null;
  // Limpa o foco (botão "← Estilo do card") — mesmo setter que FieldList/
  // KpiField usam pra FOCAR um elemento (Designer.tsx), só que chamado com
  // `null` aqui.
  onSelectElement?: (el: KpiElementKey | null) => void;
};

// Busca+seleção de ícone (Material Symbols, ver materialIcons.ts) — filtra
// pelo nome técnico OU pelo rótulo no idioma ativo (ex: "money" acha
// attach_money mesmo sem saber o nome técnico).
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

// Botão "resetar posição" — só aparece quando o elemento tem um offset
// customizado (arrastado no canvas); volta pro layout padrão (mesmo
// padrão de "limpar campo opcional pro default" de PropertyPanelText.tsx,
// backgroundColor/borderColor com IconX).
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

  // Os três campos de conteúdo do KPI são templates ({token}/{FUNCAO()}),
  // então cada um ganha o ƒx do modal de fórmula.
  const formulaButton = (key: "title" | "value" | "subtitle", label: string) => (
    <FormulaButton
      active={Boolean(schema[key])}
      sources={fieldSources}
      target={{ label, value: schema[key] ?? "", onSave: (next) => onChangeSchema({ [key]: next }) }}
    />
  );
  const contentFields = (
    <>
      {/* SEM `jpd-row--grow` de propósito. Estes três campos tinham
          `className="flex-1"` no `<Input>`, que o componente repassa pro
          `<input>` de DENTRO do wrapper de rótulo — um flex column, onde o
          controle já é largura total por `align-items: stretch`. Medido no
          navegador: 181.33px com e sem o `flex-1`, ou seja, no-op.
          Aplicar o grow aqui faria o controle passar a ocupar a linha
          inteira — melhoria plausível, e provavelmente o que o autor
          queria, mas é MUDANÇA DE LAYOUT, e esta fase é rename de classe.
          Fica registrado como dívida, não entra escondido. */}
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
