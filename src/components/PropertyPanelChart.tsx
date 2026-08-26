import type { ChartSchema } from "../types";
import { Input, Select } from "./ui";

type Props = {
  schema: ChartSchema;
  onChangeSchema: (patch: Partial<ChartSchema>) => void;
};

export function PropertyPanelChart({ schema, onChangeSchema }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <Select
        label="Tipo de gráfico"
        value={schema.chartType}
        onChange={(e) => onChangeSchema({ chartType: e.target.value as ChartSchema["chartType"] })}
      >
        <option value="pie">Pizza</option>
        <option value="bar">Barra</option>
      </Select>
      {schema.chartType === "pie" && (
        <Select
          label="Formato"
          value={schema.pieStyle ?? "donut"}
          onChange={(e) => onChangeSchema({ pieStyle: e.target.value as ChartSchema["pieStyle"] })}
        >
          <option value="donut">Rosca (com furo)</option>
          <option value="full">Pizza cheia</option>
        </Select>
      )}
      {schema.chartType === "pie" && (
        <Select
          label="Posição da legenda"
          value={schema.legendPosition ?? "right"}
          onChange={(e) => onChangeSchema({ legendPosition: e.target.value as ChartSchema["legendPosition"] })}
        >
          <option value="right">À direita</option>
          <option value="left">À esquerda</option>
          <option value="top">Em cima</option>
          <option value="bottom">Embaixo</option>
          <option value="slices">Em cima de cada fatia</option>
        </Select>
      )}
      <Select
        label="Exibir"
        value={schema.displayMode}
        onChange={(e) => onChangeSchema({ displayMode: e.target.value as ChartSchema["displayMode"] })}
      >
        <option value="percent">Porcentagem</option>
        <option value="number">Número (valor bruto)</option>
        <option value="both">Valor + porcentagem</option>
      </Select>
      <Select
        label="Ordenar por"
        value={schema.sortBy ?? "value_desc"}
        onChange={(e) => onChangeSchema({ sortBy: e.target.value as ChartSchema["sortBy"] })}
      >
        <option value="value_desc">Maior valor primeiro</option>
        <option value="value_asc">Menor valor primeiro</option>
        <option value="label_asc">Rótulo A → Z</option>
        <option value="label_desc">Rótulo Z → A</option>
      </Select>
      <Input
        label='Agrupar o resto em "Outros" a partir de N maiores (0 = não agrupar)'
        type="number"
        min={0}
        step={1}
        value={schema.topN ?? 7}
        onChange={(e) => onChangeSchema({ topN: Math.max(0, Math.trunc(Number(e.target.value)) || 0) })}
      />
    </div>
  );
}
