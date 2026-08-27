**English** | [Português](USAGE.pt-BR.md)

# Documentation

Full install, usage, and API guide for `json-pdf-designer`. For a
project overview, see the [README](../README.md); for internal
architecture decisions, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Install

```bash
npm install json-pdf-designer
```

Peer deps: `react` and `react-dom` (18 or 19). Import the package's CSS
**once**, in your app's entry point (it styles `<Designer>` itself —
without it, some editor elements end up with the wrong position/color,
because your app's Tailwind doesn't scan this library's code):

```ts
import "json-pdf-designer/style.css";
```

### Using your own Tailwind installation

`dist/style.css` is a pre-built, standalone stylesheet — it works no
matter what Tailwind version (or none) your app uses, since it's plain
compiled CSS, not source utility classes.

If your app already has its own Tailwind pipeline (v3 or v4) and you'd
rather have it generate the Designer's classes too — so they follow
your own theme/dark-mode setup instead of shipping a second, separate
stylesheet — skip the `style.css` import above and point your own
Tailwind content scan at the package's build output instead:

**Tailwind v4** (CSS-based config):

```css
@import "tailwindcss";
@source "../node_modules/json-pdf-designer/dist/**/*.{js,cjs}";
```

**Tailwind v3** (`tailwind.config.js`):

```js
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/json-pdf-designer/dist/**/*.{js,cjs}",
  ],
  // ...
};
```

`dist/index.js`/`dist/index.cjs` aren't minified, so class name strings
stay intact and either version's scanner can find every class the
Designer's components use. Pick one path or the other — importing
`style.css` **and** scanning the package with your own Tailwind at the
same time just duplicates the same utility rules.

> **Your app is on Tailwind v3 and already has its own Preflight (CSS
> reset)?** `dist/style.css` bundles Tailwind **v4**'s own Preflight —
> importing it alongside your v3 Preflight double-applies a CSS reset,
> which can show up as small spacing/border differences wherever the two
> disagree. Scanning the package with your own v3 Tailwind (as above)
> avoids this entirely: your build never touches our CSS, so only
> **your** Preflight ever runs — nothing to import, nothing to conflict.

### Server-only usage (no React needed)

Only need `generatePdf` in a backend/Node API and don't want `react`/
`react-dom` involved at all? Import from the `/server` subpath instead
of the package root — same PDF-generation logic, but built as a
separate, React-free bundle:

```ts
import { generatePdf, type Template, type Binding } from "json-pdf-designer/server";

const bytes = await generatePdf(template, data, bindings);
```

It exports everything data/PDF-related — types, `generatePdf`,
binding-resolution helpers (`renderTemplate`, `buildInputs`, …), chart
color palettes, schema factories, `normalizeFontBytes` — but not
`Designer`/`PdfPreview`/`PdfPreviewModal`/the ready-made UI components
(all React), nor `downloadPdf` (uses the browser's `document`/`Blob` —
doesn't apply on a server; write `bytes` to a file or an HTTP response
instead).

The package root (`.`) still exports the full set for apps that use
both the editor and generation together — `react`/`react-dom` stay
listed as peer dependencies there, but marked optional
(`peerDependenciesMeta`), so a backend-only `npm install` doesn't force
them on you either way.

## Basic usage

```tsx
import { useState } from "react";
import { Designer, generatePdf, downloadPdf, type Template, type Binding } from "json-pdf-designer";
import "json-pdf-designer/style.css";

const initialTemplate: Template = {
  page: { width: 210, height: 297 }, // A4 in mm
  schemas: [],
};

function Report() {
  const [template, setTemplate] = useState<Template>(initialTemplate);
  const [bindings, setBindings] = useState<Binding[]>([]);

  async function handleGenerate() {
    const data = await fetchMyData(); // the real JSON that fills the fields
    const pdfBytes = await generatePdf(template, data, bindings);
    downloadPdf(pdfBytes, "report.pdf");
  }

  return (
    <>
      <Designer
        template={template}
        onChangeTemplate={setTemplate}
        bindings={bindings}
        onChangeBindings={setBindings}
      />
      <button onClick={handleGenerate}>Generate PDF</button>
    </>
  );
}
```

