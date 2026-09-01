import { useState } from "react";
import type { Binding, DataSourceOption, TableColumnStyle, TableCornerRadii, TableSchema } from "../types";
import { useT, withInlineCode } from "../i18n";
import type { FieldSources } from "../designer/helpers";
import { TABLE_PALETTES, TABLE_PALETTE_GROUPS, type TableStylePresetName } from "../table/colors";
import { BindingEditor } from "./BindingEditor";
import { FormulaButton } from "./FormulaButton";
import { Button, ClearFieldButton, ColorInput, Input, PalettePicker, Select } from "./ui";
import { CollapsibleSection } from "./ui/CollapsibleSection";
import { IconDots, IconGrip, IconPlus, IconX } from "./ui/icons";
import type { PaletteGroup } from "./ui/PalettePicker";

type HAlign = "left" | "center" | "right";
type VAlign = "top" | "middle" | "bottom";
type CornerKey = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

// Par de selects (horizontal/vertical) — mesmo par pras 3 linhas
// (cabeçalho/corpo/rodapé), cada uma com seu próprio par de campos no
// schema (headAlign/headVerticalAlign etc).
function AlignSelects({
  align,
  vAlign,
  onAlign,
  onVAlign,
}: {
  align: HAlign;
  vAlign: VAlign;
  onAlign: (v: HAlign) => void;
  onVAlign: (v: VAlign) => void;
}) {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-2">
      <Select label={t.table.alignHorizontal} value={align} onChange={(e) => onAlign(e.target.value as HAlign)}>
        <option value="left">{t.table.alignLeft}</option>
        <option value="center">{t.table.alignCenter}</option>
        <option value="right">{t.table.alignRight}</option>
      </Select>
      <Select label={t.table.alignVertical} value={vAlign} onChange={(e) => onVAlign(e.target.value as VAlign)}>
        <option value="top">{t.table.alignTop}</option>
        <option value="middle">{t.table.alignMiddle}</option>
        <option value="bottom">{t.table.alignBottom}</option>
      </Select>
    </div>
  );
}

