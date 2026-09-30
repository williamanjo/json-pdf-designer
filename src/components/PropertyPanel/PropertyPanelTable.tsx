import { useCallback, useState } from "react";
import { columnFormulaFor } from "../../fields/table/columnFormula";
import type { Binding, DataSourceOption, TableColumnStyle, TableCornerRadii, TableSchema } from "../../types";
import { useT, withInlineCode } from "../../i18n";
import type { FieldSources } from "../../designer/helpers";
import { TABLE_PALETTES, TABLE_PALETTE_GROUPS, type TableStylePresetName } from "../../fields/table/colors";
import { BindingEditor } from "../BindingEditor";
import { FormulaButton } from "../formula/FormulaButton";
import { ClearFieldButton, PalettePicker } from "../ui";
import { useUiComponents } from "../ui/useUiComponents";
import { CollapsibleSection } from "../ui/CollapsibleSection";
import { IconDots, IconGrip, IconPencil, IconPlus, IconX } from "../ui/icons";
import type { PaletteGroup } from "../ui/PalettePicker";

type HAlign = "left" | "center" | "right";
type VAlign = "top" | "middle" | "bottom";
type CornerKey = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

// A pair of selects (horizontal/vertical) — the same pair for all 3 rows
// (header/body/footer), each with its own pair of fields in the schema
// (headAlign/headVerticalAlign and so on).
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
  const { Select } = useUiComponents();
  return (
    <div className="jpd-grid2">
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

// Rounding inputs — only the corners passed in `corners` (each block
// receives only the ones that make sense for IT, see TableCornerRadii in
// types/schema.ts): header = top; footer = bottom; body = bottom, only
// when there are NO totals (see `disabledHint` in the caller).
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
  const { Input } = useUiComponents();
  const cornerLabel: Record<CornerKey, string> = {
    topLeft: t.table.cornerTopLeft,
    topRight: t.table.cornerTopRight,
    bottomLeft: t.table.cornerBottomLeft,
    bottomRight: t.table.cornerBottomRight,
  };
  return (
    <div className="jpd-stack jpd-stack--tight">
      <p className="jpd-grouplabel">{t.table.cornerRadius}</p>
      <div className="jpd-grid2">
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
      {disabledHint && <p className="jpd-hint">{disabledHint}</p>}
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
  // KEPT for compatibility, and this panel no longer uses it: the
  // "Columns (header, comma)" field is gone, and the title is now edited per
  // column (`onRenameTableColumn`). Anyone rendering this component directly
  // and passing `onSetHeadList` does not break — they simply see no effect,
  // because no control rewrites the whole list any more.
  onSetHeadList?: (heads: string[]) => void;
  onAddTableColumn?: (column: string) => void;
  onRemoveTableColumn?: (index: number) => void;
  onReorderTableColumn?: (fromIndex: number, toIndex: number) => void;
  onSetColumnStyle?: (index: number, patch: Partial<TableColumnStyle>) => void;
  onSetColumnFormula?: (index: number, formula: string) => void;
  // Rename ONE column (the pencil button, or a double click on the chip).
  // Only the label changes; the data reference stays.
  onRenameTableColumn?: (index: number, label: string) => void;
  onSetColumnWidth?: (index: number, widthMm: number | undefined) => void;
  // The fields this schema can reach — the left-hand list of the formula
  // modal (see designer/helpers.ts, fieldSourcesFor).
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
  onAddTableColumn,
  onRemoveTableColumn,
  onReorderTableColumn,
  onSetColumnStyle,
  onSetColumnFormula,
  onRenameTableColumn,
  onSetColumnWidth,
  fieldSources,
}: Props) {
  const t = useT();
  const { Button, Checkbox, ColorInput, Input } = useUiComponents();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Which column has its title in edit mode (pencil button or double click).
  const [renameIndex, setRenameIndex] = useState<number | null>(null);
  // Selects the text on mount, by REF and not through `onFocus`.
  // With the pencil button as the main path the caret lands at the END, and
  // typing APPENDS to the current name ("PNR" + whatever is typed) — seen in
  // the browser. And `onFocus` does NOT fix it: the `autoFocus` focus happens
  // at commit, before the handler is resolvable, so it never fires (measured:
  // selectionStart and selectionEnd both sat at the end). The ref runs on
  // mount, and has to be stable — an inline arrow would change identity on
  // every render and re-select the text on every keystroke.
  const selecionarAoAbrir = useCallback((el: HTMLInputElement | null) => el?.select(), []);
  const [styleColIndex, setStyleColIndex] = useState<number | null>(null);
  const bindingColumns = binding?.type === "array" ? binding.columns : null;

  // One cell of the totals row — written both by the field itself and by the
  // formula modal, hence a function instead of an inline handler.
  function setFooterCell(index: number, value: string) {
    const footer = (schema.footer ?? []).slice();
    footer[index] = value;
    onChangeSchema({ footer });
  }

  // The Light/Medium/Dark groups (TABLE_PALETTE_GROUPS) translated into the
  // generic PalettePicker format — each preset becomes just the 3 colors shown
  // in the dots (header/band/border), as the local TablePalettePicker did.
  const tablePaletteGroupLabel: Record<string, string> = {
    light: t.table.paletteGroupLight,
    medium: t.table.paletteGroupMedium,
    dark: t.table.paletteGroupDark,
  };
  // "custom" is not a TABLE_PALETTES preset — it is the signal to use the
  // usual manual colors (the Background/Text/Band color inputs further down).
  // It comes in as its own group, with no label (same trick as the chart:
  // a "" label draws no group header), ahead of the Light/Medium/Dark groups.
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
  // Banding is a switch separate from the preset — it does not care which
  // palette (or "custom") is active, it only looks at whether a band color exists.
  const zebraOn = Boolean(schema.bodyBandColor);

  return (
    <>
      {activeTab === "dados" && (
        <>
          {/* The "Columns (header, comma)" field that used to live here is GONE.
              It caused the rename bug: it replaced the whole `head` on every
              keystroke, and `setTableHead` re-derived every slot by matching
              the new name against the old head — a renamed name is not in the
              old head, so the column lost its token, its style and its width.
              The title is now edited with a double click on the chip, which is
              the "keep the reference, change only the label" operation.

              The `setTableHead` action and the `onSetHeadList` prop still
              exist and are still exported (they are public API) — they merely
              lost their internal call site. */}
          {schema.head.length > 0 && (
            <div className="jpd-stack jpd-stack--tight">
              <p className="jpd-grouplabel">{t.table.currentColumnsHint}</p>
              <ul className="jpd-list jpd-stack jpd-stack--tight">
                {schema.head.map((col, i) => {
                  const colStyle = schema.columnStyles?.[i];
                  const styleOpen = styleColIndex === i;
                  // The SAME precedence as the PDF (see columnFormulaFor). This
                  // used to read only `binding.columns[i]`, and only when it
                  // was an object — so in a table bound by data source, whose
                  // `columns[i]` is a raw string, the editor opened empty
                  // while `content[0][i]` already held the token the PDF used.
                  const currentFormula = columnFormulaFor(schema.content, bindingColumns, i);
                  const editing = renameIndex === i;
                  return (
                    <li key={`${col}-${i}`} className="jpd-stack jpd-stack--tight">
                      <div
                        // Arrastar desligado enquanto o input está aberto:
                        // senão selecionar texto com o mouse inicia
                        // reordenação de coluna.
                        draggable={!editing}
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
                        className="jpd-chip jpd-chip--drag"
                        data-dragging={dragIndex === i || undefined}
                      >
                        <IconGrip className="jpd-chip__grip" />
                        {editing ? (
                          // Mesmo padrão do rename inline do FieldList:
                          // `autoFocus`, commit no blur e no Enter, cancela no
                          // Escape. Rótulo vazio é ignorado pelo
                          // `renameColumnInTable` — o campo de vírgula antigo
                          // fazia `filter(Boolean)` na lista toda, então apagar
                          // o nome no meio da digitação colapsava a tabela.
                          <input
                            autoFocus
                            className="jpd-chip__input"
                            defaultValue={col}
                            aria-label={t.table.renameColumnAria(col)}
                            ref={selecionarAoAbrir}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => {
                              onRenameTableColumn?.(i, e.target.value);
                              setRenameIndex(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                              if (e.key === "Escape") {
                                // Limpa antes de sair do foco pra o `onBlur`
                                // não commitar o que foi digitado.
                                setRenameIndex(null);
                              }
                            }}
                          />
                        ) : (
                          <span
                            className="jpd-chip__label"
                            title={t.table.renameColumnTitle}
                            onDoubleClick={() => setRenameIndex(i)}
                          >
                            {col}
                          </span>
                        )}
                        {/* O duplo clique acima continua, mas ele é gesto de
                            MOUSE: num `<span>` sem tabIndex, quem navega por
                            teclado não tinha operação nenhuma — e a 3.2.0
                            tinha removido o campo "Colunas (cabeçalho,
                            vírgula)", que era a única via por tecla. Este
                            botão é a via focável, ao lado das outras três
                            (ƒx, estilo, remover), e por isso é um <button> de
                            verdade e não um div clicável. */}
                        {!editing && (
                          <button
                            type="button"
                            onClick={() => setRenameIndex(i)}
                            aria-label={t.table.renameColumnAria(col)}
                            title={t.table.renameColumnTitle}
                            className="jpd-iconbtn"
                          >
                            <IconPencil className="jpd-icon" />
                          </button>
                        )}
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
                          className="jpd-iconbtn jpd-iconbtn--accent"
                          data-on={styleOpen || undefined}
                        >
                          <IconDots className="jpd-icon" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveTableColumn?.(i)}
                          aria-label={t.table.removeColAria(col)}
                          title={t.table.removeColTitle}
                          className="jpd-iconbtn jpd-iconbtn--danger"
                        >
                          <IconX className="jpd-icon" />
                        </button>
                      </div>
                      {styleOpen && (
                        <div className="jpd-stack jpd-callout jpd-callout--solid" data-tone="sky">
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
                            <p className="jpd-grouplabel jpd-grouplabel--spaced">{t.table.header}</p>
                            <div className="jpd-grid2">
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
                            <p className="jpd-grouplabel jpd-grouplabel--spaced">{t.table.value}</p>
                            <div className="jpd-grid2">
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
            <div className="jpd-stack jpd-stack--tight jpd-callout" data-tone="purple">
              <p className="jpd-callout__title">
                {t.table.fieldsFromSource(tableDataSource.path)}
              </p>
              <ul className="jpd-list jpd-callout__list">
                {tableDataSource.columns.map((col) => {
                  const already = schema.head.includes(col);
                  return (
                    <li
                      key={col}
                      className="jpd-callout__item"
                    >
                      <span className="jpd-colname" data-added={already || undefined}>{col}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={already}
                        onClick={() => onAddTableColumn?.(col)}
                        aria-label={t.table.addColumnAria(col)}
                        title={already ? t.table.alreadyColumn : t.table.addColumnTitle(col)}
                      >
                        <IconPlus className="jpd-icon" />
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
          />
          <Checkbox
            label={t.table.zebraStripes}
            checked={zebraOn}
            onChange={(e) =>
              onChangeSchema({
                bodyBandColor: e.target.checked ? (currentTablePreset?.bandColor ?? schema.bodyBandColor ?? "#f1f5f9") : undefined,
              })
            }
          />
          <ColorInput
            label={t.table.borderColor}
            value={schema.borderColor ?? "#94a3b8"}
            onChange={(e) => onChangeSchema({ borderColor: e.target.value })}
          />
          <Checkbox
            label={t.table.repeatHeader}
            checked={schema.repeatHeader ?? true}
            onChange={(e) => onChangeSchema({ repeatHeader: e.target.checked })}
          />
          <CollapsibleSection title={t.table.headerRow}>
            <div className="jpd-grid2">
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
            <div className="jpd-grid2">
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

          <div className="jpd-stack jpd-stack--snug jpd-callout" data-tone="slate">
            <Checkbox
              label={t.table.totalsRow}
              checked={Boolean(schema.footer && schema.footer.length > 0)}
              onChange={(e) => onChangeSchema({ footer: e.target.checked ? schema.head.map(() => "") : undefined })}
            />
            {/* NÃO é <CollapsibleSection>: o <details> aqui é NU de
                propósito — a caixa tracejada que o componente desenha já vem
                do `.jpd-callout` do <div> acima, e embrulhar de novo
                aninharia duas molduras. Só as classes de summary/body são
                reusadas, que é o que faz o visual bater byte a byte. */}
            {schema.footer && schema.footer.length > 0 && (
              <details>
                <summary className="jpd-disclosure__summary">
                  {t.table.totalsRow}
                </summary>
                <div className="jpd-disclosure__body">
                  <p className="jpd-hint">{withInlineCode(t.table.footerHelp)}</p>
                  <div className="jpd-stack jpd-stack--tight">
                    {schema.footer.map((cell, i) => (
                      <div key={i} className="jpd-row jpd-row--tight jpd-row--grow">
                        <Input
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
                  <div className="jpd-grid2">
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
