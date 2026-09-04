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
// ERROS — toda falha é uma CLASSE, e `error.message` é INGLÊS
//
// `error.message` de todo `throw` do pacote está em INGLÊS, sempre, e o
// `locale` do <Designer> não muda isso — de propósito. Mensagem lançada é
// diagnóstico de DESENVOLVEDOR: vai pro log, pro stack trace e pro Sentry.
// Localizá-la deixaria o log multilíngue e impossível de grepar, e a convenção
// de biblioteca é uma língua só.
//
// NÃO case regex na mensagem. Toda falha carrega:
//
//   - uma CLASSE, com os dados estruturados daquele sítio (`err.field`,
//     `err.maxPages`, `err.limitBytes`, `err.found`…);
//   - um `code` de string literal — `switch (err.code)` cobre todos os casos
//     com checagem exaustiva do TypeScript, e é o que um backend usa pra
//     escolher entre 413, 400 e 500 (`err.blame` também serve: "data",
//     "template", "config" ou "package").
//
// E o texto de USUÁRIO FINAL é localizado, por `describePdfError(err, t)` —
// devolve `{ code, blame, title, action?, field?, detail }` no idioma de `t`
// (`dictFor("pt-BR")` fora do React, `useT()` dentro), ou `null` se o erro não
// é nosso. `detail` é o `message` cru: mostre como DETALHE técnico, nunca como
// a frase principal. Ver docs: "Modos de falha".
//
//   import { describePdfError, dictFor } from "json-pdf-designer/server";
//   const problem = describePdfError(err, dictFor("pt-BR"));
//   if (!problem) throw err;                 // não é nosso
//   res.status(problem.blame === "package" ? 500 : 400).json(problem);
export {
  describePdfError,
  isPdfError,
  PdfGenerationError,
  PDF_ERROR_CODES,
  // As duas que já existiam antes desta seção virar classe+localizador.
  PageLimitError,
  UnsupportedGlyphError,
  // Paginação e layout.
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
  // Template (migração).
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
export { mmToPx, pxToMm, mmToPt } from "./page/units";
export { PAGE_SIZE_PRESETS, orientationOf, applyOrientation, matchPreset, type Orientation } from "./page/sizes";
export { classifyZone, isRedZone, clampToZone, type Zone, type Bands } from "./page/zones";
export { normalizeFontBytes } from "./pdf/fontUtils";
export { default as Designer, type DesignerProps } from "./designer/Designer";
// PdfPreview/PdfPreviewModal/configurePdfWorker NÃO saem daqui — moram em
// "json-pdf-designer/preview" (ver src/preview.ts), porque dependem do
// pdfjs-dist, que é peer OPCIONAL. Re-exportar qualquer um deles aqui faria
// todo consumidor desta entry precisar do pdf.js instalado outra vez, mesmo
// quem só usa <Designer>.


// ===========================================================================
// COMPOSIÇÃO — monte o seu próprio layout de editor (3.0.0)
//
// O <Designer> acima é um PRESET: ele monta os providers e um layout de duas
// colunas. Se você quer decidir onde cada parte fica, monte o provider na mão
// e posicione as peças:
//
//   <UiComponentsProvider components={MEU_KIT}>
//     <DesignerProvider template={t} onChangeTemplate={setT}
//                       bindings={b} onChangeBindings={setB}>
//       <DesignerToolbar className="minha-toolbar" />
//       <div className="meu-grid">
//         <DesignerFieldList />
//         <DesignerCanvas />
//         <DesignerPropertyPanel section="dados" />
//       </div>
//     </DesignerProvider>
//   </UiComponentsProvider>
//
// Sem `whenTab`, cada peça renderiza sempre — é o que deixa pôr duas lado a
// lado. Passe `whenTab="pagina"` pra reproduzir o comportamento de aba.
// ===========================================================================

// O provider de estado. Toda peça abaixo precisa dele por cima (e só dele —
// o I18nProvider é opcional, o default é inglês).
export { DesignerProvider, type DesignerProviderProps } from "./designer/context/DesignerProvider";

// As 10 peças posicionáveis. `DesignerSidebar` é conveniência: ela compõe as
// sete de conteúdo com o gate de aba que o <Designer> usa.
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

// Hooks de ACESSO ao estado do editor — pra escrever a sua própria peça, ou
// reagir ao editor de fora dele (ex: um cabeçalho que mostra o nome do campo
// selecionado). Só funcionam dentro de um <DesignerProvider>.
//
// Os cinco contextos são separados por FREQUÊNCIA de mudança, então leia só o
// que você usa: `useDesignerActions()` nunca muda de identidade, enquanto
// `useDesignerData()` muda a cada edição.
export {
  useDesignerActions,
  useDesignerConfig,
  useDesignerData,
  useDesignerSelection,
  useDesignerUi,
  // Seletores: DERIVAM do estado em vez de morar nele, pra cada peça pagar
  // só pelo cálculo que ela mesma lê.
  useDesignerBulkEdit,
  useDesignerFieldListSchemas,
  useDesignerFilterColumns,
  useDesignerSelectedSchema,
  useDesignerTabWarnings,
} from "./designer/context/hooks";

// O ZOOM tem contexto PRÓPRIO, e o hook mora em arquivo separado por isso.
//
// Ele existe porque montar o editor com peças soltas não dava acesso ao zoom
// de jeito nenhum: o valor era `useState` interno do `<PageCanvas>`, e a
// `.jpd-zoombar` é `position: sticky` DENTRO do canvas — então CSS só
// conseguia movê-la dentro daquela caixa, nunca pra outro container React.
//
// Contexto separado é o que deixa isso sair sem custo: quem NÃO chama
// `useDesignerZoom()` não re-renderiza quando o zoom muda. Combine com
// `<DesignerCanvas hideZoombar />` pra desenhar a sua própria barra.
export { useDesignerZoom } from "./designer/context/useDesignerZoom";
export type { DesignerZoomValue } from "./designer/context/zoomContext";
// Os limites que o canvas usa, pra uma barra própria não deixar passar valor
// que o canvas depois recusa. `clampZoom` é o mesmo que o `setZoom` aplica.
export { clampZoom, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "./canvas/zoomScale";

// COLUNA DE TABELA: token sempre, rótulo separado da referência.
//
// `tokenFor` é a única regra de "como uma chave vira token" — a tabela nova, a
// normalização e os chips do ƒx passam todos por ela, então não há duas
// versões pra divergir. `columnFormulaFor` é a MESMA precedência que o PDF usa
// (célula com `{` vence o vínculo), exposta porque quem desenha o próprio
// painel precisa dela pra não semear o editor do depósito errado.
export { columnFormulaFor, segmentFor, tokenFor } from "./fields/table/columnFormula";
// Tabela já vinculada a um caminho de array, com o token de cada coluna
// preenchido. Estava fora do pacote, e os cinco examples a reimplementavam —
// errado do mesmo jeito, com placeholder sem chaves.
export { makeBoundTable } from "./schemaFactory";
// Pra dado já salvo: converte coluna de chave crua em `{label, formula}`.
// Idempotente. Não é chamada automaticamente — reescrever o template do
// consumidor na montagem seria efeito colateral invisível.
export { normalizeTableColumns } from "./fields/table/normalizeColumns";
export type {
  DesignerActionsValue,
  DesignerConfigValue,
  DesignerDataValue,
  DesignerSelectionValue,
  DesignerUiValue,
} from "./designer/context/contexts";

// ===========================================================================
// PRIMITIVOS — troque os componentes que o editor usa POR DENTRO
//
// Todo botão, input, select e modal do editor resolve por este registry. Um
// adapter é 5 linhas, e é por isso que todo `*Props` abaixo é exportado:
//
//   import { UiComponentsProvider, type ButtonProps } from "json-pdf-designer";
//   import { Button as MuiButton } from "@mui/material";
//
//   const MEU_KIT = {
//     Button: ({ variant, size, ...rest }: ButtonProps) => <MuiButton {...rest} />,
//   } satisfies UiComponentsOverride;   // constante de MÓDULO, ver abaixo
//
// IMPORTANTE: hoiste o mapa pra constante de módulo. Objeto inline cria
// componente novo a cada render e o React remonta o que trocou de identidade
// — o sintoma é perder o foco do campo a cada tecla. Fora de produção o
// provider avisa no console.
// ===========================================================================
export { UiComponentsProvider, type UiComponentsProviderProps } from "./components/ui/UiComponentsProvider";
export { useUiComponents } from "./components/ui/useUiComponents";
export { defaultUiComponents, type UiComponents, type UiComponentsOverride } from "./components/ui/registry";

// ===========================================================================
// KIT DE UI — os blocos prontos, agora sem Tailwind
//
// Todos aceitam `className` (MERGE com a nossa, a sua vem depois), `style`
// (o seu ganha) e o resto das props do elemento nativo. Os que renderizam
// mais de um elemento expõem os de dentro em `parts`, por papel.
//
// A aparência vem de "json-pdf-designer/theme.css". Sem importar, eles saem
// pelados e você estiliza as classes `.jpd-*` do zero — ver
// "json-pdf-designer/reset.css" pro subconjunto sem aparência.
//
// `BulkLocked` NÃO sai daqui de propósito: ele significa "este campo está
// travado porque você selecionou vários do mesmo tipo", que é um MODO do
// <Designer>, não um bloco de UI reusável. Fora daquele contexto o
// componente não quer dizer nada.
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

// Tipos da API de estilo. `parts` de qualquer componente é montado com
// `PartStyle`; `cx` aceita `ClassValue`. Exportados pra um adapter poder
// nomeá-los em vez de re-derivar.
export type { ClassValue, LabeledParts, PartStyle } from "./components/ui";

// Os 20 ícones. `IconProps` é `SVGAttributes` — e de propósito NÃO
// `SVGProps`, que aceitaria um `ref` que aqui não vai a lugar nenhum.
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
  IconPlus,
  IconRefresh,
  IconSendToBack,
  IconTrash,
  IconUpload,
  IconX,
  type IconProps,
} from "./components/ui";