// Inputs de arredondamento — só os cantos passados em `corners` (cada
// bloco só recebe os que fazem sentido pra ELE, ver TableCornerRadii em
// types/schema.ts): cabeçalho = topo; rodapé = base; corpo = base, só
// quando NÃO há totais (ver `disabledHint` no caller).
function CornerInputs({
  radii,
  onChange,
  corners,
  disabledHint,
}: {
  radii: TableCornerRadii | undefined;
  onChange: (patch: Partial<TableCornerRadii>) => void;
  corners: CornerKey[];
  disabledHint?: string;
}) {
  const t = useT();
  const cornerLabel: Record<CornerKey, string> = {
    topLeft: t.table.cornerTopLeft,
    topRight: t.table.cornerTopRight,
    bottomLeft: t.table.cornerBottomLeft,
    bottomRight: t.table.cornerBottomRight,
  };
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-medium text-slate-500 dark:text-gray-400">{t.table.cornerRadius}</p>
      <div className="grid grid-cols-2 gap-2">
        {corners.map((c) => (
          <Input
            key={c}
            type="number"
            min={0}
            label={cornerLabel[c]}
            value={radii?.[c] ?? ""}
            placeholder="0"
            onChange={(e) => onChange({ [c]: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
        ))}
      </div>
      {disabledHint && <p className="text-[10px] text-slate-400 dark:text-gray-400">{disabledHint}</p>}
    </div>
  );
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
  onSetColumnWidth?: (index: number, widthMm: number | undefined) => void;
  // Campos que este schema alcança — a lista da esquerda do modal de
  // fórmula (ver designer/helpers.ts, fieldSourcesFor).
  fieldSources?: FieldSources;
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
  onSetColumnWidth,
  fieldSources,
}: Props) {
  const t = useT();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [styleColIndex, setStyleColIndex] = useState<number | null>(null);
  const bindingColumns = binding?.type === "array" ? binding.columns : null;

  // Uma célula da linha de totais — escrita pelo campo direto e pelo modal
  // de fórmula, daí a função em vez do handler inline.
  function setFooterCell(index: number, value: string) {
    const footer = (schema.footer ?? []).slice();
    footer[index] = value;
    onChangeSchema({ footer });
  }

  // Grupos Claro/Médio/Escuro (TABLE_PALETTE_GROUPS) traduzidos pro formato
  // genérico do PalettePicker — cada preset vira só as 3 cores mostradas nas
  // bolinhas (cabeçalho/faixa/borda), igual o TablePalettePicker local fazia.
  const tablePaletteGroupLabel: Record<string, string> = {
    light: t.table.paletteGroupLight,
    medium: t.table.paletteGroupMedium,
    dark: t.table.paletteGroupDark,
  };
  // "custom" não é um preset de TABLE_PALETTES — é o sinal pra usar as cores
  // manuais de sempre (inputs de Background/Text/Cor da faixa mais abaixo).
  // Entra como grupo próprio, sem rótulo (mesmo truque do chart: label ""
  // não desenha cabeçalho de grupo), na frente dos grupos Claro/Médio/Escuro.
  const tablePaletteGroups: PaletteGroup[] = [
    {
      label: "",
      items: [
        {
          name: "custom",
          colors: [schema.headBackgroundColor ?? "#0284c7", schema.bodyBandColor ?? "#f1f5f9", schema.borderColor ?? "#94a3b8"],
          label: t.table.paletteCustom,
        },
      ],
    },
    ...TABLE_PALETTE_GROUPS.map((group) => ({
      label: tablePaletteGroupLabel[group.label] ?? group.label,
      items: group.names.map((name) => {
        const preset = TABLE_PALETTES[name];
        return { name, colors: [preset.headBackgroundColor, preset.bandColor, preset.borderColor] };
      }),
    })),
  ];
  const currentTablePreset =
    schema.colorPalette && schema.colorPalette !== "custom" ? TABLE_PALETTES[schema.colorPalette as TableStylePresetName] : undefined;
  // Zebra é um interruptor à parte do preset — independe de qual paleta (ou
  // "custom") está ativa, só olha se já tem uma cor de faixa configurada.
  const zebraOn = Boolean(schema.bodyBandColor);

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
                  const bindingCol = bindingColumns?.[i];
                  const currentFormula = bindingCol && typeof bindingCol !== "string" ? bindingCol.formula : "";
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
                          <FormulaButton
                            active={Boolean(currentFormula)}
                            sources={fieldSources}
                            showDataType
                            target={{
                              label: t.formulaModal.columnTarget(col),
                              value: currentFormula,
                              pathPlaceholder: col,
                              onSave: (next) => onSetColumnFormula?.(i, next),
                            }}
                          />
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
                          <Input
                            label={t.table.columnWidth}
                            type="number"
                            min={10}
                            step={1}
                            value={schema.columnWidths?.[i] ?? ""}
                            placeholder={t.table.columnWidthAuto}
                            onChange={(e) =>
                              onSetColumnWidth?.(i, e.target.value === "" ? undefined : Number(e.target.value))
                            }
                          />
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
                          <ClearFieldButton
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
                            label={t.table.clearColumnStyle}
                            variant="text"
                          />
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
          <PalettePicker
            label={t.table.paletteLabel}
            currentName={schema.colorPalette ?? "custom"}
            currentColors={
              currentTablePreset
                ? [currentTablePreset.headBackgroundColor, currentTablePreset.bandColor, currentTablePreset.borderColor]
                : [schema.headBackgroundColor ?? "#0284c7", schema.bodyBandColor ?? "#f1f5f9", schema.borderColor ?? "#94a3b8"]
            }
            currentLabel={schema.colorPalette && schema.colorPalette !== "custom" ? schema.colorPalette : t.table.paletteCustom}
            onSelect={(name) => {
              if (name === "custom") {
                onChangeSchema({ colorPalette: "custom" });
                return;
              }
              const preset = TABLE_PALETTES[name as TableStylePresetName];
              onChangeSchema({
                colorPalette: name as TableStylePresetName,
                headBackgroundColor: preset.headBackgroundColor,
                headTextColor: preset.headTextColor,
                borderColor: preset.borderColor,
                // Zebra é um interruptor à parte (ver checkbox abaixo) — só
                // troca a cor da faixa se ela já estava ligada; escolher um
                // preset novo com zebra desligada continua sem listras.
                ...(zebraOn ? { bodyBandColor: preset.bandColor } : {}),
              });
            }}
            groups={tablePaletteGroups}
            variant="grid"
            swatchSize="h-3.5 w-3.5"
            swatchGap="gap-0.5"
            swatchShrink={false}
            staticArrow
          />
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={zebraOn}
              onChange={(e) =>
                onChangeSchema({
                  bodyBandColor: e.target.checked ? (currentTablePreset?.bandColor ?? schema.bodyBandColor ?? "#f1f5f9") : undefined,
                })
              }
            />
            {t.table.zebraStripes}
          </label>
          <ColorInput
            label={t.table.borderColor}
            value={schema.borderColor ?? "#94a3b8"}
            onChange={(e) => onChangeSchema({ borderColor: e.target.value })}
          />
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={schema.repeatHeader ?? true}
              onChange={(e) => onChangeSchema({ repeatHeader: e.target.checked })}
            />
            {t.table.repeatHeader}
          </label>
          <CollapsibleSection title={t.table.headerRow}>
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
            <AlignSelects
              align={schema.headAlign ?? "left"}
              vAlign={schema.headVerticalAlign ?? "middle"}
              onAlign={(headAlign) => onChangeSchema({ headAlign })}
              onVAlign={(headVerticalAlign) => onChangeSchema({ headVerticalAlign })}
            />
            <CornerInputs
              radii={schema.headBorderRadius}
              corners={["topLeft", "topRight"]}
              onChange={(patch) => onChangeSchema({ headBorderRadius: { ...schema.headBorderRadius, ...patch } })}
            />
          </CollapsibleSection>

          <CollapsibleSection title={t.table.bodyRow}>
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
            {zebraOn && (
              <ColorInput
                label={t.table.bandColor}
                value={schema.bodyBandColor ?? "#f1f5f9"}
                onChange={(e) => onChangeSchema({ bodyBandColor: e.target.value })}
              />
            )}
            <Input
              label={t.table.fontSize}
              type="number"
              step={0.5}
              value={schema.bodyFontSize ?? ""}
              placeholder="9"
              onChange={(e) => onChangeSchema({ bodyFontSize: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
            <AlignSelects
              align={schema.bodyAlign ?? "left"}
              vAlign={schema.bodyVerticalAlign ?? "middle"}
              onAlign={(bodyAlign) => onChangeSchema({ bodyAlign })}
              onVAlign={(bodyVerticalAlign) => onChangeSchema({ bodyVerticalAlign })}
            />
            <CornerInputs
              radii={schema.bodyBorderRadius}
              corners={schema.footer && schema.footer.length > 0 ? [] : ["bottomLeft", "bottomRight"]}
              disabledHint={schema.footer && schema.footer.length > 0 ? t.table.bodyBottomCornerDisabledHint : undefined}
              onChange={(patch) => onChangeSchema({ bodyBorderRadius: { ...schema.bodyBorderRadius, ...patch } })}
            />
          </CollapsibleSection>

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
              <details>
                <summary className="cursor-pointer select-none text-[10px] font-medium text-slate-500 dark:text-gray-400">
                  {t.table.totalsRow}
                </summary>
                <div className="mt-2 flex flex-col gap-1.5">
                  <p className="text-[10px] text-slate-400 dark:text-gray-400">{withInlineCode(t.table.footerHelp)}</p>
                  <div className="flex flex-col gap-1">
                    {schema.footer.map((cell, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <Input
                          className="flex-1"
                          mono
                          placeholder={schema.head[i] ?? t.table.footerCellPlaceholder(i + 1)}
                          value={cell}
                          onChange={(e) => setFooterCell(i, e.target.value)}
                        />
                        <FormulaButton
                          active={Boolean(cell)}
                          sources={fieldSources}
                          target={{
                            label: t.formulaModal.footerTarget(schema.head[i] ?? String(i + 1)),
                            value: cell,
                            onSave: (next) => setFooterCell(i, next),
                          }}
                        />
                      </div>
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
                  <AlignSelects
                    align={schema.footerAlign ?? "left"}
                    vAlign={schema.footerVerticalAlign ?? "middle"}
                    onAlign={(footerAlign) => onChangeSchema({ footerAlign })}
                    onVAlign={(footerVerticalAlign) => onChangeSchema({ footerVerticalAlign })}
                  />
                  <CornerInputs
                    radii={schema.footerBorderRadius}
                    corners={["bottomLeft", "bottomRight"]}
                    onChange={(patch) => onChangeSchema({ footerBorderRadius: { ...schema.footerBorderRadius, ...patch } })}
                  />
                </div>
              </details>
            )}
          </div>
        </>
      )}
    </>
  );
}
