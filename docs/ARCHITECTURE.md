**English** | [Português](ARCHITECTURE.pt-BR.md)

# Architecture

Map of the source tree for anyone who needs to change something —
grouped by responsibility, not by import order.

## Data model (`src/types/`)

```ts
export type Schema = TextSchema | TableSchema | ImageSchema | SectionSchema | ChartSchema | KpiSchema;

export type Template = {
  page: PageSize; // { width, height } in mm
  headerHeight?: number; // static bands (mm) repeated on every generated page
  footerHeight?: number;
  marginLeft?: number;
  marginRight?: number;
  backgroundImage?: string; // PNG data URI, letterhead-style background
  schemas: Schema[];
};

export type Binding =
  | { schemaName: string; type: "scalar"; path: string }
  | { schemaName: string; type: "array"; path: string; columns: TableColumn[] }
  | { schemaName: string; type: "keyvalue"; paths: string[] }
  | { schemaName: string; type: "template"; template: string }
  | { schemaName: string; type: "section"; path: string }
  | { schemaName: string; type: "chart"; path: string; labelColumn: string; valueColumn: string; filters?: ChartFilterGroup[] };
```

Every `Schema` shares `BaseSchema` (`id`, `name`, `x`/`y`/`width`/`height`
in mm, `locked?`, `sectionId?`) plus type-specific fields — see
`src/types/schema.ts` for the full, current shape of each one (it grows
whenever a field type gains a new option, so that file is the source of
truth, not this doc).

Unit of measure: **mm** everywhere in the data model (easy to reason
about — an A4 sheet is 210×297mm). Converted to **px** only to render on
the editor canvas (`src/units.ts`, `mmToPx`/`pxToMm`) and to **pt** when
drawing the real PDF via pdf-lib (`mmToPt`).

## Editor (`src/designer/Designer.tsx` + `src/components/`)

`Designer.tsx` owns selection state, the tab bar (Fields/Data/Style/
Filter/Page), clipboard (copy/paste), keyboard shortcuts, and every
mutation on `Template`/`Binding[]` (add/remove/reorder schemas, update a
binding, resize page bands...). It renders two children:

- **`PageCanvas.tsx`** — the actual page: one `<Rnd>` (react-rnd) per
  schema for drag/resize, the header/footer/margin bands drawn in red,
  the grid, marquee (box) selection, zoom controls. Delegates what a
  field actually looks like to **`FieldBox/`** (one small component per
  `schema.type` — `TextField.tsx`, `TableField.tsx`, `ImageField.tsx`,
  `SectionField.tsx`, `ChartField.tsx`, `KpiField.tsx`).
- **The side panel** — `FieldList.tsx` (the field list, click to select),
  `Toolbar.tsx` (add-field buttons), and, once a field is selected,
  `PropertyPanel.tsx` — a thin dispatcher to one `PropertyPanel<Type>.tsx`
  per schema type, each split into a "Data" and a "Style" tab.
  `BindingEditor.tsx` (the generic path/array/section/chart binding
  editor) and `PropertyPanelFields.tsx` (shared X/Y/width/height inputs)
  are reused across several of them.

Selection, editing, and binding all live in the same React tree — no
module bridge, no imperative API between the canvas and the panel.

## Bindings and templates (`src/bindings/`, `src/table/columns.ts`)

`bindings.ts` is pure logic over strings/plain objects, with no
third-party dependency:

- `resolveToken`/`renderTemplate` — evaluate a `{token}`/`{FUNCTION(...)}`
  template against the real JSON document (`CUSTOM_FIELD_FUNCTIONS`:
  SUM/COUNT/AVG/CONCAT/UPPER/LOWER/TRIM/DATE/CURRENCY/NUMBER).
  `renderTemplate` is what turns a `TextSchema.content` or a
  `KpiSchema.title`/`value`/`subtitle` into the string that actually gets
  drawn.
  Formatting inside `DATE`/`CURRENCY` is intentionally independent of the
  Designer's own UI language (`locale` prop, see below) — it's part of
  the generated report's content, written by whoever authors the
  template, not the tool's chrome.
- `buildInputs` — turns the whole JSON document + `Binding[]` into a
  flat `Record<schemaName, string>` (or a stringified 2D array, for
  tables) that the canvas preview and `generate.ts` both read from.
- `resolveChartItems`/`aggregateChartItems` — resolve a chart's `Binding`
  against the real array, apply `filters` (OR-of-AND groups), group the
  tail into "Other" past `topN`.
- `describeBinding`/`describeBindingShort` — short human-readable
  summaries used only in the editor UI (accept an optional `Dict` for
  the active `locale`, default English).

`table/columns.ts` holds the pure functions that keep a `TableSchema`'s
`head`/`content`/`footer`/`columnStyles` in sync with its `Binding`
(array) when a column is added/removed/reordered/reformatted from the
panel.

## PDF generation (`src/pdf/`)

`generate.ts` is the entry point (`generatePdf(template, data,
bindings, options?)`) — pure JS, no DOM, safe to run in Node. For each
`schema` it resolves the value via `buildInputs`/`resolveToken` and
delegates the actual drawing to a per-type module:

- `drawTable.ts` — header/body/footer rows, per-column style overrides,
  pagination when a table doesn't fit on one page.
- `drawSection.ts` — repeats the group of member fields once per item of
  the bound array, growing/paginating with the rest of the body.
- `drawChart.ts` — pie/donut/bar, legend placement, color palette
  (`src/chart/colors.ts`).
- `drawKpi.ts` — the colored card + Material Symbols icon path (`src/materialIcons.ts`).

Supporting modules: `pagination.ts` (splitting the body across pages
against `headerHeight`/`footerHeight`/`marginLeft`/`marginRight`, see
`src/zones.ts` for how the editor classifies a field into header/footer/
margin/body by position alone), `fontUtils.ts` (embedding a custom TTF
via `fontkit`, `normalizeFontBytes`), `backgroundImage.ts` (turning an
uploaded PDF/PNG/JPEG into the page's background PNG), `color.ts`,
`resolvers.ts`, and `pdfWorker.ts` (wiring up `pdf.js`'s worker for
`PdfPreview`, browser-only).

Only `downloadPdf`, `Designer`, `PdfPreview*`, and the UI components
touch the DOM. Everything else under `src/pdf/`, `src/bindings/`, and
`src/types/` is safe to import in a Node backend (see
[BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md)).

## UI language (`src/i18n/`)

The Designer's own UI text (buttons, tabs, warnings, placeholders) comes
from a small dictionary — `en.ts` (canonical, default) and `pt-BR.ts`
(typed against it, so a missing key is a compile error, not a silent
blank string). `I18nProvider`/`useT`/`useLocale` (React context) wire the
`<Designer locale="en" | "pt-BR">` prop through to every component; a
component used standalone, without `<Designer>` on top, still renders
correct (English) text via the context's default value. This only
covers the editor's chrome — it never touches how `{DATE(...)}`/
`{CURRENCY(...)}` format the generated report's own content (see
"Bindings and templates" above).
