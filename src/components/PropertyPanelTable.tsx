import { useState } from "react";
import type { Binding, DataSourceOption, TableColumnStyle, TableSchema } from "../types";
import { CUSTOM_FIELD_FUNCTIONS } from "../bindings/bindings";
import { splitDelimited } from "../bindings/splitDelimited";
import { useT, withInlineCode } from "../i18n";
import { BindingEditor } from "./BindingEditor";
import { Button, ColorInput, Input, Select } from "./ui";
import { IconDots, IconGrip, IconPlus, IconX } from "./ui/icons";

// Formula de coluna sem estado extra: tudo é derivado da PRÓPRIA string
// (parse) e reescrito nela (build) a cada troca do seletor "Tipo de dado"
// — só funciona pra um formato "limpo" (vazio, {path} nu, ou UMA chamada
// de função só, tipo {CURRENCY(preco, "R$", 2)}); fórmula com prefixo
// literal misturado (ex: "FAT-{fatura}") cai pra "raw" e só mostra o
// campo de texto livre de sempre — não dá pra decompor isso num seletor
// sem perder o prefixo.
type ParsedColumnFormula =
  | { kind: "empty" }
  | { kind: "bare"; path: string }
  | { kind: "func"; fn: string; path: string; symbol: string; decimals: string; outFormat: string; inFormat: string }
  | { kind: "raw" };

function unquote(s: string): string {
  const m = s.match(/^"(.*)"$/);
  return m ? m[1] : s;
}

function parseColumnFormula(formula: string): ParsedColumnFormula {
  const trimmed = formula.trim();
  if (!trimmed) return { kind: "empty" };
  const wrapped = trimmed.match(/^\{(.*)\}$/s);
  if (!wrapped) return { kind: "raw" };
  const inner = wrapped[1];
  const call = inner.match(/^([A-Za-z]+)\((.*)\)$/s);
  if (call) {
    const fn = call[1].toUpperCase();
    const args = splitDelimited(call[2]);
    return {
      kind: "func",
      fn,
      path: args[0] ?? "",
      symbol: fn === "CURRENCY" ? unquote(args[1] ?? "R$") : "",
      decimals: fn === "CURRENCY" ? args[2] ?? "2" : fn === "NUMBER" ? args[1] ?? "2" : "",
      outFormat: fn === "DATE" ? unquote(args[1] ?? "DD/MM/YYYY") : "",
      inFormat: fn === "DATE" ? unquote(args[2] ?? "") : "",
    };
  }
  if (/^[\w.]+$/.test(inner)) return { kind: "bare", path: inner };
  return { kind: "raw" };
}

function buildColumnFormula(fn: string, path: string, symbol: string, decimals: string, outFormat: string, inFormat: string): string {
  if (!path.trim()) return "";
  if (!fn) return `{${path.trim()}}`;
  if (fn === "CURRENCY") return `{CURRENCY(${path.trim()}, "${symbol || "R$"}", ${decimals || "2"})}`;
  if (fn === "NUMBER") return `{NUMBER(${path.trim()}, ${decimals || "2"})}`;
  if (fn === "DATE") return `{DATE(${path.trim()}, "${outFormat || "DD/MM/YYYY"}"${inFormat ? `, "${inFormat}"` : ""})}`;
  return `{${fn}(${path.trim()})}`;
}

type Props = {
  schema: TableSchema;
  binding: Binding | undefined;
  activeTab: "dados" | "estilo";
  onChangeSchema: (patch: Partial<TableSchema>) => void;
  onChangeBinding: (b: Binding | null) => void;
  dataSources?: DataSourceOption[];
  tableDataSource?: { path: string; columns: string[] };
  onSetHeadList?: (heads: string[]) => void;
  onAddTableColumn?: (column: string) => void;
  onRemoveTableColumn?: (index: number) => void;
  onReorderTableColumn?: (fromIndex: number, toIndex: number) => void;
  onSetColumnStyle?: (index: number, patch: Partial<TableColumnStyle>) => void;
  onSetColumnFormula?: (index: number, formula: string) => void;
};

