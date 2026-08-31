import type { PDFDocument, PDFFont, PDFImage, PDFPage } from "pdf-lib";
import type { Binding, Schema } from "../../types";
import { aggregateChartItems, renderTemplate, resolveChartItems, resolveKpiValue } from "../../bindings/bindings";
import { resolveChartColors } from "../../chart/colors";
import { mmToPt } from "../../units";
import { resolveFooterRow, resolveTopLevelTableRows } from "../resolvers";
import { drawChart } from "./renderChart";
import { drawKpi } from "./renderKpi";
import { drawImageField } from "./renderImage";
import { drawTableSlice } from "./renderTable";
import { drawTextField } from "./renderText";

// O que drawFieldOfType precisa emprestado de renderPageDef (generate.ts)
// pra desenhar UM campo (texto/imagem/tabela repetida/gráfico/indicador) —
// extraído do que era um closure (drawField, dentro de renderPageDef) pra
// função de módulo, testável sem montar o resto do fluxo de desenho.
export type DrawFieldContext = {
  doc: PDFDocument;
  font: PDFFont;
  pageHeightPt: number;
  imageCache: Map<string, PDFImage>;
  bindings: Binding[];
  data: unknown;
  inputs: Record<string, string>;
};

// Desenha UM campo já resolvido (texto/imagem/tabela repetida/gráfico/
// indicador) — dispatcher por schema.type. "section" nunca chega aqui
// direto (ver renderSection.ts).
export async function drawFieldOfType(ctx: DrawFieldContext, page: PDFPage, schema: Schema, value: string | undefined): Promise<void> {
  const { doc, font, pageHeightPt, imageCache, bindings, data, inputs } = ctx;
  const xPt = mmToPt(schema.x);
  const widthPt = mmToPt(schema.width);
  const heightPt = mmToPt(schema.height);
  const yPt = pageHeightPt - mmToPt(schema.y) - heightPt;

  if (schema.type === "text") {
    drawTextField(page, font, schema, value, xPt, yPt, widthPt, heightPt);
    return;
  }

  if (schema.type === "image") {
    await drawImageField(doc, page, schema, imageCache, xPt, yPt, widthPt, heightPt);
    return;
  }

  if (schema.type === "table") {
    // Só cai aqui uma tabela repetida (header/footer/margem) — as do
    // corpo são tratadas à parte, no loop sequencial de generate.ts.
    const rows = resolveTopLevelTableRows(schema, bindings, data, inputs);
    const topYPt = pageHeightPt - mmToPt(schema.y);
    drawTableSlice(page, font, schema, rows, xPt, topYPt, widthPt, true, resolveFooterRow(schema, data));
    return;
  }

  // chart sem binding não desenha nada (nunca teve dado nenhum pra
  // mostrar), enquanto kpi sem binding cai pro template livre (abaixo) —
  // assimetria intencional, não esquecimento: KPI sempre tem título/
  // legenda pra mostrar mesmo sem vínculo (era o único modo antes do
  // vínculo "kpi" existir), chart sem array não tem o que desenhar.
  if (schema.type === "chart") {
    const binding = bindings.find(
      (b): b is Extract<Binding, { type: "chart" }> => b.schemaName === schema.name && b.type === "chart"
    );
    if (binding) {
      const raw = resolveChartItems(binding, data);
      const { items, total } = aggregateChartItems(raw, schema.topN ?? 7, schema.sortBy ?? "value_desc", resolveChartColors(schema.colorPalette, schema.customPaletteColors));
      drawChart(page, font, schema, items, total, xPt, yPt + heightPt, widthPt, heightPt);
    }
    return;
  }

  if (schema.type === "kpi") {
    const title = schema.title !== undefined ? renderTemplate(schema.title, data) : undefined;
    const kpiBinding = bindings.find(
      (b): b is Extract<Binding, { type: "kpi" }> => b.schemaName === schema.name && b.type === "kpi"
    );
    const value = kpiBinding
      ? String(resolveKpiValue(kpiBinding, data))
      : schema.value !== undefined
        ? renderTemplate(schema.value, data)
        : undefined;
    const subtitle = schema.subtitle !== undefined ? renderTemplate(schema.subtitle, data) : undefined;
    drawKpi(page, font, schema, title, value, subtitle, xPt, yPt, widthPt, heightPt);
  }

  // "section" nunca chega aqui direto — ver renderSection.ts.
}
