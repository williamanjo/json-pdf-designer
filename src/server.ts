// Entrypoint alternativo pra quem só quer gerar PDF no backend (Node) —
// generatePdf(template, data, bindings) roda em cima de pdf-lib puro, sem
// nenhuma dependência de DOM/browser. `.` (index.ts) reexporta TUDO isso
// mais o Designer/PdfPreview/PdfPreviewModal/componentes de UI (React) —
// como tudo sai do MESMO módulo compilado, importar só `generatePdf` de
// `.` ainda carrega `react`/`react-dom` como peer dep. Esse arquivo espelha
// só o subconjunto sem React de `./index.ts`, pra quem importa
// "json-pdf-designer/server" nunca precisar instalar react/react-dom.
export type {
  PageSize,
  BaseSchema,
  TextSchema,
  TableSchema,
  TableColumnStyle,
  TableCornerRadii,
  ImageSchema,
  SectionSchema,
  ChartSchema,
  KpiSchema,
  KpiIcon,
  Schema,
  Template,
  TemplatePage,
  TemplateVersion,
  TableColumn,
  Binding,
  KpiAggregation,
  DataSourceOption,
  DataSourceColumnType,
  SectionColumnDragPayload,
} from "./types";

export {
  columnLabel,
  columnKey,
  describeBinding,
  describeBindingShort,
  resolveToken,
  renderTemplate,
  buildInputs,
  rowsFromArrayBinding,
  resolveChartItems,
  resolveKpiValue,
  aggregateChartItems,
  type ChartItem,
  type ChartSortBy,
  CUSTOM_FIELD_FUNCTIONS,
} from "./bindings/bindings";

export {
  CHART_COLORS,
  CHART_OTHER_COLOR,
  CHART_PALETTES,
  CHART_PALETTE_LABELS,
  CHART_PALETTE_NAMES,
  CHART_PALETTE_SIZE,
  resolveChartPalette,
  resolveChartColors,
  type ChartPaletteName,
  type ChartPresetName,
} from "./chart/colors";
export {
  MATERIAL_ICON_GRID,
  MATERIAL_ICON_PATHS,
  MATERIAL_ICON_LABELS,
  MATERIAL_ICON_NAMES,
  materialIconLabels,
  type MaterialIconName,
} from "./materialIcons";
// downloadPdf fica de fora (usa document/Blob — só faz sentido no browser).
export { generatePdf, type GeneratePdfOptions } from "./pdf/generate";
export { migrateTemplate, CURRENT_TEMPLATE_VERSION } from "./template/migrate";
// Erros de geração, como classes — pra quem chama poder distinguir sem casar
// mensagem: um backend responde 413 pra PageLimitError e 400 pra
// UnsupportedGlyphError, por exemplo. Ver docs: "Modos de falha".
export { PageLimitError, DEFAULT_MAX_PAGES } from "./pdf/layout/layoutDocument";
export { UnsupportedGlyphError } from "./pdf/textSafety";
export { ExpressionError, ExpressionSyntaxError, ExpressionDepthError } from "./expressions/errors";


// Validação de expressão — um backend usa isto pra recusar um template com
// expressão inválida ANTES de salvar, em vez de descobrir na hora de gerar
// (quando o campo já sai vazio, ver expressions/resolve.ts).
export { expressionError, templateExpressionErrors } from "./expressions/resolve";
export { suspiciousOperator, templateSuspiciousOperators } from "./expressions/suspicious";
export { ALL_SUGGESTIONS, applySuggestion, insertAtCaret, suggestAt, wordAtCaret } from "./expressions/suggest";
export type { Suggestion } from "./expressions/suggest";
export { braceError, tokenAtCaret } from "./expressions/templateText";
export type { TokenSpan } from "./expressions/templateText";
export { expressionErrors } from "./fieldWarnings";
// Dicionário como valor, pra chamar fieldWarning fora de um componente React.
export { dictFor } from "./i18n/dictionaries";
export type { SchemaExpressionError } from "./expressions/schemaExpressions";
export { makeChartSchema, makeKpiSchema, makeSectionColumnPair } from "./schemaFactory";
export type { Locale, Dict } from "./i18n";
export { mmToPx, pxToMm, mmToPt } from "./units";
export { PAGE_SIZE_PRESETS, orientationOf, applyOrientation, matchPreset, type Orientation } from "./pageSizes";
export { classifyZone, isRedZone, clampToZone, type Zone, type Bands } from "./zones";
export { normalizeFontBytes } from "./pdf/fontUtils";
