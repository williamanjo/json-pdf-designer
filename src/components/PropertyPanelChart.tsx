import { useState } from "react";
import type { Binding, ChartSchema, DataSourceOption } from "../types";
import { CHART_PALETTE_NAMES, CHART_PALETTE_SIZE, resolveChartColors, resolveChartPalette, type ChartPaletteName } from "../chartColors";
import { DEFAULT_CHART_LEGEND_FONT_SIZE } from "../chartFormat";
import { useT } from "../i18n";
import { BindingEditor } from "./BindingEditor";
import { BulkLocked, ColorInput, Input, Select } from "./ui";

type Props = {
  schema: ChartSchema;
  activeTab: "dados" | "estilo";
  bulkEdit?: boolean;
  onChangeSchema: (patch: Partial<ChartSchema>) => void;
  binding: Binding | undefined;
  onChangeBinding: (b: Binding | null) => void;
  dataSources?: DataSourceOption[];
};

// Uma fileira de bolinhas com as cores dadas — mesma ideia de um seletor
// de tema de cores pronto.
function PaletteSwatches({ colors, size = "h-4 w-4" }: { colors: readonly string[]; size?: string }) {
  return (
    <div className="flex gap-1">
      {colors.map((c, i) => (
        <span key={i} className={`${size} flex-shrink-0 rounded-full border border-black/10`} style={{ backgroundColor: c }} />
      ))}
    </div>
  );
}

