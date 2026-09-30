// An alternative entrypoint for whoever only wants to generate a PDF in the
// backend (Node) — generatePdf(template, data, bindings) runs on top of plain
// pdf-lib, with no DOM/browser dependency at all. `.` (index.ts) re-exports
// ALL of this plus the Designer/PdfPreview/PdfPreviewModal/UI components
// (React) — since it all comes out of the SAME compiled module, importing only
// `generatePdf` from `.` still loads `react`/`react-dom` as a peer dep. This
// file mirrors only the React-free subset of `./index.ts`, so that whoever
// imports "json-pdf-designer/server" never has to install react/react-dom.
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
} from "./fields/chart/colors";
export {
  MATERIAL_ICON_GRID,
  MATERIAL_ICON_PATHS,
  MATERIAL_ICON_LABELS,
  MATERIAL_ICON_NAMES,
  materialIconLabels,
  type MaterialIconName,
} from "./materialIcons";
// downloadPdf is left out (it uses document/Blob — browser-only).
export { generatePdf, type GeneratePdfOptions } from "./pdf/generate";
export { migrateTemplate, CURRENT_TEMPLATE_VERSION } from "./template";

// TABLE COLUMN, with no React involved.
//
// `tokenFor` is the single rule for "how a key becomes a token", and
// `normalizeTableColumns` converts a raw-key column into `{label, formula}` in
// an already-saved template+bindings. They leave from here, and not only from
// the main entry, because normalizing an existing corpus is backend/script
// work as much as editor work — and neither of the two touches React.
export { segmentFor, tokenFor } from "./fields/table/columnFormula";
export { normalizeTableColumns } from "./fields/table/normalizeColumns";
// Generation errors: `error.message` is ENGLISH (a developer diagnostic — the
// log, the stack, Sentry), every failure is a CLASS with structured data and a
// string-literal `code`, and `describePdfError(err, dictFor(locale))` gives the
// localized end-user text. See the long comment in src/index.ts and the docs:
// "Failure modes".
//
// Everything here is the SAME module as the main entry — `src/errors.ts`
// imports only the `Dict` type and the expression hierarchy, no React and no
// pdf-lib, which is what lets the localizer ship in the /server build.
export {
  describePdfError,
  isPdfError,
  PdfGenerationError,
  PDF_ERROR_CODES,
  PageLimitError,
  UnsupportedGlyphError,
  PaginationStalledError,
  InvalidPageSizeError,
  Woff2SupportMissingError,
  FontDecompressFailedError,
  FontDecompressTimeoutError,
  ImageUploadTooLargeError,
  ImageUploadUnreadableError,
  ImageTooLargeError,
  TooManyImagesError,
  UnsupportedImageFormatError,
  ImageUnreadableError,
  BackgroundImageUnreadableError,
  TemplateNotAnObjectError,
  TemplateVersionInvalidError,
  TemplateVersionTooNewError,
  TemplateMigrationMissingError,
  type AnyPdfError,
  type ImageUploadFailureReason,
  type PdfErrorBlame,
  type PdfErrorCode,
  type PdfProblem,
  type PdfProblemCode,
} from "./errors";
export { DEFAULT_MAX_PAGES } from "./pdf/layout/layoutDocument";
export { ExpressionError, ExpressionSyntaxError, ExpressionDepthError } from "./expressions/errors";


// Expression validation — a backend uses this to refuse a template with an
// invalid expression BEFORE saving, instead of finding out at generation time
// (when the field already comes out empty, see expressions/resolve.ts).
export { expressionError, templateExpressionErrors } from "./expressions/resolve";
export { suspiciousOperator, templateSuspiciousOperators } from "./expressions/suspicious";
export { ALL_SUGGESTIONS, applySuggestion, insertAtCaret, suggestAt, wordAtCaret } from "./expressions/suggest";
export type { Suggestion } from "./expressions/suggest";
export { braceError, tokenAtCaret } from "./expressions/templateText";
export type { TokenSpan } from "./expressions/templateText";
export { expressionErrors } from "./fieldWarnings";
// The dictionary as a value, to call fieldWarning outside a React component.
export { dictFor } from "./i18n/dictionaries";
export type { SchemaExpressionError } from "./expressions/schemaExpressions";
export { makeChartSchema, makeKpiSchema, makeSectionColumnPair } from "./schemaFactory";
export type { Locale, Dict } from "./i18n";
export { mmToPx, pxToMm, mmToPt } from "./page/units";
export { PAGE_SIZE_PRESETS, orientationOf, applyOrientation, matchPreset, type Orientation } from "./page/sizes";
export { classifyZone, isRedZone, clampToZone, type Zone, type Bands } from "./page/zones";
export { normalizeFontBytes } from "./pdf/fontUtils";
