**English** | [Português](ARCHITECTURE.pt-BR.md)

# Architecture

Map of the source tree for anyone who needs to change something —
grouped by responsibility, not by import order.

## Data model (`src/types/`)

```ts
export type Schema = TextSchema | TableSchema | ImageSchema | SectionSchema | ChartSchema | KpiSchema;

export type Template = {
  version?: TemplateVersion; // document format version — absent = 1, see src/template/migrate.ts
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

## Editor (`src/designer/` + `src/components/`)

`Designer.tsx` used to be the editor. Since 3.0.0 it is a **preset**, 101
lines where it was 986: three providers (`I18nProvider`,
`UiComponentsProvider`, `DesignerProvider`) and two parts
(`DesignerCanvas`, `DesignerSidebar`) in a two-column layout. The state it
used to own moved into `designer/context/`, and the layout it used to
hard-code moved into `designer/parts/`.

The two-children shape below is therefore what the **preset** renders, not
what the editor is. Anyone can mount `<DesignerProvider>` and place the ten
parts anywhere — see "The decomposition" below and, for the consumer-facing
version, "Composing the editor" in [USAGE.md](./USAGE.md).

- **`PageCanvas.tsx`** (wrapped by `parts/DesignerCanvas.tsx`) — the actual
  page: one `<Rnd>` (react-rnd) per schema for drag/resize, the
  header/footer/margin bands drawn in red, the grid, marquee (box)
  selection, zoom controls. Delegates what a field actually looks like to
  **`FieldBox/`** (one small component per `schema.type` —
  `TextField.tsx`, `TableField.tsx`, `ImageField.tsx`,
  `SectionField.tsx`, `ChartField.tsx`, `KpiField.tsx`).
- **The side panel** (`parts/DesignerSidebar.tsx`, which composes the seven
  content parts with the per-tab gate) — `FieldList.tsx` (the field list,
  click to select), `Toolbar.tsx` (add-field buttons), and, once a field is
  selected, `PropertyPanel.tsx` — a thin dispatcher to one
  `PropertyPanel<Type>.tsx` per schema type, each split into a "Data" and a
  "Style" tab. `BindingEditor.tsx` (the generic path/array/section/chart
  binding editor) and `PropertyPanelFields.tsx` (shared X/Y/width/height
  inputs) are reused across several of them.

Selection, editing, and binding all live in the same React tree — no
module bridge, no imperative API between the canvas and the panel.

### The decomposition (`designer/context/`, `designer/parts/`)

`context/DesignerProvider.tsx` mounts the state; `context/contexts.ts`
declares **five** contexts; `context/hooks.ts` holds the ten public hooks
(five accessors, five selectors); `context/derived.ts` holds the pure
derivations the selectors call; `actions.ts` holds every mutator.

**Why five contexts and not one:** each part subscribes only to what it
reads, and React re-renders a consumer when the *value* of the context it
reads changes identity — not when the provider re-renders. One context
would re-render every part on every keystroke in a text field. The split is
by **frequency of change**, measured against what each thing is:

| Context | Changes |
|---|---|
| `data` | on every template/binding edit — the hottest |
| `actions` | **never**; stable identity for the provider's lifetime |
| `selection` | on every canvas click |
| `ui` | on every tab switch / collapse / isolate toggle |
| `config` | when the provider's props change (almost never) |

`actions` is the load-bearing one: stable identity is what lets a memoized
part consume a mutator without re-rendering when the template changes. It
is only stable because every mutator was rewritten to read from the
updater's `prev` instead of from a closure — see the opening comment in
`designer/actions.ts`. Break that and the whole split degrades quietly
into "one context, five names".

Derived values (`selected`, `bulkEditActive`, `fieldListSchemas`) are
**selectors**, not context entries, for the mirror-image reason: in the
data context, its value would change identity whenever any one of them
changed, and every part reading data would re-render because of a derived
value it never touches.

The access hooks **throw** with a message naming the provider when used
outside one, rather than returning `null`. Different from `I18nContext`
(whose default is the English dictionary, so a kit component works
standalone): a designer part with no template has no fallback behaviour at
all — it would simply not render, and a silent `null` becomes "the part
doesn't appear and doesn't say why".

`parts/useTabGate.ts` holds the release's subtlest decision: the per-tab
gate is **opt-in**. Without `whenTab`, a part renders always. If gating
were the default, two panels side by side in a custom layout would erase
one of the two, because only one tab can be active — they would be parts
that *look* decomposed but only work inside a tabbed sidebar. The gate also
forces the two-component shape every part file has: `useTabGate` must be
called first and `return null` must follow immediately, so no other hook can
precede it — hence a `*Body` component holding the real work.

Three things deliberately stayed put, and each would fail *silently* if
decomposed: the `TabPanel` collapse (its `1fr`→`0fr` grid trick needs a
flex-column parent with `min-block-size: 0`, which a standalone part cannot
guarantee), `useClipboardAndDelete` (registered exactly once by the
provider — in one part, whoever doesn't render the canvas loses the
shortcuts; in two, every paste fires twice), and the per-type
`FieldBox`/`PropertyPanel*` components (dispatched by `schema.type`, with no
answer to "which schema?" other than "the selected one").

## Styling (`src/css/`)

Two hand-written stylesheets, no build step of their own:

- **`theme.css`** (2,770 lines) — the finished look. `@import`s
  `reset.css`, so one import is enough for a consumer.
- **`reset.css`** (236 lines) — the appearance-free subset: what the
  editor's markup used to inherit from Tailwind's Preflight, and nothing
  with a color, a size or a layout in it. Published as its own export for
  whoever styles `.jpd-*` from scratch.

They reach `dist/` through **`publicDir: "src/css"`** in
`tsup.config.ts` — tsup does not *process* CSS, it just copies the
directory. That runs after `clean: true` and re-copies under `--watch`, so
`npm run dev` tracks it, and it beats a `cp` script on portability. Both
are unminified on purpose: they are public contract, the consumer reads
them to learn the class and token names, and the consumer's bundler
minifies. `npm run build` is therefore just `tsup` — 3.0.0 dropped
`tailwindcss`/`@tailwindcss/cli` from devDependencies, deleted the
`build:css` script and deleted `src/style.css`.

**No global reset.** Up to 2.1.1 the shipped stylesheet was Tailwind v4
output and carried Preflight, which landed on the consumer's whole app.
Now each `.jpd-*` class carries the reset the element under it depended
on, and the only rule with a `*` is scoped to the editor's roots and
wrapped in `:where()` — specificity zero, so any consumer rule beats it.
The trap worth remembering when writing those local resets: `border: 0`
also sets `border-style: none`, after which any `border-width` computes to
zero. It has to be `border: 0 solid`.

**Conventions.** Classes are `jpd-block__element--modifier`, one element
level deep — 194 distinct `.jpd-*` selectors across 80 blocks. State is a
`data-*` attribute, never a class, and the rule that produced that split is
mechanical: *if the JSX would have to concatenate or choose a class string,
it's a `data-*`.* Values are 125 `--jpd-*` custom properties, 122 public;
the largest families are `--jpd-accent-*` (14), `--jpd-text-*` (13),
`--jpd-section-*` (12), `--jpd-space-*` (10), `--jpd-font-*` (9),
`--jpd-surface-*` (8), `--jpd-danger-*` (7). The other three are internal
knobs of a single component each and take a leading underscore
(`--jpd-_btn-ring`, `--jpd-_modal-max`, `--jpd-_swatch-size`), which is
what keeps the public list readable. Spacing is in `rem`, not px, because
the original value was `calc(var(--spacing) * N)` and emitting px would
break anyone whose root font size isn't 16.

**`@layer json-pdf-designer`** wraps everything, and both files declare
`@layer json-pdf-designer, utilities;` before any rule. Unlayered CSS beats
layered CSS regardless of specificity, so every consumer rule wins by
default — which is what makes accepting `className` mean anything, and why
the layer order has to be declared rather than inferred from import order
(measured: an example app's `bg-sky-600` computed to `rgba(0,0,0,0)`
because our reset won). The side effect is that a bare element selector
also wins and reaches the editor's chrome; that is not new — Tailwind v4
output emitted `@layer utilities`, so a loose `button { … }` already beat
2.x's stylesheet.

Dark mode is `[data-jpd-theme="dark"]` with `.dark` kept as an alias (what
2.x consumers already set), and `[data-jpd-theme="light"]` to force light.
No media query, deliberately: a library should not turn a light-only app
dark because the OS is. Tokens live on `:root` because `<Modal>` renders
through `createPortal(document.body)` — a dark island scoped to a container
would otherwise leave every portalled modal light.

**Both exports have example coverage, and so does the mode that takes
neither.** The five apps in `examples/` sit at five different points on
the spectrum: `theme.css` as it ships (`report-builder`), `theme.css`
rethemed by token only (`composed-layout`), `theme.css` in dark mode
(`no-preview`), `reset.css` alone (`headless-designer`), and no package
CSS at all (`custom-ui`). That matters because until 3.0.0 `reset.css`
was a public export with zero examples using it. The split is guarded by
`test/docsFreshness.test.ts`, which reads each example's real CSS import
lines and fails when one moves without the documentation moving with it —
including the reset-only trap it also asserts: `PdfPreview` reads
`--jpd-shadow-page-preview` inline through `canvas.style.boxShadow`, so a
`reset.css`-only consumer has to declare that token or the shadow
disappears with no error.

**Where the line runs between the part and the consumer.** A part owns
whatever is *structural* to itself and nothing more. `DesignerCanvas` owns
the sheet geometry (mm→px, `transform: scale(zoom)`) because `react-rnd`
computes its drag delta against that transform — override it from outside
and the field runs away from the cursor. The consumer owns the scrolling
viewport around it, which is what the part's `className` reaches, and the
sidebar's width: it is `inline-size: 20rem` on `.jpd-sidebar` in
`theme.css` — an overridable stylesheet rule, not a value hard-coded in
`DesignerSidebar`. Panel width is a layout decision, and layout belongs to
the consumer.

The same rule shapes the UI kit's props: **`className`/`style`/`...rest` go
to the element that gives the component its name; every other element it
renders is addressed through `parts`, by role.** So `Input.className` stays
on the `<input>` (source-compatible with 2.x) and its `<label>` wrapper is
`parts.root`; `Modal.className` is the panel and the backdrop is
`parts.overlay`. `parts` accepts only `className`/`style` — no handlers, no
refs. `cx` (in `components/ui/cx.ts`) merges class strings, dedupes exact
tokens and returns `undefined` when empty; `mergeStyle` lets the
consumer's `style` win.

## Bindings and templates (`src/bindings/`, `src/table/columns.ts`)

`bindings.ts` is pure logic over strings/plain objects, with no
third-party dependency:

- `resolveToken`/`renderTemplate` — evaluate a `{token}`/`{FUNCTION(...)}`
  template against the real JSON document, delegating to the expression
  engine in `src/expressions/` (see below). `renderTemplate` is what turns
  a `TextSchema.content` or a `KpiSchema.title`/`value`/`subtitle` into the
  string that actually gets drawn.
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

### Degrade or fail: where the line is

`src/pdf/textSafety.ts` holds the two halves of one decision, and the split is
worth understanding before touching either.

A problem in the **data** degrades. A control character (`
`, `	`, NUL) is
replaced with a space at every path that reaches the page — `truncateToWidth` is
the funnel for table cells, KPI and chart labels, and `renderText.ts` sanitises
its own value because it is the one path that does not truncate. No font has a
glyph for a control character, not even a complete Unicode one, so this is the
only possible rendering rather than content loss. Before this, a `
` in a
customer name failed the whole document.

A character that a *complete* font would render, but this one cannot, fails —
and `withGlyphContext` is what makes the failure usable. It wraps a draw call
and, on error, finds the offending character by testing candidates one by one
against the font, rather than matching pdf-lib's error message (the same mistake
the expression engine's error hierarchy exists to avoid). The candidate list is
a **lazy** function, so resolving a chart's labels or flattening a table's rows
costs nothing on the normal path. It is applied at five points: the text field,
the KPI and the chart in `render/index.ts`, and inside `drawTableSlice`, which
is the funnel for all three table paths (body, repeating band, nested in a
section).

`docs/USAGE.md`, "What can and cannot fail a generation", is the user-facing
version of the same table — keep the two in step.

## The expression engine (`src/expressions/`)

`parse -> AST -> evaluate`, in four files: `tokenize.ts`, `parse.ts`,
`evaluate.ts`, plus a `functions.ts` registry (the 11 names in
`CUSTOM_FIELD_FUNCTIONS`). `dataAccess.ts` and `formatters.ts` hold the
path lookup, value comparison and DATE/CURRENCY formatting — they live here
rather than in `bindings.ts` because `bindings.ts` imports the engine, so
the engine cannot import back.

Three decisions worth knowing before touching it:

- **An operator is only an operator when surrounded by whitespace on both
  sides.** `{my-key}` and `{my key}` are paths; `{a - b}` is subtraction;
  `{a -b}` is neither. This is not a quirk to clean up — it is what lets a
  JSON key contain a hyphen or a space, templates in production rely on it,
  and a conventional tokenizer would break `{my-key}` into three tokens and
  return 0. `tokenize.ts` implements it explicitly, with tests.
- **Intermediate values are `string | number`, coerced at each operator
  boundary.** The engine this replaced kept every intermediate as a string
  and re-parsed it at every nesting level, which is why it had no operator
  precedence (`{a + b * c}` gave 20, not 14), no parenthesised grouping
  (`{(a + b) * c}` gave 0), and threw on `{"x" + 1}` and `{a / 0}` — those
  two fell into an infinite recursion that the nesting guard caught,
  reporting a depth problem that did not exist.
- **`SUM`/`COUNT`/`AVG` take a raw array path, not a value.** In
  `SUM(items.total)`, `items.total` means "the `total` column of the `items`
  array". That is why `call` nodes keep `argSources` (the original text)
  alongside the parsed `args`.

No `eval`/`new Function`: a template can come from an untrusted source, so
the evaluator walks the AST. `MAX_EXPRESSION_DEPTH` (40) guards the V8 call
stack against a malformed or malicious template.

Errors are a two-member hierarchy in `errors.ts` — `ExpressionSyntaxError` and
`ExpressionDepthError`, both under `ExpressionError`. The base class is what
`resolve.ts` catches, and that matters: generation swallows **template**
problems (the field renders empty, the editor flags it) and lets anything else
propagate, because swallowing everything would hide an engine bug. Recognising
one of them by matching its message would be the same mistake in a different
shape — and it was: the depth error used to be a plain `Error` sniffed by
regex, which is why a too-deeply-nested expression took the whole PDF down.

## PDF generation (`src/pdf/`)

`generate.ts` is the entry point (`generatePdf(template, data,
bindings, options?)`) — pure JS, no DOM, safe to run in Node. It is a thin
orchestrator: it asks `layout/` where everything goes, then draws what comes
back. It contains no pagination decision of its own (see "Layout and drawing"
below).

- `layout/` — pure functions, no `pdf-lib` involved:
  - `layoutDocument.ts` — **the** pagination pass: `Template` + data +
    bindings in, a `LayoutDocument` (pages of positioned, value-resolved
    `Placement`s) out.
  - `layoutTypes.ts` — `BodyItem`/`FlowBounds` shapes.
  - `bodyLayout.ts` — groups a page's schemas into `BodyItem`s ordered by
    Y (`buildBodyItems`), plus the helpers (`boundsOf`, `gapAfter`) the
    pass uses to walk that sequence.
  - `pageLayout.ts` — `normalizePageDefs` (single-page `Template` vs.
    multi-page `Template.pages`).
  - `sectionLayout.ts` — how many repeats a bound section has and how tall
    each one is once its master-detail tables have grown.
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

### Layout and drawing: one pass, then paint

`layout/layoutDocument.ts` decides **all** pagination for a Template + data +
bindings, without drawing anything and without touching pdf-lib. It returns a
`LayoutDocument`: one entry per physical page, each holding `Placement`s that
are already positioned (`yMm` from the flow cursor) and already resolved (the
text value, the rows of a table slice). `generate.ts` then walks that array and
paints; it contains no pagination decision at all.

That shape is recent and worth understanding, because it replaced a real
hazard. Pagination used to be computed **twice**: the drawing loop decided page
breaks and drew in the same pass, and `countBodyPages` walked the body a second
time purely to produce the total — `{pageCount}` has to be right on the first
physical page, so the count must finish before the first mark. The two shared
only the atomic decisions in `pagination.ts` (`needsNewPageForItem`,
`computeTableSlice`); the cursor advance, the table-slicing loop and the section
repetition existed in two copies. A change to one of them meant "the dry run
said 7 pages, the drawing made 8" — silent, and very hard to trace.

Now the page count is `pages.length`, so divergence is structurally impossible.

Two consequences worth keeping:

- **The cursor after a table advances by `computeTableSlice().heightMm`,** not
  by the Y coordinate `drawTableSlice` returns. Table geometry is deterministic
  (`TABLE_ROW_HEIGHT_MM` is fixed and a cell truncates rather than wraps), so
  the height is a function of the row *count* — which is exactly why the layout
  can know where a table ends without drawing it.
- **`layout/` must not import from `render/`.** Section measurement lives in
  `layout/sectionLayout.ts` and the table metrics in `pdf/tableMetrics.ts` for
  that reason; `render/renderTable.ts` imports `rgb` from pdf-lib as a value,
  and dragging that into the layout graph would cost the layout its
  independence — the property that lets the same `LayoutDocument` feed
  something other than pdf-lib later.

`{pageNumber}`/`{pageCount}` are resolved by the **renderer**, not the layout,
and only for the repeating bands (header/footer/margin) — no body field uses
them. That is what removes the chicken-and-egg that made the dry run necessary
in the first place.

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
  (`<Designer>` and the ten parts, `DesignerProvider` and the ten hooks,
  the primitive registry, the UI kit, `generatePdf`/`downloadPdf`, i18n):
  130 exports, measured on the built `dist`.
- `src/server.ts` — `"json-pdf-designer/server"`, the same minus
  everything React/DOM, so a Node backend never resolves react. Untouched
  by 3.0.0 — the emitted `server.d.ts` is byte-identical to 2.1.1's.
- `src/preview.ts` — `"json-pdf-designer/preview"`, `PdfPreview`,
  `PdfPreviewModal`, `configurePdfWorker`.

Plus two CSS exports that are not built entries at all —
`"json-pdf-designer/theme.css"` and `"json-pdf-designer/reset.css"`, copied
from `src/css/` (see "Styling" above). The 2.x `"./style.css"` and
`"./dist/style.css"` keys were **removed rather than aliased**: an alias
would have quietly resolved to a different stylesheet, and a build-time
`ERR_PACKAGE_PATH_NOT_EXPORTED` that points at the changelog is a better
failure than a silent visual change.

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
