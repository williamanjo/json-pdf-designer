export type {
  PageSize,
  BaseSchema,
  TextSchema,
  TableSchema,
  TableColumnStyle,
  ImageSchema,
  SectionSchema,
  ChartSchema,
  KpiSchema,
  KpiIcon,
  Schema,
  Template,
  TableColumn,
  Binding,
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
  aggregateChartItems,
  type ChartItem,
  type ChartSortBy,
  CUSTOM_FIELD_FUNCTIONS,
} from "./bindings/bindings";

export { CHART_COLORS, CHART_OTHER_COLOR } from "./chartColors";
export {
  MATERIAL_ICON_GRID,
  MATERIAL_ICON_PATHS,
  MATERIAL_ICON_LABELS,
  MATERIAL_ICON_NAMES,
  type MaterialIconName,
} from "./materialIcons";
export { generatePdf, downloadPdf, type GeneratePdfOptions } from "./pdf/generate";
export { makeChartSchema, makeKpiSchema, makeSectionColumnPair } from "./schemaFactory";
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
} from "./components/ui";
