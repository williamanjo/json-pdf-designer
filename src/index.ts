// server.ts espelha um SUBCONJUNTO destas listas (tudo aqui exceto o que é
// browser/React-only — downloadPdf, componentes, i18n provider). Mantido à
// mão em paralelo nos dois arquivos: adicionar um export aqui que também
// devia existir no server (não-React) precisa da mesma mudança lá.
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
export { generatePdf, downloadPdf, type GeneratePdfOptions } from "./pdf/generate";
export { migrateTemplate, CURRENT_TEMPLATE_VERSION } from "./template/migrate";
// Erros de geração, como classes — pra quem chama poder distinguir sem casar
// mensagem: um backend responde 413 pra PageLimitError e 400 pra
// UnsupportedGlyphError, por exemplo. Ver docs: "Modos de falha".
export { PageLimitError, DEFAULT_MAX_PAGES } from "./pdf/layout/layoutDocument";
export { UnsupportedGlyphError } from "./pdf/textSafety";
export { ExpressionError, ExpressionSyntaxError, ExpressionDepthError } from "./expressions/errors";

// Validação de expressão — pra quem monta a própria UI e quer apontar o erro
// como o <Designer> aponta. A GERAÇÃO é tolerante de propósito (expressão
// inválida vira campo vazio, não derruba o PDF), então sem isto o problema
// ficaria invisível. Ver docs: "Visibilidade condicional".
export { expressionError, templateExpressionErrors } from "./expressions/resolve";
export { suspiciousOperator, templateSuspiciousOperators } from "./expressions/suspicious";
export { ALL_SUGGESTIONS, applySuggestion, insertAtCaret, suggestAt, wordAtCaret } from "./expressions/suggest";
export type { Suggestion } from "./expressions/suggest";
export { braceError, tokenAtCaret } from "./expressions/templateText";
export type { TokenSpan } from "./expressions/templateText";
export { fieldWarning, expressionErrors, filterIncomplete } from "./fieldWarnings";
// Dicionário como valor, pra chamar fieldWarning fora de um componente React.
export { dictFor } from "./i18n/dictionaries";
export type { SchemaExpressionError } from "./expressions/schemaExpressions";

export { makeChartSchema, makeKpiSchema, makeSectionColumnPair } from "./schemaFactory";
export { I18nProvider, useT, useLocale, withInlineCode, type Locale, type Dict } from "./i18n";
export { mmToPx, pxToMm, mmToPt } from "./units";
export { PAGE_SIZE_PRESETS, orientationOf, applyOrientation, matchPreset, type Orientation } from "./pageSizes";
export { classifyZone, isRedZone, clampToZone, type Zone, type Bands } from "./zones";
export { normalizeFontBytes } from "./pdf/fontUtils";
export { default as Designer } from "./designer/Designer";
// PdfPreview/PdfPreviewModal/configurePdfWorker NÃO saem daqui — moram em
// "json-pdf-designer/preview" (ver src/preview.ts), porque dependem do
// pdfjs-dist, que é peer OPCIONAL. Re-exportar qualquer um deles aqui faria
// todo consumidor desta entry precisar do pdf.js instalado outra vez, mesmo
// quem só usa <Designer>.

// Componentes de UI prontos (Tailwind, mesmo estilo usado pelo próprio
// Designer/PropertyPanel) — pra quem não quer/consegue montar a própria UI
// em volta do <Designer>, dá pra usar exatamente esses blocos.
export {
  Button,
  Card,
  CardHeader,
  CardTitle,
  Badge,
  TabPanel,
  Modal,
  Input,
  ColorInput,
  Textarea,
  Select,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
  IconX,
  IconTrash,
  IconGrip,
  IconLink,
  IconMinus,
  IconArrowsHorizontal,
  IconArrowsVertical,
  IconDots,
  IconUpload,
  IconLock,
  IconLockOpen,
  IconBringToFront,
  IconSendToBack,
  IconRefresh,
  IconDownload,
  IconFolderUp,
  IconAlertTriangle,
} from "./components/ui";