`onChangeTemplate`/`onChangeBindings` accept React's `setState`
functional form (`(prev) => next`) — use the `useState` setter directly,
as in the example, so you don't lose a field if two get added in quick
succession.

## UI language

The `<Designer>` speaks English by default. Pass `locale="pt-BR"` to
switch its own UI (buttons, tabs, warnings, placeholders) to Portuguese:

```tsx
<Designer locale="pt-BR" template={template} onChangeTemplate={setTemplate} bindings={bindings} onChangeBindings={setBindings} />
```

This is purely a UI-chrome setting — it never changes how the
**generated PDF** formats dates or currency (that's `{DATE(...)}`/
`{CURRENCY(...)}` written into the template's own content by whoever
designs it, see "Data binding" below) or the internal `name` your
templates already use for existing fields.

If you use any of the package's components standalone (`PdfPreview`,
`FieldList`, etc.) without wrapping them in `<Designer>`, they render in
English by default too — wrap them in `<I18nProvider locale="pt-BR">`
yourself if you need them in Portuguese:

```tsx
import { I18nProvider, PdfPreview } from "json-pdf-designer";

<I18nProvider locale="pt-BR">
  <PdfPreview bytes={pdfBytes} />
</I18nProvider>
```

`useT()`/`useLocale()` (exported) give you the active dictionary/locale
code inside your own components, same context `<Designer>` uses
internally.

## What's in it

**Fields**: text, table, image, **section** (repeated data band),
**chart** (pie/bar), and **KPI indicator** — all drag/resize freely
(react-rnd), with a **5mm grid** snapping position/size by default —
hold **Shift** while dragging/resizing to break free of the grid and
move freely (without Shift, a field always snaps back to the grid, even
if it started off-grid). The "+ text/table/image/section/chart/
indicator" button always creates the new field **centered** in the body
area — it doesn't depend on where other fields already are, so it never
"stacks" its way off the page. Double-click turns on inline editing:
text/table become an input/textarea right on top of the field (Escape
exits, and only the cell you actually clicked shows the raw formula —
the others keep showing the clean token); an image opens the file picker
to swap it. `Delete`/`Backspace` deletes ALL selected fields; `Ctrl`/
`Cmd`+`C` copies, `Ctrl`/`Cmd`+`V` pastes an offset copy (new id/name,
already selected) — all three shortcuts are disabled while focus is in
an input/textarea, so they don't eat normal typing.