export function PropertyPanelTable({
  schema,
  binding,
  activeTab,
  onChangeSchema,
  onChangeBinding,
  dataSources,
  tableDataSource,
  onSetHeadList,
  onAddTableColumn,
  onRemoveTableColumn,
  onReorderTableColumn,
  onSetColumnStyle,
  onSetColumnFormula,
}: Props) {
  const t = useT();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [styleColIndex, setStyleColIndex] = useState<number | null>(null);
  const [formulaColIndex, setFormulaColIndex] = useState<number | null>(null);
  const bindingColumns = binding?.type === "array" ? binding.columns : null;

  return (
    <>
      {activeTab === "dados" && (
        <>
          <Input
            label={t.table.columnsHeaderLabel}
            value={schema.head.join(", ")}
            onChange={(e) => {
              const heads = e.target.value.split(",").map((c) => c.trim()).filter(Boolean);
              if (onSetHeadList) onSetHeadList(heads);
              else onChangeSchema({ head: heads });
            }}
          />
          {schema.head.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-medium text-slate-500 dark:text-gray-400">{t.table.currentColumnsHint}</p>
              <ul className="flex flex-col gap-1">
                {schema.head.map((col, i) => {
                  const colStyle = schema.columnStyles?.[i];
                  const styleOpen = styleColIndex === i;
                  const formulaOpen = formulaColIndex === i;
                  const bindingCol = bindingColumns?.[i];
                  const currentFormula = bindingCol && typeof bindingCol !== "string" ? bindingCol.formula : "";
                  const parsedFormula = parseColumnFormula(currentFormula);
                  const formulaPath =
                    parsedFormula.kind === "func" || parsedFormula.kind === "bare"
                      ? parsedFormula.path
                      : typeof bindingCol === "string"
                        ? bindingCol
                        : "";
                  return (
                    <li key={`${col}-${i}`} className="flex flex-col gap-1">
                      <div
                        draggable
                        onDragStart={(e) => {
                          setDragIndex(i);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex !== null && dragIndex !== i) onReorderTableColumn?.(dragIndex, i);
                          setDragIndex(null);
                        }}
                        onDragEnd={() => setDragIndex(null)}
                        className={`flex cursor-grab items-center gap-1 rounded border border-slate-300 bg-slate-50 px-1.5 py-1 font-mono text-[10px] text-slate-600 active:cursor-grabbing dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 ${
                          dragIndex === i ? "opacity-40" : ""
                        }`}
                      >
                        <IconGrip className="text-slate-400" />
                        <span className="flex-1">{col}</span>
                        {bindingColumns && (
                          <button
                            type="button"
                            onClick={() => setFormulaColIndex(formulaOpen ? null : i)}
                            aria-label={t.table.formulaAria(col)}
                            title={t.table.formulaTitle}
                            className={`font-serif italic ${formulaOpen || currentFormula ? "text-sky-600 dark:text-blue-400" : "text-slate-400 hover:text-sky-600 dark:text-gray-400 dark:hover:text-blue-400"}`}
                          >
                            ƒx
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setStyleColIndex(styleOpen ? null : i)}
                          aria-label={t.table.styleAria(col)}
                          title={t.table.styleTitle}
                          className={styleOpen ? "text-sky-600 dark:text-blue-400" : "text-slate-400 hover:text-sky-600 dark:text-gray-400 dark:hover:text-blue-400"}
                        >
                          <IconDots />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveTableColumn?.(i)}
                          aria-label={t.table.removeColAria(col)}
                          title={t.table.removeColTitle}
                          className="text-slate-400 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                        >
                          <IconX />
                        </button>
                      </div>
                      {styleOpen && (
                        <div className="flex flex-col gap-2 rounded border border-sky-200 bg-sky-50/60 p-2 dark:border-blue-800 dark:bg-blue-900/20">
                          <div>
                            <p className="mb-1 text-[10px] font-medium text-slate-500 dark:text-gray-400">{t.table.header}</p>
                            <div className="grid grid-cols-2 gap-2">
                              <ColorInput
                                label={t.table.background}
                                value={colStyle?.headBackgroundColor ?? schema.headBackgroundColor ?? "#0284c7"}
                                onChange={(e) => onSetColumnStyle?.(i, { headBackgroundColor: e.target.value })}
                              />
                              <ColorInput
                                label={t.table.text}
                                value={colStyle?.headTextColor ?? schema.headTextColor ?? "#ffffff"}
                                onChange={(e) => onSetColumnStyle?.(i, { headTextColor: e.target.value })}
                              />
                            </div>
                            <Input
                              label={t.table.fontSize}
                              type="number"
                              step={0.5}
                              value={colStyle?.headFontSize ?? ""}
                              placeholder={String(schema.headFontSize ?? 9)}
                              onChange={(e) =>
                                onSetColumnStyle?.(i, { headFontSize: e.target.value === "" ? undefined : Number(e.target.value) })
                              }
                            />
                          </div>
                          <div>
                            <p className="mb-1 text-[10px] font-medium text-slate-500 dark:text-gray-400">{t.table.value}</p>
                            <div className="grid grid-cols-2 gap-2">
                              <ColorInput
                                label={t.table.background}
                                value={colStyle?.cellBackgroundColor ?? schema.bodyBackgroundColor ?? "#ffffff"}
                                onChange={(e) => onSetColumnStyle?.(i, { cellBackgroundColor: e.target.value })}
                              />
                              <ColorInput
                                label={t.table.text}
                                value={colStyle?.cellTextColor ?? schema.bodyTextColor ?? "#000000"}
                                onChange={(e) => onSetColumnStyle?.(i, { cellTextColor: e.target.value })}
                              />
                            </div>
                            <Input
                              label={t.table.fontSize}
                              type="number"
                              step={0.5}
                              value={colStyle?.cellFontSize ?? ""}
                              placeholder={String(schema.bodyFontSize ?? 9)}
                              onChange={(e) =>
                                onSetColumnStyle?.(i, { cellFontSize: e.target.value === "" ? undefined : Number(e.target.value) })
                              }
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              onSetColumnStyle?.(i, {
                                headBackgroundColor: undefined,
                                headTextColor: undefined,
                                headFontSize: undefined,
                                cellBackgroundColor: undefined,
                                cellTextColor: undefined,
                                cellFontSize: undefined,
                              })
                            }
                            className="self-start text-[10px] text-slate-400 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                          >
                            {t.table.clearColumnStyle}
                          </button>
                        </div>
                      )}
                      {formulaOpen && (
                        <div className="flex flex-col gap-2 rounded border border-sky-200 bg-sky-50/60 p-2 dark:border-blue-800 dark:bg-blue-900/20">
                          {parsedFormula.kind !== "raw" && (
                            <div className="flex flex-col gap-1.5 rounded border border-slate-200 bg-white p-1.5 dark:border-gray-600 dark:bg-gray-800">
                              <div className="grid grid-cols-2 gap-2">
                                <Select
                                  label={t.table.dataType}
                                  value={parsedFormula.kind === "func" ? parsedFormula.fn : ""}
                                  onChange={(e) => {
                                    const fn = e.target.value;
                                    const symbol = parsedFormula.kind === "func" ? parsedFormula.symbol : "R$";
                                    const decimals = parsedFormula.kind === "func" ? parsedFormula.decimals : "2";
                                    const outFormat = parsedFormula.kind === "func" ? parsedFormula.outFormat : "DD/MM/YYYY";
                                    const inFormat = parsedFormula.kind === "func" ? parsedFormula.inFormat : "";
                                    onSetColumnFormula?.(i, buildColumnFormula(fn, formulaPath, symbol, decimals, outFormat, inFormat));
                                  }}
                                >
                                  <option value="">{t.table.plainText}</option>
                                  <option value="NUMBER">{t.table.number}</option>
                                  <option value="CURRENCY">{t.table.currency}</option>
                                  <option value="DATE">{t.table.date}</option>
                                  <option value="UPPER">{t.table.uppercase}</option>
                                  <option value="LOWER">{t.table.lowercase}</option>
                                  <option value="TRIM">{t.table.trimEdges}</option>
                                </Select>
                                <Input
                                  label={t.table.fieldPath}
                                  mono
                                  placeholder={col}
                                  value={formulaPath}
                                  onChange={(e) => {
                                    const fn = parsedFormula.kind === "func" ? parsedFormula.fn : "";
                                    const symbol = parsedFormula.kind === "func" ? parsedFormula.symbol : "R$";
                                    const decimals = parsedFormula.kind === "func" ? parsedFormula.decimals : "2";
                                    const outFormat = parsedFormula.kind === "func" ? parsedFormula.outFormat : "DD/MM/YYYY";
                                    const inFormat = parsedFormula.kind === "func" ? parsedFormula.inFormat : "";
                                    onSetColumnFormula?.(i, buildColumnFormula(fn, e.target.value, symbol, decimals, outFormat, inFormat));
                                  }}
                                />
                              </div>
                              {parsedFormula.kind === "func" && parsedFormula.fn === "CURRENCY" && (
                                <div className="grid grid-cols-2 gap-2">
                                  <Input
                                    label={t.table.symbol}
                                    value={parsedFormula.symbol}
                                    onChange={(e) =>
                                      onSetColumnFormula?.(i, buildColumnFormula("CURRENCY", formulaPath, e.target.value, parsedFormula.decimals, "", ""))
                                    }
                                  />
                                  <Input
                                    label={t.table.decimalPlaces}
                                    type="number"
                                    min={0}
                                    value={parsedFormula.decimals}
                                    onChange={(e) =>
                                      onSetColumnFormula?.(i, buildColumnFormula("CURRENCY", formulaPath, parsedFormula.symbol, e.target.value, "", ""))
                                    }
                                  />
                                </div>
                              )}
                              {parsedFormula.kind === "func" && parsedFormula.fn === "NUMBER" && (
                                <Input
                                  label={t.table.decimalPlaces}
                                  type="number"
                                  min={0}
                                  value={parsedFormula.decimals}
                                  onChange={(e) => onSetColumnFormula?.(i, buildColumnFormula("NUMBER", formulaPath, "", e.target.value, "", ""))}
                                />
                              )}
                              {parsedFormula.kind === "func" && parsedFormula.fn === "DATE" && (
                                <div className="grid grid-cols-2 gap-2">
                                  <Input
                                    label={t.table.outputFormat}
                                    mono
                                    value={parsedFormula.outFormat}
                                    onChange={(e) =>
                                      onSetColumnFormula?.(i, buildColumnFormula("DATE", formulaPath, "", "", e.target.value, parsedFormula.inFormat))
                                    }
                                  />
                                  <Input
                                    label={t.table.inputFormat}
                                    mono
                                    placeholder={t.table.inputFormatPlaceholder}
                                    value={parsedFormula.inFormat}
                                    onChange={(e) =>
                                      onSetColumnFormula?.(i, buildColumnFormula("DATE", formulaPath, "", "", parsedFormula.outFormat, e.target.value))
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          )}
                          <p className="text-[10px] text-slate-400 dark:text-gray-400">{withInlineCode(t.table.formulaHelp)}</p>
                          <Input
                            mono
                            placeholder={col}
                            value={currentFormula}
                            onChange={(e) => onSetColumnFormula?.(i, e.target.value)}
                          />
                          <Select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) onSetColumnFormula?.(i, `${currentFormula}{${e.target.value}}`);
                            }}
                          >
                            <option value="">{t.table.insertFunction}</option>
                            {CUSTOM_FIELD_FUNCTIONS.map((fn) => (
                              <option key={fn.name} value={fn.snippet} title={t.fieldFunctions[fn.hintKey]}>
                                {fn.name} — {t.fieldFunctions[fn.hintKey]}
                              </option>
                            ))}
                          </Select>
                          {currentFormula && (
                            <button
                              type="button"
                              onClick={() => onSetColumnFormula?.(i, "")}
                              className="self-start text-[10px] text-slate-400 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
                            >
                              {t.table.clearFormula}
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {tableDataSource && (
            <div className="flex flex-col gap-1 rounded-lg border border-dashed border-purple-300 bg-purple-50/40 p-2 dark:border-purple-700 dark:bg-purple-900/20">
              <p className="text-[10px] font-medium text-purple-700 dark:text-purple-300">
                {t.table.fieldsFromSource(tableDataSource.path)}
              </p>
              <ul className="flex max-h-32 flex-col gap-0.5 overflow-y-auto">
                {tableDataSource.columns.map((col) => {
                  const already = schema.head.includes(col);
                  return (
                    <li
                      key={col}
                      className="flex items-center justify-between gap-1 rounded px-1 py-0.5 text-[11px] hover:bg-purple-100 dark:hover:bg-purple-900/40"
                    >
                      <span className={`font-mono ${already ? "text-slate-300 dark:text-gray-600" : "text-slate-600 dark:text-gray-300"}`}>{col}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={already}
                        onClick={() => onAddTableColumn?.(col)}
                        aria-label={t.table.addColumnAria(col)}
                        title={already ? t.table.alreadyColumn : t.table.addColumnTitle(col)}
                      >
                        <IconPlus />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <BindingEditor schema={schema} binding={binding} onChangeBinding={onChangeBinding} dataSources={dataSources} />
        </>
      )}

      {activeTab === "estilo" && (
        <>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={schema.repeatHeader ?? true}
              onChange={(e) => onChangeSchema({ repeatHeader: e.target.checked })}
            />
            {t.table.repeatHeader}
          </label>
          <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-slate-300 p-2 dark:border-gray-600">
            <p className="text-[10px] font-medium text-slate-500 dark:text-gray-400">{t.table.headerRow}</p>
            <div className="grid grid-cols-2 gap-2">
              <ColorInput
                label={t.table.background}
                value={schema.headBackgroundColor ?? "#0284c7"}
                onChange={(e) => onChangeSchema({ headBackgroundColor: e.target.value })}
              />
              <ColorInput
                label={t.table.text}
                value={schema.headTextColor ?? "#ffffff"}
                onChange={(e) => onChangeSchema({ headTextColor: e.target.value })}
              />
            </div>
            <Input
              label={t.table.fontSize}
              type="number"
              step={0.5}
              value={schema.headFontSize ?? ""}
              placeholder="9"
              onChange={(e) => onChangeSchema({ headFontSize: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </div>

          <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-slate-300 p-2 dark:border-gray-600">
            <p className="text-[10px] font-medium text-slate-500 dark:text-gray-400">{t.table.bodyRow}</p>
            <div className="grid grid-cols-2 gap-2">
              <ColorInput
                label={t.table.background}
                value={schema.bodyBackgroundColor ?? "#ffffff"}
                onChange={(e) => onChangeSchema({ bodyBackgroundColor: e.target.value })}
              />
              <ColorInput
                label={t.table.text}
                value={schema.bodyTextColor ?? "#000000"}
                onChange={(e) => onChangeSchema({ bodyTextColor: e.target.value })}
              />
            </div>
            <Input
              label={t.table.fontSize}
              type="number"
              step={0.5}
              value={schema.bodyFontSize ?? ""}
              placeholder="9"
              onChange={(e) => onChangeSchema({ bodyFontSize: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </div>

          <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-slate-300 p-2 dark:border-gray-600">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={Boolean(schema.footer && schema.footer.length > 0)}
                onChange={(e) => onChangeSchema({ footer: e.target.checked ? schema.head.map(() => "") : undefined })}
              />
              {t.table.totalsRow}
            </label>
            {schema.footer && schema.footer.length > 0 && (
              <>
                <p className="text-[10px] text-slate-400 dark:text-gray-400">{withInlineCode(t.table.footerHelp)}</p>
                <div className="flex flex-col gap-1">
                  {schema.footer.map((cell, i) => (
                    <Input
                      key={i}
                      mono
                      placeholder={schema.head[i] ?? t.table.footerCellPlaceholder(i + 1)}
                      value={cell}
                      onChange={(e) => {
                        const footer = schema.footer!.slice();
                        footer[i] = e.target.value;
                        onChangeSchema({ footer });
                      }}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <ColorInput
                    label={t.table.footerBackground}
                    value={schema.footerBackgroundColor ?? "#e5e7eb"}
                    onChange={(e) => onChangeSchema({ footerBackgroundColor: e.target.value })}
                  />
                  <ColorInput
                    label={t.table.footerText}
                    value={schema.footerTextColor ?? "#000000"}
                    onChange={(e) => onChangeSchema({ footerTextColor: e.target.value })}
                  />
                </div>
                <Input
                  label={t.table.fontSize}
                  type="number"
                  step={0.5}
                  value={schema.footerFontSize ?? ""}
                  placeholder="9"
                  onChange={(e) => onChangeSchema({ footerFontSize: e.target.value === "" ? undefined : Number(e.target.value) })}
                />
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
