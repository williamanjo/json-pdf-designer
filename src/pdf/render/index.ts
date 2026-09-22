import type { PDFDocument, PDFFont, PDFImage, PDFPage } from "pdf-lib";
import type { Binding, Schema } from "../../types";
import { aggregateChartItems, renderTemplate, resolveChartItems, resolveKpiValue } from "../../bindings/bindings";
import { resolveChartColors } from "../../fields/chart/colors";
import { mmToPt } from "../../page/units";
import { resolveFooterRow, resolveTopLevelTableRows } from "../resolvers";
import { drawChart } from "./renderChart";
import { drawKpi } from "./renderKpi";
import { drawImageField } from "./renderImage";
import { drawTableSlice } from "./renderTable";
import { drawTextField } from "./renderText";
import { withGlyphContext } from "../textSafety";

// What drawFieldOfType needs to borrow from renderPageDef (generate.ts) to
// draw ONE field (text/image/repeated table/chart/kpi) — extracted from what
// was a closure (drawField, inside renderPageDef) into a module function,
// testable without assembling the rest of the drawing flow.
export type DrawFieldContext = {
  doc: PDFDocument;
  font: PDFFont;
  pageHeightPt: number;
  imageCache: Map<string, PDFImage>;
  bindings: Binding[];
  data: unknown;
  inputs: Record<string, string>;
};

// Draws ONE already-resolved field (text/image/repeated table/chart/kpi) — a
// dispatcher by schema.type. "section" never arrives here directly (see
// renderSection.ts).
export async function drawFieldOfType(ctx: DrawFieldContext, page: PDFPage, schema: Schema, value: string | undefined): Promise<void> {
  const { doc, font, pageHeightPt, imageCache, bindings, data, inputs } = ctx;
  const xPt = mmToPt(schema.x);
  const widthPt = mmToPt(schema.width);
  const heightPt = mmToPt(schema.height);
  const yPt = pageHeightPt - mmToPt(schema.y) - heightPt;

  if (schema.type === "text") {
    // `withGlyphContext` swaps pdf-lib's raw "WinAnsi cannot encode …" (which
    // does not say where) for an error that names the field and the character.
    withGlyphContext(schema.name, () => [value ?? schema.content], font, schema.fontSize, () =>
      drawTextField(page, font, schema, value, xPt, yPt, widthPt, heightPt)
    );
    return;
  }

  if (schema.type === "image") {
    // `value` (the resolved binding) takes priority over `schema.content` (the
    // design-time data URI). The render used to ignore the binding: the editor
    // offered to bind an image field to the JSON and the PDF always drew the
    // design image.
    await drawImageField(doc, page, schema, imageCache, xPt, yPt, widthPt, heightPt, value);
    return;
  }

  if (schema.type === "table") {
    // Only a repeated table (header/footer/margin) gets here — the body's are
    // handled separately, in generate.ts's sequential loop.
    const rows = resolveTopLevelTableRows(schema, bindings, data, inputs);
    const topYPt = pageHeightPt - mmToPt(schema.y);
    drawTableSlice(page, font, schema, rows, xPt, topYPt, widthPt, true, resolveFooterRow(schema, data));
    return;
  }

  // A chart with no binding draws nothing (it never had any data to show),
  // while a kpi with no binding falls back to the free template (below) — an
  // intentional asymmetry, not an oversight: a KPI always has a title/subtitle
  // to show even with no binding (it was the only mode before the "kpi"
  // binding existed), while a chart with no array has nothing to draw.
  if (schema.type === "chart") {
    const binding = bindings.find(
      (b): b is Extract<Binding, { type: "chart" }> => b.schemaName === schema.name && b.type === "chart"
    );
    if (binding) {
      const raw = resolveChartItems(binding, data);
      const { items, total } = aggregateChartItems(raw, schema.topN ?? 7, schema.sortBy ?? "value_desc", resolveChartColors(schema.colorPalette, schema.customPaletteColors));
      withGlyphContext(schema.name, () => items.map((i) => i.label), font, schema.legendFontSize ?? 9, () =>
        drawChart(page, font, schema, items, total, xPt, yPt + heightPt, widthPt, heightPt)
      );
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
    withGlyphContext(schema.name, () => [title, value, subtitle], font, schema.valueFontSize ?? 18, () =>
      drawKpi(page, font, schema, title, value, subtitle, xPt, yPt, widthPt, heightPt)
    );
  }

  // "section" never arrives here directly — see renderSection.ts.
}
