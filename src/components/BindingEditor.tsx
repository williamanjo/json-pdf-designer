import { useState } from "react";
import type { Binding, DataSourceColumnType, DataSourceOption, KpiAggregation, Schema } from "../types";
import { buildChartBinding, buildKpiBinding, buildSectionBinding, buildTableBinding, buildTemplateBinding } from "../bindings/builders";
import { CUSTOM_FIELD_FUNCTIONS, describeBindingShort } from "../bindings/bindings";
import { stringifyColumns } from "../bindings/columnParsing";
import { useT, withInlineCode } from "../i18n";
import { allowDrop, readDroppedField } from "./dragField";
import { Button, Input, Select } from "./ui";
import { IconLink } from "./ui/icons";

type Props = {
  schema: Schema;
  binding: Binding | undefined;
  onChangeBinding: (b: Binding | null) => void;
  dataSources?: DataSourceOption[];
};

// "Fonte conhecida -> <Select> de dataSources, senão <Input> livre com
// drop" — mesmo par de branches repetido nos vínculos chart/table/kpi
// abaixo, só mudava o placeholder livre e o que acontecia ao escolher.
function DataSourcePicker({
  knownSources,
  value,
  freePlaceholder,
  onSelect,
  onFreeChange,
  onDropFree,
}: {
  knownSources: DataSourceOption[] | null;
  value: string;
  freePlaceholder: string;
  onSelect: (source: DataSourceOption) => void;
  onFreeChange: (v: string) => void;
  onDropFree: (e: React.DragEvent) => void;
}) {
  const t = useT();
  if (knownSources) {
    return (
      <Select
        value={knownSources.some((d) => d.path === value.trim()) ? value.trim() : ""}
        onChange={(e) => {
          const source = knownSources.find((d) => d.path === e.target.value);
          if (source) onSelect(source);
        }}
      >
        <option value="">{t.bindingEditor.dataSourcePlaceholder}</option>
        {knownSources.map((d) => (
          <option key={d.path} value={d.path}>
            {d.label}
          </option>
        ))}
      </Select>
    );
  }
  return <Input placeholder={freePlaceholder} value={value} onChange={(e) => onFreeChange(e.target.value)} onDragOver={allowDrop} onDrop={onDropFree} />;
}

// "Colunas conhecidas -> <Select>, senão <Input> livre com drop próprio" —
// mesmo par repetido pro rótulo/valor do chart e pro valor do kpi.
// `showNumericHint` liga o sufixo "(não-numérica)" só onde já aparecia
// antes (coluna de VALOR) — não no rótulo do chart.
function ColumnPicker({
  columns,
  columnTypes,
  value,
  onChange,
  placeholder,
  onDropCustom,
  showNumericHint,
}: {
  columns: string[];
  columnTypes?: Record<string, DataSourceColumnType>;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  onDropCustom: (e: React.DragEvent) => void;
  showNumericHint?: boolean;
}) {
  const t = useT();
  if (columns.length > 0) {
    return (
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {columns.map((c) => (
          <option key={c} value={c}>
            {c}
            {showNumericHint && columnTypes?.[c] !== "number" ? t.bindingEditor.notNumericSuffix : ""}
          </option>
        ))}
      </Select>
    );
  }
  return <Input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} onDragOver={allowDrop} onDrop={onDropCustom} />;
}

