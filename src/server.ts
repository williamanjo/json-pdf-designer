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
} from "./fields/chart/colors";
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
export { migrateTemplate, CURRENT_TEMPLATE_VERSION } from "./template";

// COLUNA DE TABELA, sem React envolvido.
//
// `tokenFor` é a única regra de "como uma chave vira token", e
// `normalizeTableColumns` converte coluna de chave crua em `{label, formula}`
// num template+bindings já salvos. Saem daqui, e não só do entry principal,
// porque normalizar acervo é trabalho de backend/script tanto quanto de
// editor — e nenhuma das duas toca em React.
export { segmentFor, tokenFor } from "./fields/table/columnFormula";
export { normalizeTableColumns } from "./fields/table/normalizeColumns";
// Erros de geração: `error.message` é INGLÊS (diagnóstico de desenvolvedor —
// log, stack, Sentry), toda falha é uma CLASSE com dados estruturados e um
// `code` de string literal, e `describePdfError(err, dictFor(locale))` dá o
// texto de usuário final localizado. Ver o comentário longo em src/index.ts e
// docs: "Modos de falha".
//
// Tudo daqui é o MESMO módulo do entry principal — `src/errors.ts` importa só
// o tipo `Dict` e a hierarquia de expressão, nada de React nem de pdf-lib, que
// é o que deixa o localizador sair no build /server.
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
export { mmToPx, pxToMm, mmToPt } from "./page/units";
export { PAGE_SIZE_PRESETS, orientationOf, applyOrientation, matchPreset, type Orientation } from "./page/sizes";
export { classifyZone, isRedZone, clampToZone, type Zone, type Bands } from "./page/zones";
export { normalizeFontBytes } from "./pdf/fontUtils";