// `<option>` nativo não dá pra estilizar com cor de fundo de forma
// confiável entre navegadores (o estado fechado do <select> é sempre texto
// puro do SO) — por isso um seletor próprio aqui, igual o IconPicker do
// KPI: botão mostra a paleta atual com as bolinhas, clique abre a lista
// com bolinhas + nome de cada uma; escolher fecha de novo. "Personalizada"
// (custom) revela `CHART_PALETTE_SIZE` seletores de cor abaixo da lista —
// cada um editável na hora, sem precisar abrir/fechar de novo.
function PalettePicker({
  value,
  customColors,
  onChangePalette,
  onChangeCustomColors,
}: {
  value: string;
  customColors: string[] | undefined;
  onChangePalette: (name: string) => void;
  onChangeCustomColors: (colors: string[]) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const current = CHART_PALETTE_NAMES.includes(value as (typeof CHART_PALETTE_NAMES)[number]) ? value : "default";
  const isCustom = current === "custom";
  const currentColors = resolveChartColors(current, customColors);
  // Cores editáveis de verdade — sempre CHART_PALETTE_SIZE posições, mesmo
  // que o usuário ainda não tenha escolhido nenhuma (começa do "default"
  // como ponto de partida, não de uma cor cinza sem graça repetida 7x).
  const editableColors = customColors && customColors.length > 0 ? customColors : resolveChartPalette("default").slice();

  function setColorAt(index: number, color: string) {
    const next = editableColors.slice();
    next[index] = color;
    onChangeCustomColors(next);
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-slate-600 dark:text-gray-300">{t.chart.paletteLabel}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:border-sky-400 dark:border-gray-600 dark:text-gray-200 dark:hover:border-blue-400"
      >
        <span className="flex items-center gap-2">
          <PaletteSwatches colors={currentColors} />
          {t.chartPaletteLabels[current as ChartPaletteName]}
        </span>
        <span className="text-slate-400 dark:text-gray-500">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 rounded-lg border border-slate-200 p-1 dark:border-gray-600">
          {CHART_PALETTE_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => { onChangePalette(name); setOpen(false); }}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-sky-50 dark:hover:bg-blue-400/10 ${
                name === current ? "bg-sky-50 dark:bg-blue-400/10" : ""
              }`}
            >
              <PaletteSwatches colors={name === "custom" ? editableColors : resolveChartPalette(name)} />
              <span className="text-slate-700 dark:text-gray-200">{t.chartPaletteLabels[name]}</span>
            </button>
          ))}
        </div>
      )}
      {isCustom && (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: CHART_PALETTE_SIZE }, (_, i) => (
            <ColorInput key={i} value={editableColors[i] ?? "#94a3b8"} onChange={(e) => setColorAt(i, e.target.value)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PropertyPanelChart({ schema, activeTab, bulkEdit, onChangeSchema, binding, onChangeBinding, dataSources }: Props) {
  const t = useT();
  const sortAndBinding = (
    <>
      <Select
        label={t.chart.sortBy}
        value={schema.sortBy ?? "value_desc"}
        onChange={(e) => onChangeSchema({ sortBy: e.target.value as ChartSchema["sortBy"] })}
      >
        <option value="value_desc">{t.chart.sortValueDesc}</option>
        <option value="value_asc">{t.chart.sortValueAsc}</option>
        <option value="label_asc">{t.chart.sortLabelAsc}</option>
        <option value="label_desc">{t.chart.sortLabelDesc}</option>
      </Select>
      <BindingEditor schema={schema} binding={binding} onChangeBinding={onChangeBinding} dataSources={dataSources} />
    </>
  );
  return (
    <div className="flex flex-col gap-2">
      {activeTab === "dados" && (
        <>
          <Input
            label={t.chart.groupOthers}
            type="number"
            min={0}
            step={1}
            value={schema.topN ?? 7}
            onChange={(e) => onChangeSchema({ topN: Math.max(0, Math.trunc(Number(e.target.value)) || 0) })}
          />
          <Select
            label={t.chart.thousandsSeparator}
            value={String(schema.thousandsSeparator ?? true)}
            onChange={(e) => onChangeSchema({ thousandsSeparator: e.target.value === "true" })}
          >
            <option value="true">{t.chart.thousandsSeparatorOn}</option>
            <option value="false">{t.chart.thousandsSeparatorOff}</option>
          </Select>
          {bulkEdit ? <BulkLocked hint={t.fieldsPanel.bulkDataLocked}>{sortAndBinding}</BulkLocked> : sortAndBinding}
        </>
      )}

      {activeTab === "estilo" && (
        <>
          <Select
            label={t.chart.chartType}
            value={schema.chartType}
            onChange={(e) => onChangeSchema({ chartType: e.target.value as ChartSchema["chartType"] })}
          >
            <option value="pie">{t.chart.pie}</option>
            <option value="bar">{t.chart.bar}</option>
          </Select>
          {schema.chartType === "pie" && (
            <Select
              label={t.chart.format}
              value={schema.pieStyle ?? "donut"}
              onChange={(e) => onChangeSchema({ pieStyle: e.target.value as ChartSchema["pieStyle"] })}
            >
              <option value="donut">{t.chart.donut}</option>
              <option value="full">{t.chart.fullPie}</option>
            </Select>
          )}
          {schema.chartType === "pie" && (
            <Select
              label={t.chart.legendPosition}
              value={schema.legendPosition ?? "right"}
              onChange={(e) => onChangeSchema({ legendPosition: e.target.value as ChartSchema["legendPosition"] })}
            >
              <option value="right">{t.chart.right}</option>
              <option value="left">{t.chart.left}</option>
              <option value="top">{t.chart.top}</option>
              <option value="bottom">{t.chart.bottom}</option>
              <option value="slices">{t.chart.onSlices}</option>
            </Select>
          )}
          {schema.chartType === "pie" && (
            <Input
              type="number"
              min={1}
              label={t.chart.legendFontSize}
              value={schema.legendFontSize ?? DEFAULT_CHART_LEGEND_FONT_SIZE}
              onChange={(e) => onChangeSchema({ legendFontSize: Number(e.target.value) })}
            />
          )}
          <PalettePicker
            value={schema.colorPalette ?? "default"}
            customColors={schema.customPaletteColors}
            onChangePalette={(colorPalette) => onChangeSchema({ colorPalette })}
            onChangeCustomColors={(customPaletteColors) => onChangeSchema({ colorPalette: "custom", customPaletteColors })}
          />
          <Select
            label={t.chart.display}
            value={schema.displayMode}
            onChange={(e) => onChangeSchema({ displayMode: e.target.value as ChartSchema["displayMode"] })}
          >
            <option value="percent">{t.chart.percent}</option>
            <option value="number">{t.chart.rawNumber}</option>
            <option value="both">{t.chart.valueAndPercent}</option>
          </Select>
          <Select
            label={t.chart.valueFormat}
            value={schema.valueFormat ?? "number"}
            onChange={(e) => onChangeSchema({ valueFormat: e.target.value as ChartSchema["valueFormat"] })}
          >
            <option value="number">{t.chart.numberFormat}</option>
            <option value="currency">{t.chart.currencyFormat}</option>
          </Select>
          {schema.valueFormat === "currency" && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                label={t.chart.symbol}
                value={schema.currencySymbol ?? "R$"}
                onChange={(e) => onChangeSchema({ currencySymbol: e.target.value })}
              />
              <Input
                label={t.chart.decimalPlaces}
                type="number"
                min={0}
                step={1}
                value={schema.decimals ?? 2}
                onChange={(e) => onChangeSchema({ decimals: Math.max(0, Math.trunc(Number(e.target.value)) || 0) })}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
