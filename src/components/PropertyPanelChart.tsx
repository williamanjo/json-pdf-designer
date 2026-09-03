import type { Binding, ChartSchema, DataSourceOption } from "../types";
import { CHART_PALETTE_NAMES, CHART_PALETTE_SIZE, resolveChartColors, resolveChartPalette, type ChartPaletteName } from "../chart/colors";
import { DEFAULT_CHART_LEGEND_FONT_SIZE } from "../chart/format";
import { useT } from "../i18n";
import { BindingEditor } from "./BindingEditor";
import { BulkLocked, PalettePicker } from "./ui";
import { useUiComponents } from "./ui/useUiComponents";

type Props = {
  schema: ChartSchema;
  activeTab: "dados" | "estilo";
  bulkEdit?: boolean;
  onChangeSchema: (patch: Partial<ChartSchema>) => void;
  binding: Binding | undefined;
  onChangeBinding: (b: Binding | null) => void;
  dataSources?: DataSourceOption[];
};

export function PropertyPanelChart({ schema, activeTab, bulkEdit, onChangeSchema, binding, onChangeBinding, dataSources }: Props) {
  const t = useT();
  const { ColorInput, Input, Select } = useUiComponents();
  // Paleta de cores do gráfico: mesma lógica que o PalettePicker local
  // deste arquivo tinha antes de virar o componente genérico em
  // ./ui/PalettePicker — só que agora calculada aqui pra alimentar as
  // props dele (currentName/currentColors/currentLabel/groups) e pro
  // bloco de cores customizadas abaixo (que fica fora do componente
  // genérico, pois é comportamento específico do gráfico).
  const paletteValue = schema.colorPalette ?? "default";
  const currentPalette = CHART_PALETTE_NAMES.includes(paletteValue as (typeof CHART_PALETTE_NAMES)[number]) ? paletteValue : "default";
  const isCustomPalette = currentPalette === "custom";
  const currentPaletteColors = resolveChartColors(currentPalette, schema.customPaletteColors);
  // Cores editáveis de verdade — sempre CHART_PALETTE_SIZE posições, mesmo
  // que o usuário ainda não tenha escolhido nenhuma (começa do "default"
  // como ponto de partida, não de uma cor cinza sem graça repetida 7x).
  const editablePaletteColors =
    schema.customPaletteColors && schema.customPaletteColors.length > 0 ? schema.customPaletteColors : resolveChartPalette("default").slice();

  function setPaletteColorAt(index: number, color: string) {
    const next = editablePaletteColors.slice();
    next[index] = color;
    onChangeSchema({ colorPalette: "custom", customPaletteColors: next });
  }

  const paletteControls = (
    <>
      <PalettePicker
        label={t.chart.paletteLabel}
        currentName={currentPalette}
        currentColors={[...currentPaletteColors]}
        currentLabel={t.chartPaletteLabels[currentPalette as ChartPaletteName]}
        onSelect={(colorPalette) => onChangeSchema({ colorPalette })}
        groups={[
          {
            label: "",
            items: CHART_PALETTE_NAMES.map((name) => ({
              name,
              colors: name === "custom" ? editablePaletteColors : [...resolveChartPalette(name)],
              label: t.chartPaletteLabels[name],
            })),
          },
        ]}
      />
      {isCustomPalette && (
        <div className="jpd-colorgrid">
          {Array.from({ length: CHART_PALETTE_SIZE }, (_, i) => (
            <ColorInput key={i} value={editablePaletteColors[i] ?? "#94a3b8"} onChange={(e) => setPaletteColorAt(i, e.target.value)} />
          ))}
        </div>
      )}
    </>
  );
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
    <div className="jpd-stack">
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
          {paletteControls}
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
            <div className="jpd-grid2">
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
