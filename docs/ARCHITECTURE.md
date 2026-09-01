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
bindings, options?)`) — pure JS, no DOM, safe to run in Node. It's a
thin orchestrator: for each page-design it derives the body layout, runs
a dry-run pass to know `{pageCount}` up front, then walks the same body
items again to actually draw, delegating to `layout/` (the math) and
`render/` (the drawing) below.

- `layout/` — pure functions, no `pdf-lib` involved:
  - `layoutTypes.ts` — `BodyItem`/`FlowBounds`/`PreparedPageDef` shapes
    shared by the two files below.
  - `bodyLayout.ts` — groups a page's schemas into `BodyItem`s ordered by
    Y (`buildBodyItems`), plus the small helpers (`boundsOf`, `gapAfter`)
    both the dry-run and the real draw loop use to walk that sequence.
  - `pageLayout.ts` — `normalizePageDefs` (single-page `Template` vs.
    multi-page `Template.pages`) and `countBodyPages`, the dry-run pass
    that mirrors the real draw loop's pagination decisions without
    touching `pdf-lib`.
- `render/` — the actual drawing, one file per field type, dispatched by
  `render/index.ts`'s `drawFieldOfType`:
  - `renderTable.ts` — header/body/footer rows, per-column style
    overrides, pagination when a table doesn't fit on one page.
  - `renderSection.ts` — repeats the group of member fields once per item
    of the bound array, growing/paginating with the rest of the body.
  - `renderChart.ts` — pie/donut/bar, legend placement, color palette
    (`src/chart/colors.ts`).
  - `renderKpi.ts` — the colored card + Material Symbols icon path
    (`src/materialIcons.ts`).
  - `renderText.ts`/`renderImage.ts` — the two simplest field types;
    `renderImage.ts` also owns the image size/count safety limits
    (`MAX_IMAGE_BYTES`/`MAX_DISTINCT_IMAGES`).

Supporting modules (still directly under `src/pdf/`, used by both
`layout/` and `render/`): `pagination.ts` (splitting the body across
pages against `headerHeight`/`footerHeight`/`marginLeft`/`marginRight`,
see `src/zones.ts` for how the editor classifies a field into
header/footer/margin/body by position alone), `fontUtils.ts` (embedding
a custom TTF via `fontkit`, `normalizeFontBytes`), `backgroundImage.ts`
(turning an uploaded PNG/JPEG into the page's background PNG — image
only, see the entry-point boundary below), `color.ts`, `resolvers.ts`,
and `pdfWorker.ts` (wiring up `pdf.js`'s worker, browser-only).

Only `downloadPdf`, `Designer`, `PdfPreview*`, and the UI components
touch the DOM. Everything else under `src/pdf/`, `src/bindings/`, and
`src/types/` is safe to import in a Node backend (see
[BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md)).

## Entry points and the pdf.js boundary

Three built entries, each a hand-maintained export subset:

- `src/index.ts` — `"json-pdf-designer"`, the full browser surface
  (`<Designer>`, UI components, `generatePdf`/`downloadPdf`, i18n).
- `src/server.ts` — `"json-pdf-designer/server"`, the same minus
  everything React/DOM, so a Node backend never resolves react.
- `src/preview.ts` — `"json-pdf-designer/preview"`, `PdfPreview`,
  `PdfPreviewModal`, `configurePdfWorker`.

`pdfjs-dist` is an **optional peer dependency** (~35MB installed), and the
`/preview` graph is the only place allowed to import it. Rendering the
preview is also the only thing the package uses pdf.js *for* — which is
why `backgroundImage.ts` accepts images only: rasterizing an uploaded PDF
would have put pdf.js back into `<Designer>`, and therefore into the main
entry, for everyone. A lazy `import()` would not help either: a bundler
still has to resolve the specifier at build time.

### The optional peers, and why they are optional

Five packages are peer dependencies with `optional: true`, and none of them
is optional by accident:

| Peer | Needed by | Cost if forced on everyone |
|---|---|---|
| `react`, `react-dom` | `<Designer>` and the UI components | a Node backend resolving React it never renders |
| `react-rnd` | `PageCanvas.tsx` only (drag/resize) | see below — it drags React in with it |
| `pdfjs-dist` | the `/preview` graph only | ~35MB installed |
| `wawoff2` | `fontUtils.ts`, lazily, for `.woff2` fonts | a Node-only WASM path bundlers warn about |

`react-rnd` is the subtle one. It was a plain `dependency` until 2.0.0, so
it was installed unconditionally — and because *its own* `react`/`react-dom`
peers are **not** optional, npm then installed the whole React stack
(`react`, `react-dom`, `react-draggable`, `re-resizable`, `scheduler`,
`prop-types`, …: about 8.7MB) even in a project that only ever imports
`/server`. Our own `optional: true` on react was silently defeated one
level down. A backend install now resolves `fontkit`, `pdf-lib` and
`tiny-inflate` plus their own trees, and nothing React.

### How the boundaries are enforced

An import in the wrong file breaks a *packaging* promise, not a build: it
costs every consumer megabytes they never asked for, or leaves a real
dependency undeclared, and it would only surface in someone else's
`npm install`. Three checks guard it, each covering an angle the others
can't:

1. **`test/entryBoundaries.test.ts`** (runs in `npm test`) — walks the
   source graph from `src/index.ts`, `src/server.ts`, and `src/preview.ts`
   following relative imports, and asserts:
   - `/server` reaches neither `react`, `react-dom` nor `react-rnd`;
   - neither the main entry nor `/server` reaches `pdfjs-dist`.

   Fastest and most precise: it names the guilty file. Two control cases
   assert the walk still *sees* what it should — pdf.js from `/preview`,
   React and `react-rnd` from the main entry — so a broken walker can't
   make the other assertions pass vacuously.

   It skips type-only statements (`import type` / `export type … from`),
   which are erased at compile time: `src/server.ts` legitimately does
   `export type { Locale, Dict } from "./i18n"`, and `./i18n/index.ts`
   re-exports the React `I18nProvider`. None of that reaches
   `dist/server.*` — neither the JS nor the `.d.ts`, which tsup inlines.
2. **`examples/no-preview`** (builds in CI) — an app that never installs
   `pdfjs-dist`, covering the real `node_modules` rather than the source
   tree. Omitting the dependency is not enough on its own: the example
   links the package with `file:../..`, and a bundler resolves bare imports
   from the file's *real* path, so a leaked import would still find pdf.js
   in the parent repo's `node_modules` (where it lives as a devDependency).
   That's why its `build` script ends with `check-no-pdfjs.mjs`, which
   greps the emitted bundle for pdf.js symbols
   (`GlobalWorkerOptions`, `PDFDocumentLoadingTask`, `pdf.worker.min.mjs`).
   Never add `pdfjs-dist` to that example — it voids the check.
3. **The tarball check in `.github/workflows/ci.yml`** — after
   `npm install ./pkg.tgz`, asserts `node_modules/pdfjs-dist` does not
   exist. This one proves the *packaging* claim: npm does not pull the peer
   in on its own, i.e. it is still genuinely optional.

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
