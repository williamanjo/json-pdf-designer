// server.ts mirrors a SUBSET of these lists (everything here except what is
// browser/React-only — downloadPdf, the components, the i18n provider). Kept
// by hand in parallel in both files: adding an export here that should also
// exist in the server (non-React) one needs the same change there.
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
export { generatePdf, downloadPdf, type GeneratePdfOptions } from "./pdf/generate";
export { migrateTemplate, CURRENT_TEMPLATE_VERSION } from "./template";
// ===========================================================================
// ERRORS — every failure is a CLASS, and `error.message` is ENGLISH
//
// The `error.message` of every `throw` in the package is in ENGLISH, always,
// and the <Designer>'s `locale` does not change that — on purpose. A thrown
// message is a DEVELOPER diagnostic: it goes to the log, the stack trace and
// Sentry. Localizing it would make the log multilingual and impossible to
// grep, and the library convention is a single language.
//
// Do NOT regex-match on the message. Every failure carries:
//
//   - a CLASS, with the structured data of that site (`err.field`,
//     `err.maxPages`, `err.limitBytes`, `err.found`…);
//   - a string-literal `code` — `switch (err.code)` covers every case with
//     TypeScript's exhaustiveness checking, and it is what a backend uses to
//     choose between 413, 400 and 500 (`err.blame` also serves: "data",
//     "template", "config" or "package").
//
// And the END USER text is localized, by `describePdfError(err, t)` — it
// returns `{ code, blame, title, action?, field?, detail }` in `t`'s language
// (`dictFor("pt-BR")` outside React, `useT()` inside), or `null` if the error
// is not ours. `detail` is the raw `message`: show it as a technical DETAIL,
// never as the main sentence. See the docs: "Failure modes".
//
//   import { describePdfError, dictFor } from "json-pdf-designer/server";
//   const problem = describePdfError(err, dictFor("pt-BR"));
//   if (!problem) throw err;                 // not ours
//   res.status(problem.blame === "package" ? 500 : 400).json(problem);
export {
  describePdfError,
  isPdfError,
  PdfGenerationError,
  PDF_ERROR_CODES,
  // The two that already existed before this section became class+localizer.
  PageLimitError,
  UnsupportedGlyphError,
  // Pagination and layout.
  PaginationStalledError,
  InvalidPageSizeError,
  // Fonte.
  Woff2SupportMissingError,
  FontDecompressFailedError,
  FontDecompressTimeoutError,
  // Imagem.
  ImageUploadTooLargeError,
  ImageUploadUnreadableError,
  ImageTooLargeError,
  TooManyImagesError,
  UnsupportedImageFormatError,
  ImageUnreadableError,
  BackgroundImageUnreadableError,
  // Template (migration).
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

// Expression validation — for whoever builds their own UI and wants to point
// at the error the way the <Designer> does. GENERATION is deliberately
// tolerant (an invalid expression becomes an empty field, it does not bring
// the PDF down), so without this the problem would be invisible. See the docs.
export { expressionError, templateExpressionErrors } from "./expressions/resolve";
export { suspiciousOperator, templateSuspiciousOperators } from "./expressions/suspicious";
export { ALL_SUGGESTIONS, applySuggestion, insertAtCaret, suggestAt, wordAtCaret } from "./expressions/suggest";
export type { Suggestion } from "./expressions/suggest";
export { braceError, tokenAtCaret } from "./expressions/templateText";
export type { TokenSpan } from "./expressions/templateText";
export { fieldWarning, expressionErrors, filterIncomplete } from "./fieldWarnings";
// The dictionary as a value, to call fieldWarning outside a React component.
export { dictFor } from "./i18n/dictionaries";
export type { SchemaExpressionError } from "./expressions/schemaExpressions";

export { makeChartSchema, makeKpiSchema, makeSectionColumnPair } from "./schemaFactory";
export { I18nProvider, useT, useLocale, withInlineCode, type Locale, type Dict } from "./i18n";
export { mmToPx, pxToMm, mmToPt } from "./page/units";
export { PAGE_SIZE_PRESETS, orientationOf, applyOrientation, matchPreset, type Orientation } from "./page/sizes";
export { classifyZone, isRedZone, clampToZone, type Zone, type Bands } from "./page/zones";
export { normalizeFontBytes } from "./pdf/fontUtils";
export { default as Designer, type DesignerProps } from "./designer/Designer";
// PdfPreview/PdfPreviewModal/configurePdfWorker do NOT leave from here — they
// live in "json-pdf-designer/preview" (see src/preview.ts), because they
// depend on pdfjs-dist, which is an OPTIONAL peer. Re-exporting any of them
// here would make every consumer of this entry need pdf.js installed all over
// again, even those who only use <Designer>.


// ===========================================================================
// COMPOSITION — build your own editor layout (3.0.0)
//
// The <Designer> above is a PRESET: it assembles the providers and a
// two-column layout. If you want to decide where each part goes, assemble the
// provider by hand and place the parts:
//
//   <UiComponentsProvider components={MY_KIT}>
//     <DesignerProvider template={t} onChangeTemplate={setT}
//                       bindings={b} onChangeBindings={setB}>
//       <DesignerToolbar className="my-toolbar" />
//       <div className="my-grid">
//         <DesignerFieldList />
//         <DesignerCanvas />
//         <DesignerPropertyPanel section="dados" />
//       </div>
//     </DesignerProvider>
//   </UiComponentsProvider>
//
// With no `whenTab`, each part always renders — which is what allows putting
// two side by side. Pass `whenTab="pagina"` to reproduce the tab behavior.
// ===========================================================================

// The state provider. Every part below needs it above them (and only it —
// the I18nProvider is optional, the default is English).
export { DesignerProvider, type DesignerProviderProps } from "./designer/context/DesignerProvider";

// The 10 placeable parts. `DesignerSidebar` is a convenience: it composes the
// seven content ones with the tab gate the <Designer> uses.
export {
  DesignerBindingEditor,
  DesignerCanvas,
  DesignerFieldList,
  DesignerFilterPanel,
  DesignerInspector,
  DesignerPageSettings,
  DesignerPropertyPanel,
  DesignerSidebar,
  DesignerTabBar,
  DesignerToolbar,
  type DesignerBindingEditorProps,
  type DesignerCanvasProps,
  type DesignerFieldListProps,
  type DesignerFilterPanelProps,
  type DesignerInspectorProps,
  type DesignerPageSettingsProps,
  type DesignerPropertyPanelProps,
  type DesignerSidebarProps,
  type DesignerTabBarProps,
  type DesignerToolbarProps,
  type TabGate,
} from "./designer/parts";

// ACCESS hooks for the editor's state — to write your own part, or to react
// to the editor from outside it (e.g. a header showing the selected field's
// name). They only work inside a <DesignerProvider>.
//
// The five contexts are separated by FREQUENCY of change, so read only what
// you use: `useDesignerActions()` never changes identity, while
// `useDesignerData()` changes on every edit.
export {
  useDesignerActions,
  useDesignerConfig,
  useDesignerData,
  useDesignerSelection,
  useDesignerUi,
  // Selectors: they DERIVE from the state instead of living in it, so each
  // part pays only for the computation it reads itself.
  useDesignerBulkEdit,
  useDesignerFieldListSchemas,
  useDesignerFilterColumns,
  useDesignerSelectedSchema,
  useDesignerTabWarnings,
} from "./designer/context/hooks";

// THE ZOOM has a context of its OWN, and that is why the hook is separate.
//
// It exists because assembling the editor from loose parts gave no access to
// the zoom at all: the value was `useState` internal to `<PageCanvas>`, and
// the `.jpd-zoombar` is `position: sticky` INSIDE the canvas — so CSS could
// only move it within that box, never to another React container.
//
// A separate context is what lets that out at no cost: whoever does NOT call
// `useDesignerZoom()` does not re-render when the zoom changes. Combine it
// with `<DesignerCanvas hideZoombar />` to draw your own bar.
export { useDesignerZoom } from "./designer/context/useDesignerZoom";
export type { DesignerZoomValue } from "./designer/context/zoomContext";
// The limits the canvas uses, so your own bar does not let through a value
// the canvas later refuses. `clampZoom` is the same one `setZoom` applies.
export { clampZoom, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "./canvas/zoomScale";

// TABLE COLUMN: always a token, the label separate from the reference.
//
// `tokenFor` is the single rule for "how a key becomes a token" — a new
// table, the normalization and the ƒx chips all go through it, so there are
// no two versions to diverge. `columnFormulaFor` is the SAME precedence the
// PDF uses (a cell with a `{` beats the binding), exposed because whoever
// draws their own panel needs it to avoid seeding the editor from the wrong place.
export { columnFormulaFor, segmentFor, tokenFor } from "./fields/table/columnFormula";
// A table already bound to an array path, with each column's token filled
// in. It used to live outside the package, and the five examples reimplemented
// it — wrong in the same way, with a placeholder missing its braces.
export { makeBoundTable } from "./schemaFactory";
// For data already saved: it converts a raw-key column into `{label,
// formula}`. Idempotent. It is not called automatically — rewriting the
// consumer's template on mount would be an invisible side effect.
export { normalizeTableColumns } from "./fields/table/normalizeColumns";
export type {
  DesignerActionsValue,
  DesignerConfigValue,
  DesignerDataValue,
  DesignerSelectionValue,
  DesignerUiValue,
} from "./designer/context/contexts";

// ===========================================================================
// PRIMITIVES — swap the components the editor uses INTERNALLY
//
// Every button, input, select and modal in the editor resolves through this
// registry. An adapter is 5 lines, and that is why every `*Props` is exported:
//
//   import { UiComponentsProvider, type ButtonProps } from "json-pdf-designer";
//   import { Button as MuiButton } from "@mui/material";
//
//   const MY_KIT = {
//     Button: ({ variant, size, ...rest }: ButtonProps) => <MuiButton {...rest} />,
//   } satisfies UiComponentsOverride;   // a MODULE constant, see below
//
// IMPORTANT: hoist the map to a module constant. An inline object creates a
// new component on every render and React remounts whatever changed identity
// — the symptom is losing field focus on every keystroke. Outside production
// the provider warns in the console.
// ===========================================================================
export { UiComponentsProvider, type UiComponentsProviderProps } from "./components/ui/UiComponentsProvider";
export { useUiComponents } from "./components/ui/useUiComponents";
export { defaultUiComponents, type UiComponents, type UiComponentsOverride } from "./components/ui/registry";

// ===========================================================================
// UI KIT — the ready-made blocks, now without Tailwind
//
// They all accept `className` (MERGED with ours, yours comes last), `style`
// (yours wins) and the rest of the native element's props. Those that render
// more than one element expose the inner ones through `parts`, by role.
//
// The appearance comes from "json-pdf-designer/theme.css". Without importing
// it they come out bare and you style the `.jpd-*` classes from scratch — see
// "json-pdf-designer/reset.css" for the subset with no appearance.
//
// `BulkLocked` deliberately does NOT leave from here: it means "this field is
// locked because you selected several of the same type", which is a MODE of
// the <Designer>, not a reusable UI block. Outside that context the component
// does not mean anything.
// ===========================================================================
export {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Checkbox,
  ClearFieldButton,
  CollapsibleSection,
  ColorInput,
  Input,
  MaterialIcon,
  Modal,
  PalettePicker,
  PaletteSwatches,
  Select,
  TabPanel,
  Textarea,
  type BadgeProps,
  type ButtonProps,
  type CardProps,
  type CardTitleProps,
  type CheckboxProps,
  type ClearFieldButtonProps,
  type CollapsibleSectionProps,
  type ColorInputProps,
  type InputProps,
  type MaterialIconProps,
  type ModalProps,
  type PaletteGroup,
  type PaletteGroupItem,
  type PalettePickerProps,
  type PaletteSwatchesProps,
  type SelectProps,
  type TabPanelProps,
  type TextareaProps,
} from "./components/ui";

// Types of the styling API. Any component's `parts` is built with
// `PartStyle`; `cx` accepts `ClassValue`. Exported so an adapter can name
// them instead of re-deriving them.
export type { ClassValue, LabeledParts, PartStyle } from "./components/ui";

// The 20 icons. `IconProps` is `SVGAttributes` — and deliberately NOT
// `SVGProps`, which would accept a `ref` that goes nowhere here.
export {
  IconAlertTriangle,
  IconArrowsHorizontal,
  IconArrowsVertical,
  IconBringToFront,
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconDownload,
  IconFolderUp,
  IconGrip,
  IconLink,
  IconLock,
  IconLockOpen,
  IconMinus,
  IconPencil,
  IconPlus,
  IconRefresh,
  IconSendToBack,
  IconTrash,
  IconUpload,
  IconX,
  type IconProps,
} from "./components/ui";