**Multi-select** — Ctrl/Cmd+click adds/removes a field from the
selection (on the canvas or in the side list); dragging on empty canvas
space (or inside a section's body, without touching its drag bar) draws
a marquee box that picks up every field it crosses. Dragging ANY
selected field moves the whole group live. Dragging a section always
moves its member fields too, in addition to the rest of the selection.

**The side panel** has a single, flat row of tabs, no nesting — **Fields**
(the list of every field already placed: click anywhere on the row to
select it — the list scrolls itself to the item if it's out of view —
send-to-back/bring-to-front buttons appear on the selected row, a lock
icon locks/unlocks moving/resizing, a trash icon removes it directly),
**Page** (size/orientation, header/footer/margin, background PDF/image,
an "edit header/footer/margin" toggle) always available, and **Data**/
**Style**/**Filter** — only present while a field is selected, and only
the ones that make sense for its type (Style doesn't exist for image/
section; Filter only exists for charts). Switching fields keeps the
current tab if it also exists on the new type (e.g. styling several
charts in a row without bouncing back to "Data" on every click); if it
doesn't exist, it falls back to "Fields".

Any Data/Style/Filter/Page tab can be pinned as hidden via the "×" that
appears on it while active — it comes back through the "+" button at the
end of the bar (which also lists "Restore default" once the order or
visibility has been changed). Tab order is free — drag one on top of
another to reorder (a thin bar shows where it'll land). Order and hidden
tabs persist across sessions via `localStorage` (keys
`json-pdf-designer:tab-order` and `json-pdf-designer:hidden-tabs`) — a
browser UI preference, not part of the saved `Template`/`Binding[]`.

**Incomplete-configuration warning** — a section/chart with no JSON
binding, or a chart filter with a column picked but no value filled in
(see "Chart filter" below), get a yellow ⚠ warning icon in the Fields
list (with the reason in the tooltip) and, for charts, also on the right
tab in the top bar — "Data" if the binding is missing, "Filter" if the
problem is an incomplete condition — pointing straight at what to fix
without having to open every tab to find out.

**Data binding** (`Binding`) — each field points at the real JSON:
- `scalar` — a direct value (`path.in.json`).
- `template` — free text with `{token}`, e.g.
  `"Client: {name} — Total: {SUM(rows.total)}"`.
- `array` — a table built from an array of objects, column by column,
  including **calculated columns** (a fixed label + a formula evaluated
  per row, can combine fixed text with more than one token:
  `"{pnr} - {product}"`).
- `keyvalue` — a "field / value" table from a manually chosen list of
  paths.
- `section` — the array a **section** (see below) repeats, one item per
  repetition.

Inside `{...}` (text, calculated column, footer cell — anywhere):
functions `SUM`, `COUNT`, `AVG`, `CONCAT`, `UPPER`, `LOWER`,
`TRIM(path)` (trims whitespace from both ends — useful for a legacy
system's fixed-width field, like `"invoice": " 01156189"`; `{token}`/
`CONCAT` preserve the value exactly as it came, on purpose, so the space
only goes away if you ask for it), `DATE(path, "output"[, "input"])`,
`CURRENCY(path, "$")`, `NUMBER(path, decimals)` (like C's `%.2f` —
controls how many decimal places, no thousands separator/symbol, that's
`CURRENCY`), and **simple arithmetic** (`{qty * price}`,
`{subtotal - discount}` — left to right, no operator precedence). A
function CAN receive another function or an arithmetic expression as an
argument (e.g. `{CURRENCY(SUM(rows.total), "$")}`), with one exception:
**two function calls combined by an operator in the same expression**
(`{SUM(a) - SUM(b)}`) doesn't resolve correctly — in that case,
pre-compute the value in the JSON or split it into two tokens.

`DATE`'s 3rd argument (optional) gives the **input format** — without
it, JS's `new Date(raw)` tries to guess, and a date like `"10/04/2025"`
(the 10th) turns into October 10th (American format). Passing
`DATE(dueDate, "DD/MM/YYYY", "DD/MM/YYYY")` reads it exactly as written,
with no ambiguity. Dates are always read/written in **UTC** (not the
browser/server's own timezone that generates the PDF) — a date-only
value (`"2026-07-01"`, no time) comes out matching exactly what was
written no matter where it runs; a datetime with an explicit offset
(`"...T23:30:00-03:00"`) is converted to the equivalent UTC instant.

## Repeated section (master-detail / data band)

A `SectionSchema` is a plain rectangle — it holds no children, it's just
a **group**: any field (text, image, table) dropped on top of it on the
canvas becomes a **member** (via `BaseSchema.sectionId`), staying a
normal field in the flat `template.schemas` array — same absolute
position, same way to select/edit/drag. Dragging a field OUT of the
section clears the link again (bidirectional). A section only drags by
its **purple bar at the top** ("Section (repeats) — drag here to move")
— clicking anywhere else on it (or a field on top of it) selects
normally, without moving it.

Once bound (`type: "section"`, path to the array), the section
**repeats once per item** of the array — stacking vertically and
paginating together with the rest of the body (a large section spills
onto a new page just like any table). Inside it:
- Any member text resolves `{field}` against the **current ITEM** (not
  the whole document), and `{Line}`/`{index}` gives the repetition
  number (1, 2, 3...).
- A **member table with no binding of its own** shows a single row,
  cell by cell, against the current item — an empty cell falls back to
  the column name directly (`head[i]` -> `{item[head[i]]}`), a filled-in
  cell is a real template (same syntax as text, can combine fields).
- A **member table WITH an `array` binding** (a path relative to the
  item, e.g. Order → OrderItems) is real master-detail — one row per
  item of the nested array, and the section **grows in height** to fit
  (text below the table, if any, shifts down with it, even if more than
  one table grows within the same section).

A section can also have **zero tables** — just member text fields is
already a valid repeated "record"/list.

## Table — header, value, and footer (totals)

Besides its normal columns, a table can have a **totals row** (`footer`)
— one cell per column, each a real template (fixed text and/or
`{token}`/`{SUM(...)}`); it's drawn just once, on the last page slice,
even if the table paginates (it never repeats like the header does).

Background/text color and **font size** are configurable at three
levels, from most generic to most specific — the whole header, the
whole value row (every data row), the whole footer
(`headBackgroundColor`/`headTextColor`/`headFontSize`,
`bodyBackgroundColor`/`bodyTextColor`/`bodyFontSize`,
`footerBackgroundColor`/`footerTextColor`/`footerFontSize` on
`TableSchema`) — and per **individual column** via `columnStyles`
(header and value kept separate, overrides only that column). With
nothing set, it falls back to the usual blue/white/9pt — old templates
don't change appearance.

The "Current table columns" list in the panel lets you **drag to
reorder** (shifts `head`/`content`/`footer`/`columnStyles` together, by
index) and has a "+" button to add a column from a known data source
(the owning section's, if the table is a member, or its own binding's,
if it's standalone).

**Header, footer, and margins** (`Template.headerHeight`/
`footerHeight`/`marginLeft`/`marginRight`, in mm) — bands that repeat on
**every page** of the generated PDF. There's no "zone" field on the
schema: a field automatically falls into the header/footer/margin when
its position (x/y) lands inside it — it's just where it is, nothing to
flag.

Outside of isolated mode (see below), a header/footer/margin field
shows up on the canvas only as visual context — dimmed, not clickable,
not draggable/resizable (and vice versa: a body field locks while
isolated mode is on). The side list also only shows what's editable in
the current mode. The **"Edit header/footer/margin"** button isolates
editing: the body disappears, only the red band shows, and any new
field created in that mode is born inside it.

Inside a text field that falls in one of these bands, the special
tokens `{pageNumber}` and `{pageCount}` work directly in the content
(bound or not) and are re-resolved on every page — useful for a "Page 1
of 3" in the footer.

**Real pagination** — if a body table (or repeated section) has more
rows/items than fit on one page, `generatePdf` automatically splits it
across several pages. EVERY item in the body — table, section, text,
image — is processed in a single sequence, **ordered by Y**: when one
finishes, the next one continues right below it (same page or a new
one, whichever fits), preserving the spacing drawn in the editor even
if something before it grew (a master-detail section) or moved to a new
page — so you can place a caption/title BETWEEN two tables, or text
before/after a section, and the relative position is respected. Each
table's editor lets you turn off "Repeat table header on next pages"
(on by default).

**Text — background and border** — a text field can have a background
color and a border (`TextSchema.backgroundColor`/`borderColor`/
`borderWidth`, in mm) — useful for a colored title band, a highlight
box, etc. With nothing set, it's transparent/borderless, as always.

**Chart** (`ChartSchema`) — pie or bar over a bound array (a `Binding`
of type `chart`: `path` to the array, `labelColumn` the label's key,
`valueColumn` the numeric key summed per label — e.g. switching
`valueColumn` from `"value"` to `"quantity"` without touching anything
else). In the panel, its fields live across three tabs — **Data** (sort
by, group into "Other" starting from N, and the JSON binding), **Style**
(type, format, legend, color palette, display, value format), and
**Filter** (see below) — same tab pattern as the table. It groups the
`topN` largest (default 7, any integer — `0` turns off grouping and
shows everyone) each with their own fixed color, and the rest into an
"Other" slice/bar — it never overruns the palette. `displayMode` picks
whether the legend/label shows the raw number or the percentage of the
total; `valueFormat` (`"number"` default or `"currency"`) formats the
raw-value part — `currencySymbol` (default `"$"`) and `decimals`
(default 2) only apply when `valueFormat` is `"currency"`.

**Color palette** (`ChartSchema.colorPalette`) — the name of a
ready-made palette (see `CHART_PALETTE_NAMES`/`CHART_PALETTE_LABELS` in
`chartColors.ts`): `"default"`, `"classic"`, `"modern"`, `"vibrant"`,
`"pastel"`, `"grayscale"` — ready-made color themes, same idea as any
spreadsheet/chart editor. A loose string (not a closed union), absent
falls back to `"default"` on its own — a template saved with a palette
name removed in a future version doesn't break. `"custom"` uses
`ChartSchema.customPaletteColors` (`string[]`, up to
`CHART_PALETTE_SIZE` hex colors) instead of a fixed one — editable color
by color in the panel (Style tab → Color palette → pick "Custom" to
reveal the pickers); with no color chosen yet, it falls back to
`"default"` until the first `onChangeCustomColors`.

**Chart filter** (its own "Filter" tab in the panel, separate from "JSON
binding") — a `Binding` of type `chart` accepts `filters?:
ChartFilterGroup[]` (groups combined with **OR**; inside a group,
conditions combine with **AND** — an advanced filter with combinable
AND/OR groups). Each condition is `{ column, op, value }`, where
`column` is a key of the bound array's item (it doesn't have to be
`labelColumn`/`valueColumn` — you can filter by one column and aggregate
by another) and `op` is `"eq"` (`=`), `"neq"` (`≠`), `"gt"` (`>`),
`"gte"` (`≥`), `"lt"` (`<`), `"lte"` (`≤`), or `"contains"` (substring,
case-insensitive). Numeric comparison when both sides convert to a
number, text otherwise — with no filter at all (`filters` absent/empty),
every item enters, as always.

```ts
// only agents with quantity > 20 OR status "vip"
const binding: Binding = {
  schemaName: "my_chart",
  type: "chart",
  path: "salesByAgent",
  labelColumn: "label",
  valueColumn: "value",
  filters: [
    [{ column: "quantity", op: "gt", value: "20" }],
    [{ column: "status", op: "eq", value: "vip" }],
  ],
};
```

**KPI indicator** (`KpiSchema`) — a KPI card: solid colored background,
an icon, title, a large value, and a caption. `icon` is the name of a
[Google Material Symbols](https://fonts.google.com/icons) icon (e.g.
`bar_chart`, `attach_money`, `warning`) or `"none"` — the panel's icon
picker is searchable both by technical name and by a plain-language
label in the active `locale`. `title`/`value`/`subtitle` are plain text
(same `{path}`/`{FUNCTION(...)}` syntax as a standalone text field) —
with no `Binding` of their own, resolved directly against the whole
document at generation time.

**Page size and orientation** — `<Designer>` shows a size selector
(A4/A3/A5/Letter/Legal) and orientation (portrait/landscape) in its
"Page" tab; `applyOrientation`/`orientationOf`/`matchPreset`/
`PAGE_SIZE_PRESETS` (exported) do the same math for anyone building
their own selector.

**Page background** (`Template.backgroundImage`) — an image (or the
first page of a PDF, rasterized once on upload) behind everything, both
in the editor and in the final PDF. The "Background PDF/image" button
in `<Designer>`; the conversion lives in `fileToBackgroundImage`
(exported internally only, for now).

**Custom font** — pass `fontBytes` (the bytes of a **real TTF/OTF**) to
`generatePdf(..., { fontBytes })` for full accent/Unicode coverage via
`fontkit`. Without it, it falls back to pdf-lib's default Helvetica
(WinAnsi — covers most Latin accents, but not everything).

`.woff`/`.woff2` (the format packages like `@fontsource/*` ship) are
also accepted — `normalizeFontBytes(bytes)` detects and decompresses
them into the real TTF/OTF that pdf-lib needs, automatically (WOFF2 via
`wawoff2`/WASM; WOFF v1 is simpler — plain zlib per table, decoded in
pure JS, no WASM at all, via `tiny-inflate`). The resulting file
reorders its tables alphabetically (a normal trait of the WOFF format,
which doesn't keep the original physical order) — this doesn't affect
the font: same glyphs, metrics, and character mapping, validated with
`fontkit` (the same library pdf-lib uses under the hood to embed the
font).

**Ruler and zoom** — a mm ruler on the left/bottom of the canvas; a
floating bar at the bottom with zoom -/+, fit width/height, and reset —
doesn't affect the generated PDF, it's just the view. Drag/resize stays
correct at any zoom level (react-rnd receives the scale factor).

**Real PDF preview** (`<PdfPreview bytes={...} />`) — renders the
generated PDF (byte for byte, with pdf.js) into one `<canvas>` per page,
showing the file's real size/margins.

### pdf.js worker — CDN by default vs. self-hosting

The preview needs pdf.js's *worker* (`pdf.worker.min.mjs`) running on
its own thread. Since the package is pre-built with `tsup` (without the
asset-URL handling Vite does for app code), it **doesn't bundle that
worker** — by default, `ensureWorker()` points at the official CDN
matching the installed version:

```
https://cdn.jsdelivr.net/npm/pdfjs-dist@<version>/build/pdf.worker.min.mjs
```

That works fine in the examples (`report-builder`/`custom-ui`) and in
any app with free outbound internet access. **In a real integration**
(a frontend behind a restrictive CSP, a VPN, a closed corporate network,
or any environment that can't depend on `jsdelivr.net`'s availability
in production), self-host the worker by calling `configurePdfWorker(url)`
**once, before the first `<PdfPreview>`/`<PdfPreviewModal>` renders** —
in your app's entry point, for example.

With Vite, import the worker as an asset (the `?url` suffix makes Vite
copy the file into the build and hand back the final URL, already
hashed/served by your own app's CDN):

```ts
// main.tsx (or any module loaded before the first screen with a preview)
import { configurePdfWorker } from "json-pdf-designer";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

configurePdfWorker(pdfWorkerUrl);
```

With another bundler (webpack, esbuild directly, etc.), the equivalent
is copying `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` into a
static folder your app serves and pointing at its public URL
(`configurePdfWorker("/static/pdf.worker.min.mjs")`).

If `configurePdfWorker` is never called and the CDN is unreachable, the
preview simply doesn't render (a network error in the console) —
`generatePdf`/`downloadPdf` **aren't affected**, since they don't use
pdf.js at all (only the visual preview depends on it).

## Ready-made UI components

If you don't want to (or can't) build your own visual shell around
`<Designer>`, the package also exports the ready-made components it uses
internally (`Button`, `Card`, `Input`, icons, etc — Tailwind, same look
as the property panel) and a complete `PdfPreviewModal`:

```tsx
import { Button, Card, CardHeader, CardTitle, Badge, Input, ColorInput, Textarea, Select, PdfPreviewModal } from "json-pdf-designer";
import "json-pdf-designer/style.css";

<Card>
  <CardHeader>
    <CardTitle>Data sources</CardTitle>
    <Button variant="ghost" size="icon"><IconX /></Button>
  </CardHeader>
  <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
</Card>
```

None of this is required — the `custom-ui` example (see "Examples"
below) builds its entire shell with its own CSS, without importing any
of these components, to prove `<Designer>` works either way.

## Public API

Everything below comes from `json-pdf-designer`. The `generatePdf`
subtree (Generation/Bindings/Chart color palettes and the plain types)
is also available React-free from `json-pdf-designer/server` — see
"Server-only usage" above.

```ts
// Component
Designer                                   // the full React canvas (toolbar + list + rulers + zoom + bands)
PdfPreview, configurePdfWorker             // preview of the generated PDF
PdfPreviewModal                            // a full modal around PdfPreview (download/close buttons)

// UI language (see "UI language" above)
I18nProvider, useT, useLocale, withInlineCode
type Locale, type Dict

// Ready-made UI (optional — see "Ready-made UI components" above)
Button, Card, CardHeader, CardTitle, Badge, TabPanel, Input, ColorInput, Textarea, Select
IconPlus, IconX, IconTrash, IconGrip, IconLink, IconMinus, IconArrowsHorizontal,
IconArrowsVertical, IconDots, IconUpload, IconLock, IconLockOpen, IconBringToFront,
IconSendToBack, IconRefresh, IconDownload, IconFolderUp, IconAlertTriangle

// Generation
generatePdf(template, data, bindings, { fontBytes? }) => Promise<Uint8Array>
downloadPdf(bytes, filename?)
normalizeFontBytes(bytes)                  // detects WOFF/WOFF2 and decompresses (a safety net — see the note above)

// Bindings
buildInputs(data, bindings)                // resolves every binding at once
renderTemplate(template, data)             // resolves a free "{token}" template
resolveToken(token, data)                  // resolves a single token/function
rowsFromArrayBinding(list, columns)        // array of objects -> table rows
columnLabel(col), columnKey(col)
describeBinding(b, t?), describeBindingShort(b, t?)  // t: Dict, for UI display — defaults to English
CUSTOM_FIELD_FUNCTIONS                     // the list of available functions (for a custom UI)
resolveChartItems(binding, data)           // "chart" binding -> raw [{label, value}]
aggregateChartItems(items, topN?, sortBy?, palette?)  // groups into the topN largest + "Other" (with a color)

// Chart color palettes
CHART_COLORS, CHART_OTHER_COLOR, CHART_PALETTES, CHART_PALETTE_LABELS,
CHART_PALETTE_NAMES, CHART_PALETTE_SIZE, resolveChartPalette, resolveChartColors
type ChartPaletteName, type ChartPresetName

// KPI icons
MATERIAL_ICON_GRID, MATERIAL_ICON_PATHS, MATERIAL_ICON_LABELS, MATERIAL_ICON_NAMES,
materialIconLabels(locale)                 // English or Portuguese icon search labels
type MaterialIconName

// Schema factories (used internally by the "+" toolbar, exported for a custom UI)
makeChartSchema(nextY, t?), makeKpiSchema(nextY, t?), makeSectionColumnPair(sectionId, column, x, y, t?)

// Zones (header/footer/margin)
classifyZone(schema, page, bands) => Zone  // "header" | "footer" | "marginLeft" | "marginRight" | "body"
isRedZone(zone), clampToZone(...)

// Units
mmToPx, pxToMm, mmToPt

// Page — size and orientation
PAGE_SIZE_PRESETS                          // A4/A3/A5/Letter/Legal, always portrait
orientationOf(page), applyOrientation(page, orientation), matchPreset(page)

// Types
Template, Schema, TextSchema, TableSchema, TableColumnStyle, ImageSchema,
SectionSchema, ChartSchema, KpiSchema, KpiIcon, BaseSchema, PageSize, Binding,
TableColumn, DataSourceOption, SectionColumnDragPayload, Zone, Bands,
GeneratePdfOptions, Orientation
```

## Package structure

```
src/
  types/
    schema.ts          -> Template/Schema (text/table/image/section/chart/kpi) + TableColumnStyle
    binding.ts          -> TableColumn, Binding (includes "chart": path/labelColumn/valueColumn/filters)
    dataSource.ts       -> DataSourceOption/DataSourceColumnType, SectionColumnDragPayload
  units.ts             -> mm <-> px <-> pt conversions + grid (GRID_SIZE_MM, snapToGrid)
  zones.ts             -> classifies a field into header/footer/margin/body + drag lock
  chartColors.ts       -> the chart's fixed categorical palettes + labels
  materialIcons.ts     -> Material Symbols icon paths + EN/PT-BR search labels (KPI icon picker)
  fieldWarnings.ts     -> "missing binding"/"incomplete filter" warning messages (Fields list, tab icons)
  pageSizes.ts         -> page size presets + orientation (portrait/landscape)
  schemaFactory.ts     -> creates a new schema (text/table/image/section/chart/indicator) + next free Y
  tableColumns.ts      -> keeps a table's head/content/footer/columnStyles in sync with its array binding
  i18n/
    en.ts, pt-BR.ts     -> the Designer's own UI text, one file per language (en is canonical)
    context.tsx, hooks.ts -> I18nProvider, useT, useLocale
  bindings/
    bindings.ts        -> resolves bindings + functions (SUM/COUNT/CONCAT/DATE/CURRENCY/NUMBER...) + arithmetic
                          + resolveChartItems/aggregateChartItems ("chart" binding)
    columnParsing.ts   -> parses the table's free-text "col, Label={FUNCTION(...)}" input
  pdf/
    generate.ts        -> generates the real PDF (pdf-lib): unified pagination (table/section/text/image
                          in a single sequence by Y), master-detail, repeated bands, background, font
    drawTable.ts       -> draws a table in pdf-lib across page slices, header/value/footer with color/size
    drawSection.ts     -> draws a repeated section, one pass per bound array item
    drawChart.ts       -> draws pie (slices via drawSvgPath) or bar + legend in pdf-lib
    drawKpi.ts         -> draws the KPI card (background + traced icon + title/value/caption)
    pagination.ts      -> splits body content across pages against the header/footer/margin bands
    resolvers.ts, color.ts -> small shared helpers for the draw* modules
    fontUtils.ts       -> WOFF/WOFF2 -> real TTF/OTF (pure zlib for v1, WASM for v2)
    pdfWorker.ts       -> shared pdf.js worker configuration
    backgroundImage.ts -> turns an upload (PDF or image) into a background PNG
    thirdParty.d.ts    -> ambient types for wawoff2/tiny-inflate (no official @types)
  Designer.tsx         -> React canvas orchestrator — selection, clipboard, tab bar, all Template/Binding[] mutations
  components/
    PageCanvas.tsx     -> the A4 sheet, rulers, zoom (zoom-aware drag/resize), grid, red bands,
                          marquee selection, drag/resize/inline editing
    FieldBox/          -> renders text/table/image/section/chart/indicator on the canvas (one file per type)
    FieldList.tsx      -> the side field list (select/lock/remove, send-to-back/bring-to-front)
    Toolbar.tsx        -> the "+ text/table/image/section/chart/indicator" buttons
    PropertyPanel.tsx  -> thin dispatcher to one PropertyPanel<Type>.tsx per schema type
    PropertyPanelText.tsx, PropertyPanelTable.tsx, PropertyPanelImage.tsx, PropertyPanelSection.tsx,
    PropertyPanelChart.tsx, PropertyPanelKpi.tsx, PropertyPanelFields.tsx -> per-type Data/Style content
    BindingEditor.tsx  -> the generic binding UI (scalar/template/array/keyvalue/section/chart + calculated columns)
    Ruler.tsx          -> the mm ruler (SVG)
    PdfPreview.tsx     -> preview of the generated PDF via pdf.js
    PdfPreviewModal.tsx-> a full modal around PdfPreview (exported, see above)
    ui/                -> Button, Input, Card, Select, Textarea, TabPanel, icons — exported (see above),
                          used internally by Designer itself (PropertyPanel/Toolbar/BindingEditor)
  index.ts             -> the package's public exports
examples/
  report-builder/      -> a full app (JSON data sources, field explorer) using the package's ready-made UI
  custom-ui/           -> the same idea, a 100% custom shell (hand-written CSS, no package component)
```

## Examples

Two example apps in `examples/`, each with its own README:

- **[report-builder](../examples/report-builder)** — the full designer
  (JSON data sources, field explorer, 6 ready-made templates) using the
  package's UI components (`Button`/`Card`/`Input`/`PdfPreviewModal`).
- **[custom-ui](../examples/custom-ui)** — a lean version (1 fixed
  template), an entirely custom CSS shell, zero package UI components —
  proof that `<Designer>` works without any foreign design system.

Each runs independently (`npm install && npm run dev` inside the
folder) — they aren't package workspaces, they just point at it via
`"json-pdf-designer": "file:../.."` in their own `package.json`.

## Build

```bash
npm run build       # tsup (JS+d.ts) + tailwindcss (dist/style.css)
npm run dev          # tsup --watch
npm run typecheck
```