export function BindingEditor({ schema, binding, onChangeBinding, dataSources }: Props) {
  const t = useT();
  const [bindingDraft, setBindingDraft] = useState(() => {
    if (binding?.type === "template") return binding.template;
    if (binding?.type === "array") return binding.path;
    if (binding?.type === "section") return binding.path;
    if (binding?.type === "chart") return binding.path;
    if (binding?.type === "kpi") return binding.path;
    if (binding?.type === "scalar") return `{${binding.path}}`;
    return "";
  });
  const [colsDraft, setColsDraft] = useState(() => {
    if (binding?.type === "array") return stringifyColumns(binding.columns);
    if (binding?.type === "keyvalue") return binding.paths.join(", ");
    return "";
  });
  const [labelColumn, setLabelColumn] = useState(() => (binding?.type === "chart" ? binding.labelColumn : ""));
  const [valueColumn, setValueColumn] = useState(() =>
    binding?.type === "chart" ? binding.valueColumn : binding?.type === "kpi" ? (binding.valueColumn ?? "") : ""
  );
  const [kpiAggregation, setKpiAggregation] = useState<KpiAggregation>(() => (binding?.type === "kpi" ? binding.aggregation : "sum"));

  const tableMode = bindingDraft.trim() ? "array" : "keyvalue";
  const knownSources = dataSources && dataSources.length > 0 ? dataSources : null;

  function applyBinding({
    draft = bindingDraft,
    cols = colsDraft,
    label = labelColumn,
    value = valueColumn,
    aggregation = kpiAggregation,
  }: {
    draft?: string;
    cols?: string;
    label?: string;
    value?: string;
    aggregation?: KpiAggregation;
  } = {}) {
    let next: Binding | undefined;
    switch (schema.type) {
      case "section":
        next = buildSectionBinding(schema.name, draft);
        break;
      case "chart":
        next = buildChartBinding(schema.name, draft, label, value, binding);
        break;
      case "table":
        next = buildTableBinding(schema.name, draft, cols, binding);
        break;
      case "kpi":
        next = buildKpiBinding(schema.name, draft, value, aggregation, binding);
        break;
      default:
        next = buildTemplateBinding(schema.name, draft);
    }
    if (next) onChangeBinding(next);
  }

  function insertFunctionIntoBinding(snippet: string) {
    const next = bindingDraft ? `${bindingDraft} {${snippet}}` : `{${snippet}}`;
    setBindingDraft(next);
    applyBinding({ draft: next });
  }

  function insertFunctionAsColumn(snippet: string) {
    const entry = `${t.bindingEditor.newColumnPrefix}={${snippet}}`;
    const next = colsDraft ? `${colsDraft}, ${entry}` : entry;
    setColsDraft(next);
    applyBinding({ cols: next });
  }

  // Drag-and-drop do FieldTree externo para o input de valor
  function handleDropOnDraft(e: React.DragEvent) {
    const field = readDroppedField(e);
    if (!field) return;
    e.preventDefault();
    // Para seção/tabela/gráfico: insere o path do array (sem chaves)
    // Para texto: insere {path}
    let next: string;
    if (schema.type === "section" || schema.type === "table" || schema.type === "chart" || schema.type === "kpi") {
      next = field.kind === "arrayColumn" ? (field.sourcePath ?? field.path) : field.path;
    } else {
      next = bindingDraft
        ? `${bindingDraft} {${field.path}}`
        : `{${field.path}}`;
    }
    setBindingDraft(next);
    applyBinding({ draft: next });
  }

  function handleDropOnCols(e: React.DragEvent) {
    const field = readDroppedField(e);
    if (!field) return;
    e.preventDefault();
    const colName = field.kind === "arrayColumn" ? (field.column ?? field.path) : field.path;
    const next = colsDraft ? `${colsDraft}, ${colName}` : colName;
    setColsDraft(next);
    applyBinding({ cols: next });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-sky-300 bg-sky-50/40 p-2.5 dark:border-blue-700 dark:bg-blue-900/20">
      <span className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-gray-300">
        <IconLink className="text-sky-500 dark:text-blue-400" />
        {t.bindingEditor.title}
      </span>

      {schema.type === "section" ? (
        <>
          <Input
            placeholder={t.bindingEditor.sectionPlaceholder}
            value={bindingDraft}
            onChange={(e) => { setBindingDraft(e.target.value); applyBinding({ draft: e.target.value }); }}
            onDragOver={allowDrop}
            onDrop={handleDropOnDraft}
          />
          <p className="text-[10px] text-slate-400 dark:text-gray-400">{withInlineCode(t.bindingEditor.sectionHelp)}</p>
        </>
      ) : schema.type === "chart" ? (
        <>
          <DataSourcePicker
            knownSources={knownSources}
            value={bindingDraft}
            freePlaceholder={t.bindingEditor.chartPathPlaceholder}
            onSelect={(source) => {
              const newDraft = source.path;
              const numberCol = source.columns?.find((c) => source.columnTypes?.[c] === "number") ?? "";
              const textCol = source.columns?.find((c) => source.columnTypes?.[c] !== "number") ?? source.columns?.[0] ?? "";
              setBindingDraft(newDraft);
              setValueColumn(numberCol);
              setLabelColumn(textCol);
              applyBinding({ draft: newDraft, label: textCol, value: numberCol });
            }}
            onFreeChange={(v) => { setBindingDraft(v); applyBinding({ draft: v }); }}
            onDropFree={handleDropOnDraft}
          />
          {(() => {
            const source = knownSources?.find((d) => d.path === bindingDraft.trim());
            const columns = source?.columns ?? [];
            return (
              <div className="grid grid-cols-2 gap-2">
                <ColumnPicker
                  columns={columns}
                  columnTypes={source?.columnTypes}
                  value={labelColumn}
                  onChange={(v) => { setLabelColumn(v); applyBinding({ label: v }); }}
                  placeholder={columns.length > 0 ? t.bindingEditor.labelColumnPlaceholder : t.bindingEditor.labelColumnInputPlaceholder}
                  onDropCustom={(e) => { const f = readDroppedField(e); if (!f) return; e.preventDefault(); const col = f.kind === "arrayColumn" ? (f.column ?? f.path) : f.path; setLabelColumn(col); applyBinding({ label: col }); }}
                />
                <ColumnPicker
                  columns={columns}
                  columnTypes={source?.columnTypes}
                  value={valueColumn}
                  onChange={(v) => { setValueColumn(v); applyBinding({ value: v }); }}
                  placeholder={columns.length > 0 ? t.bindingEditor.valueColumnPlaceholder : t.bindingEditor.valueColumnInputPlaceholder}
                  onDropCustom={(e) => { const f = readDroppedField(e); if (!f) return; e.preventDefault(); const col = f.kind === "arrayColumn" ? (f.column ?? f.path) : f.path; setValueColumn(col); applyBinding({ value: col }); }}
                  showNumericHint
                />
              </div>
            );
          })()}
          <p className="text-[10px] text-slate-400 dark:text-gray-400">
            {t.bindingEditor.chartHelp(
              labelColumn || t.bindingEditor.chartHelpDefaultLabel,
              valueColumn || t.bindingEditor.chartHelpDefaultValue
            )}
          </p>
        </>
      ) : schema.type === "table" ? (
        <>
          <DataSourcePicker
            knownSources={knownSources}
            value={bindingDraft}
            freePlaceholder={t.bindingEditor.tablePathPlaceholderFree}
            onSelect={(source) => {
              const newDraft = source.path;
              const newCols = source.columns?.join(", ") ?? "";
              setBindingDraft(newDraft);
              setColsDraft(newCols);
              applyBinding({ draft: newDraft, cols: newCols });
            }}
            onFreeChange={(v) => { setBindingDraft(v); applyBinding({ draft: v }); }}
            onDropFree={handleDropOnDraft}
          />
          <p className="text-[10px] text-slate-400 dark:text-gray-400">
            {t.bindingEditor.modeLabel(tableMode === "array" ? t.bindingEditor.modeArray : t.bindingEditor.modeKeyValue)}
          </p>
          {schema.sectionId && tableMode === "array" && (
            <p className="text-[10px] text-slate-400 dark:text-gray-400">{t.bindingEditor.nestedHelp}</p>
          )}
          {!knownSources && (
            <>
              <Input
                mono
                placeholder={tableMode === "array" ? t.bindingEditor.colsArrayPlaceholder : t.bindingEditor.colsFreePlaceholder}
                value={colsDraft}
                onChange={(e) => { setColsDraft(e.target.value); applyBinding({ cols: e.target.value }); }}
                onDragOver={allowDrop}
                onDrop={handleDropOnCols}
              />
              {tableMode === "array" && (
                <Select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) insertFunctionAsColumn(e.target.value);
                  }}
                >
                  <option value="">{t.bindingEditor.insertCalculatedColumn}</option>
                  {CUSTOM_FIELD_FUNCTIONS.map((fn) => (
                    <option key={fn.name} value={t.fieldFunctionSnippets[fn.hintKey]} title={t.fieldFunctions[fn.hintKey]}>
                      {fn.name} — {t.fieldFunctions[fn.hintKey]}
                    </option>
                  ))}
                </Select>
              )}
            </>
          )}
        </>
      ) : schema.type === "kpi" ? (
        <>
          <DataSourcePicker
            knownSources={knownSources}
            value={bindingDraft}
            freePlaceholder={t.bindingEditor.kpiPathPlaceholder}
            onSelect={(source) => {
              const newDraft = source.path;
              const numberCol = source.columns?.find((c) => source.columnTypes?.[c] === "number") ?? "";
              setBindingDraft(newDraft);
              setValueColumn(numberCol);
              applyBinding({ draft: newDraft, value: numberCol });
            }}
            onFreeChange={(v) => { setBindingDraft(v); applyBinding({ draft: v }); }}
            onDropFree={handleDropOnDraft}
          />
          {(() => {
            const source = knownSources?.find((d) => d.path === bindingDraft.trim());
            const columns = source?.columns ?? [];
            return (
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={kpiAggregation}
                  onChange={(e) => {
                    const next = e.target.value as KpiAggregation;
                    setKpiAggregation(next);
                    applyBinding({ aggregation: next });
                  }}
                >
                  <option value="sum">{t.kpi.aggregationSum}</option>
                  <option value="count">{t.kpi.aggregationCount}</option>
                  <option value="avg">{t.kpi.aggregationAvg}</option>
                  <option value="min">{t.kpi.aggregationMin}</option>
                  <option value="max">{t.kpi.aggregationMax}</option>
                </Select>
                {kpiAggregation !== "count" && (
                  <ColumnPicker
                    columns={columns}
                    columnTypes={source?.columnTypes}
                    value={valueColumn}
                    onChange={(v) => { setValueColumn(v); applyBinding({ value: v }); }}
                    placeholder={columns.length > 0 ? t.bindingEditor.valueColumnPlaceholder : t.bindingEditor.valueColumnInputPlaceholder}
                    onDropCustom={(e) => { const f = readDroppedField(e); if (!f) return; e.preventDefault(); const col = f.kind === "arrayColumn" ? (f.column ?? f.path) : f.path; setValueColumn(col); applyBinding({ value: col }); }}
                    showNumericHint
                  />
                )}
              </div>
            );
          })()}
        </>
      ) : (
        <>
          <Input
            placeholder={t.bindingEditor.genericPlaceholder}
            value={bindingDraft}
            onChange={(e) => { setBindingDraft(e.target.value); applyBinding({ draft: e.target.value }); }}
            onDragOver={allowDrop}
            onDrop={handleDropOnDraft}
          />
          <Select
            value=""
            onChange={(e) => {
              if (e.target.value) insertFunctionIntoBinding(e.target.value);
            }}
          >
            <option value="">{t.bindingEditor.insertFunction}</option>
            {CUSTOM_FIELD_FUNCTIONS.map((fn) => (
              <option key={fn.name} value={t.fieldFunctionSnippets[fn.hintKey]} title={t.fieldFunctions[fn.hintKey]}>
                {fn.name} — {t.fieldFunctions[fn.hintKey]}
              </option>
            ))}
          </Select>
        </>
      )}

      {binding && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-500 dark:text-gray-400">{t.bindingEditor.boundLabel(describeBindingShort(binding, t))}</p>
          <Button variant="danger" onClick={() => onChangeBinding(null)}>
            {t.bindingEditor.removeBinding}
          </Button>
        </div>
      )}
    </div>
  );
}
