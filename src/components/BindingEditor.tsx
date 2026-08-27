import { useState } from "react";
import type { Binding, DataSourceOption, Schema } from "../types";
import { CUSTOM_FIELD_FUNCTIONS, describeBindingShort } from "../bindings/bindings";
import { parseColumnsInput, stringifyColumns } from "../bindings/columnParsing";
import { splitDelimited } from "../bindings/splitDelimited";
import { useT, withInlineCode } from "../i18n";
import { Button, Input, Select } from "./ui";
import { IconLink } from "./ui/icons";

type DroppedField = {
  path: string;
  kind: "scalar" | "arraySource" | "arrayColumn" | "native";
  sourcePath?: string;
  column?: string;
};

function readDroppedField(e: React.DragEvent): DroppedField | null {
  const raw = e.dataTransfer.getData("application/json");
  if (!raw) return null;
  try { return JSON.parse(raw) as DroppedField; } catch { return null; }
}

const allowDrop = (e: React.DragEvent) => {
  if (e.dataTransfer.types.includes("application/json")) e.preventDefault();
};

type Props = {
  schema: Schema;
  binding: Binding | undefined;
  onChangeBinding: (b: Binding | null) => void;
  dataSources?: DataSourceOption[];
};

export function BindingEditor({ schema, binding, onChangeBinding, dataSources }: Props) {
  const t = useT();
  const [bindingDraft, setBindingDraft] = useState(() => {
    if (binding?.type === "template") return binding.template;
    if (binding?.type === "array") return binding.path;
    if (binding?.type === "section") return binding.path;
    if (binding?.type === "chart") return binding.path;
    if (binding?.type === "scalar") return `{${binding.path}}`;
    return "";
  });
  const [colsDraft, setColsDraft] = useState(() => {
    if (binding?.type === "array") return stringifyColumns(binding.columns);
    if (binding?.type === "keyvalue") return binding.paths.join(", ");
    return "";
  });
  const [labelColumn, setLabelColumn] = useState(() => (binding?.type === "chart" ? binding.labelColumn : ""));
  const [valueColumn, setValueColumn] = useState(() => (binding?.type === "chart" ? binding.valueColumn : ""));

  const tableMode = bindingDraft.trim() ? "array" : "keyvalue";
  const knownSources = dataSources && dataSources.length > 0 ? dataSources : null;

  function applyBinding({
    draft = bindingDraft,
    cols = colsDraft,
    label = labelColumn,
    value = valueColumn,
  }: {
    draft?: string;
    cols?: string;
    label?: string;
    value?: string;
  } = {}) {
    if (schema.type === "section") {
      if (!draft.trim()) return;
      onChangeBinding({ schemaName: schema.name, type: "section", path: draft.trim() });
      return;
    }
    if (schema.type === "chart") {
      if (!draft.trim() || !label || !value) return;
      // Filtro (aba própria "Filtro" no painel do gráfico, ver
      // PropertyPanelChart.tsx) não é editado aqui — só preserva o que já
      // tava salvo quando o resto do vínculo muda (fonte/coluna).
      onChangeBinding({
        schemaName: schema.name,
        type: "chart",
        path: draft.trim(),
        labelColumn: label,
        valueColumn: value,
        filters: binding?.type === "chart" ? binding.filters : undefined,
      });
      return;
    }
    if (schema.type === "table") {
      const path = draft.trim();
      if (path) {
        const columns = parseColumnsInput(cols);
        if (columns.length === 0) return;
        onChangeBinding({ schemaName: schema.name, type: "array", path, columns });
      } else {
        const paths = splitDelimited(cols);
        if (paths.length === 0) return;
        onChangeBinding({ schemaName: schema.name, type: "keyvalue", paths });
      }
      return;
    }
    if (!draft.trim()) return;
    onChangeBinding({ schemaName: schema.name, type: "template", template: draft });
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
    if (schema.type === "section" || schema.type === "table" || schema.type === "chart") {
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
          {knownSources ? (
            <Select
              value={knownSources.some((d) => d.path === bindingDraft.trim()) ? bindingDraft.trim() : ""}
              onChange={(e) => {
                const source = knownSources.find((d) => d.path === e.target.value);
                if (!source) return;
                const newDraft = source.path;
                const numberCol = source.columns?.find((c) => source.columnTypes?.[c] === "number") ?? "";
                const textCol = source.columns?.find((c) => source.columnTypes?.[c] !== "number") ?? source.columns?.[0] ?? "";
                setBindingDraft(newDraft);
                setValueColumn(numberCol);
                setLabelColumn(textCol);
                applyBinding({ draft: newDraft, label: textCol, value: numberCol });
              }}
            >
              <option value="">{t.bindingEditor.dataSourcePlaceholder}</option>
              {knownSources.map((d) => (
                <option key={d.path} value={d.path}>
                  {d.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              placeholder={t.bindingEditor.chartPathPlaceholder}
              value={bindingDraft}
              onChange={(e) => { setBindingDraft(e.target.value); applyBinding({ draft: e.target.value }); }}
              onDragOver={allowDrop}
              onDrop={handleDropOnDraft}
            />
          )}
          {(() => {
            const source = knownSources?.find((d) => d.path === bindingDraft.trim());
            const columns = source?.columns ?? [];
            return (
              <div className="grid grid-cols-2 gap-2">
                  {columns.length > 0 ? (
                    <Select
                      value={labelColumn}
                      onChange={(e) => {
                        setLabelColumn(e.target.value);
                        applyBinding({ label: e.target.value });
                      }}
                    >
                      <option value="">{t.bindingEditor.labelColumnPlaceholder}</option>
                      {columns.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      placeholder={t.bindingEditor.labelColumnInputPlaceholder}
                      value={labelColumn}
                      onChange={(e) => { setLabelColumn(e.target.value); applyBinding({ label: e.target.value }); }}
                      onDragOver={allowDrop}
                      onDrop={(e) => { const f = readDroppedField(e); if (!f) return; e.preventDefault(); const col = f.kind === "arrayColumn" ? (f.column ?? f.path) : f.path; setLabelColumn(col); applyBinding({ label: col }); }}
                    />
                  )}
                  {columns.length > 0 ? (
                    <Select
                      value={valueColumn}
                      onChange={(e) => {
                        setValueColumn(e.target.value);
                        applyBinding({ value: e.target.value });
                      }}
                    >
                      <option value="">{t.bindingEditor.valueColumnPlaceholder}</option>
                      {columns.map((c) => (
                        <option key={c} value={c}>
                          {c}
                          {source?.columnTypes?.[c] === "number" ? "" : t.bindingEditor.notNumericSuffix}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      placeholder={t.bindingEditor.valueColumnInputPlaceholder}
                      value={valueColumn}
                      onChange={(e) => { setValueColumn(e.target.value); applyBinding({ value: e.target.value }); }}
                      onDragOver={allowDrop}
                      onDrop={(e) => { const f = readDroppedField(e); if (!f) return; e.preventDefault(); const col = f.kind === "arrayColumn" ? (f.column ?? f.path) : f.path; setValueColumn(col); applyBinding({ value: col }); }}
                    />
                  )}
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
          {knownSources ? (
            <Select
              value={knownSources.some((d) => d.path === bindingDraft.trim()) ? bindingDraft.trim() : ""}
              onChange={(e) => {
                const source = knownSources.find((d) => d.path === e.target.value);
                if (!source) return;
                const newDraft = source.path;
                const newCols = source.columns?.join(", ") ?? "";
                setBindingDraft(newDraft);
                setColsDraft(newCols);
                applyBinding({ draft: newDraft, cols: newCols });
              }}
            >
              <option value="">{t.bindingEditor.dataSourcePlaceholder}</option>
              {knownSources.map((d) => (
                <option key={d.path} value={d.path}>
                  {d.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              placeholder={t.bindingEditor.tablePathPlaceholderFree}
              value={bindingDraft}
              onChange={(e) => { setBindingDraft(e.target.value); applyBinding({ draft: e.target.value }); }}
              onDragOver={allowDrop}
              onDrop={handleDropOnDraft}
            />
          )}
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
                    <option key={fn.name} value={fn.snippet} title={t.fieldFunctions[fn.hintKey]}>
                      {fn.name} — {t.fieldFunctions[fn.hintKey]}
                    </option>
                  ))}
                </Select>
              )}
            </>
          )}
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
              <option key={fn.name} value={fn.snippet} title={t.fieldFunctions[fn.hintKey]}>
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
