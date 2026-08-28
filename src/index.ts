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
} from "./chartColors";
export {
  MATERIAL_ICON_GRID,
  MATERIAL_ICON_PATHS,
  MATERIAL_ICON_LABELS,
  MATERIAL_ICON_NAMES,
  materialIconLabels,
  type MaterialIconName,
} from "./materialIcons";
export { generatePdf, downloadPdf, type GeneratePdfOptions } from "./pdf/generate";
export { makeChartSchema, makeKpiSchema, makeSectionColumnPair } from "./schemaFactory";
export { I18nProvider, useT, useLocale, withInlineCode, type Locale, type Dict } from "./i18n";
export { mmToPx, pxToMm, mmToPt } from "./units";
export { PAGE_SIZE_PRESETS, orientationOf, applyOrientation, matchPreset, type Orientation } from "./pageSizes";
export { classifyZone, isRedZone, clampToZone, type Zone, type Bands } from "./zones";
export { normalizeFontBytes } from "./pdf/fontUtils";
export { default as Designer } from "./Designer";
export { PdfPreview } from "./components/PdfPreview";
export { configurePdfWorker } from "./pdf/pdfWorker";
export { default as PdfPreviewModal } from "./components/PdfPreviewModal";

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
  Input,
  ColorInput,
  Textarea,
  Select,
  IconPlus,
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
