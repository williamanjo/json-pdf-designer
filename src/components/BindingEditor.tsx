import { useState } from "react";
import type { Binding, DataSourceOption, Schema } from "../types";
import { CUSTOM_FIELD_FUNCTIONS, describeBindingShort } from "../bindings/bindings";
import { parseColumnsInput, stringifyColumns } from "../bindings/columnParsing";
import { splitDelimited } from "../bindings/splitDelimited";
import { Button, Input, Select } from "./ui";
import { IconLink } from "./ui/icons";

type Props = {
  schema: Schema;
  binding: Binding | undefined;
  onChangeBinding: (b: Binding | null) => void;
  dataSources?: DataSourceOption[];
};

export function BindingEditor({ schema, binding, onChangeBinding, dataSources }: Props) {
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
      onChangeBinding({ schemaName: schema.name, type: "chart", path: draft.trim(), labelColumn: label, valueColumn: value });
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
    const entry = `Nova coluna={${snippet}}`;
    const next = colsDraft ? `${colsDraft}, ${entry}` : entry;
    setColsDraft(next);
    applyBinding({ cols: next });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-sky-300 bg-sky-50/40 p-2.5">
      <span className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
        <IconLink className="text-sky-500" />
        Vínculo com o JSON
      </span>

      {schema.type === "section" ? (
        <>
          <Input
            placeholder="path do array a repetir — ex: Services"
            value={bindingDraft}
            onChange={(e) => {
              setBindingDraft(e.target.value);
              applyBinding({ draft: e.target.value });
            }}
          />
          <p className="text-[10px] text-slate-400">
            A seção inteira repete uma vez por item deste array. Dentro
            dela, o vínculo de cada campo é resolvido contra o ITEM atual
            (não o documento todo) — use <code>{"{campo}"}</code> direto,
            ou <code>{"{Line}"}</code> pro número da repetição (1, 2, 3...).
          </p>
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
              <option value="">Data Source — escolha um array do JSON</option>
              {knownSources.map((d) => (
                <option key={d.path} value={d.path}>
                  {d.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              placeholder="path do array — ex: agentes"
              value={bindingDraft}
              onChange={(e) => {
                setBindingDraft(e.target.value);
                applyBinding({ draft: e.target.value });
              }}
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
                    <option value="">Coluna do rótulo</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    placeholder="coluna do rótulo — ex: label"
                    value={labelColumn}
                    onChange={(e) => {
                      setLabelColumn(e.target.value);
                      applyBinding({ label: e.target.value });
                    }}
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
                    <option value="">Coluna numérica</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                        {source?.columnTypes?.[c] === "number" ? "" : " (não-numérica)"}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    placeholder="coluna numérica — ex: value"
                    value={valueColumn}
                    onChange={(e) => {
                      setValueColumn(e.target.value);
                      applyBinding({ value: e.target.value });
                    }}
                  />
                )}
              </div>
            );
          })()}
          <p className="text-[10px] text-slate-400">
            O gráfico agrupa os itens desse array por <strong>{labelColumn || "rótulo"}</strong>, somando{" "}
            <strong>{valueColumn || "a coluna numérica"}</strong> — os maiores viram fatias/barras próprias, o resto
            vira "Outros" (ver painel de estilo pra trocar quantos).
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
              <option value="">Data Source — escolha um array do JSON</option>
              {knownSources.map((d) => (
                <option key={d.path} value={d.path}>
                  {d.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              placeholder="path do array — ex: rows (vazio = modo chave/valor)"
              value={bindingDraft}
              onChange={(e) => {
                setBindingDraft(e.target.value);
                applyBinding({ draft: e.target.value });
              }}
            />
          )}
          <p className="text-[10px] text-slate-400">
            Modo: <strong>{tableMode === "array" ? "array (1 linha por item)" : "chave/valor"}</strong>
          </p>
          {schema.sectionId && tableMode === "array" && (
            <p className="text-[10px] text-slate-400">
              Dentro de uma seção — mestre-detalhe: o path acima é resolvido contra o ITEM atual da seção (não o
              documento inteiro), e a seção cresce de altura pra caber as linhas de cada registro.
            </p>
          )}
          {!knownSources && (
            <>
              <Input
                mono
                placeholder={
                  tableMode === "array"
                    ? 'colunas do item — ex: id, nome, Total (R$)={CURRENCY(total_amount, "R$")}'
                    : "paths soltos do JSON — ex: pagination.page, pagination.total"
                }
                value={colsDraft}
                onChange={(e) => {
                  setColsDraft(e.target.value);
                  applyBinding({ cols: e.target.value });
                }}
              />
              {tableMode === "array" && (
                <Select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) insertFunctionAsColumn(e.target.value);
                  }}
                >
                  <option value="">+ inserir coluna calculada</option>
                  {CUSTOM_FIELD_FUNCTIONS.map((fn) => (
                    <option key={fn.name} value={fn.snippet} title={fn.hint}>
                      {fn.name} — {fn.hint}
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
            placeholder='path ou {FUNÇÃO(...)} — ex: {CURRENCY(total, "R$")}'
            value={bindingDraft}
            onChange={(e) => {
              setBindingDraft(e.target.value);
              applyBinding({ draft: e.target.value });
            }}
          />
          <Select
            value=""
            onChange={(e) => {
              if (e.target.value) insertFunctionIntoBinding(e.target.value);
            }}
          >
            <option value="">+ inserir função</option>
            {CUSTOM_FIELD_FUNCTIONS.map((fn) => (
              <option key={fn.name} value={fn.snippet} title={fn.hint}>
                {fn.name} — {fn.hint}
              </option>
            ))}
          </Select>
        </>
      )}

      {binding && (
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-500">Vinculado: {describeBindingShort(binding)}</p>
          <Button variant="danger" onClick={() => onChangeBinding(null)}>
            Remover vínculo
          </Button>
        </div>
      )}
    </div>
  );
}
