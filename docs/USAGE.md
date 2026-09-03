**English** | [Português](USAGE.pt-BR.md)

# Documentation

Full install, usage, and API guide for `json-pdf-designer`. For a
project overview, see the [README](../README.md); for internal
architecture decisions, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Install

```bash
npm install json-pdf-designer
```

Peer deps: `react` and `react-dom` (18 or 19). Import the theme **once**,
in your app's entry point — one line, and it pulls in the reset it needs
by itself:

```ts
import "json-pdf-designer/theme.css";
```

### Styling: the theme, the bare reset, or your own CSS

3.0.0 removed Tailwind from the package. `theme.css` and `reset.css` are
hand-written CSS over `.jpd-*` classes and `--jpd-*` custom properties,
copied into `dist/` as-is (`publicDir` in `tsup.config.ts`) and
deliberately unminified: they are public contract, so you read them to
learn the class and token names, and your own bundler minifies them.

| Import | What you get |
|---|---|
| `json-pdf-designer/theme.css` | the reset **plus** the finished look — 2,770 lines |
| `json-pdf-designer/reset.css` | the reset only, with no color, size or layout — 236 lines |

`theme.css` `@import`s `reset.css`, so importing both is redundant rather
than wrong. Take `reset.css` alone when you intend to style `.jpd-*` from
scratch and don't want the look: it gives you back the element resets the
editor's markup relies on, and nothing else. Want to skip even that?
That's supported too — the `custom-ui` example imports **no** package CSS
at all and dresses the editor entirely in its own stylesheet.

Those three modes are not hypothetical: each of the five example apps
sits at a different point on the spectrum, from "the theme as it ships"
to "no package CSS at all". See
["The styling spectrum across the five examples"](#the-styling-spectrum-across-the-five-examples)
for the map, and ["Styling and theming"](#styling-and-theming) for the
class-name convention, the token list, dark mode and the cascade rules.

> **Upgrading from 2.x?** `json-pdf-designer/style.css` is gone, with no
> alias — the old import now fails to resolve
> (`ERR_PACKAGE_PATH_NOT_EXPORTED`) at build time. That's deliberate. An
> alias would have quietly handed you a *different* stylesheet (no
> Preflight, new internal class names), and a silent visual change is
> worse to debug than a build error that points at the changelog. Replace
> it with the `theme.css` line above.

> **The reset polarity flipped, and this is the note to read if your app
> has no CSS reset of its own.** Up to 2.1.1, `dist/style.css` was
> compiled Tailwind v4 and carried Tailwind's **Preflight** inside it: a
> global reset that landed on your whole app whether you wanted it or not,
> so the risk worth warning about was *double*-applying a reset alongside
> your own. 3.0.0 ships **no global reset at all**, so the risk is the
> opposite one: nothing resets your page, and the editor inherits whatever
> reset the host document has — or hasn't. The only rule with a `*` in it
> is scoped to the editor's own roots and wrapped in `:where()`, which
> gives it specificity zero; any rule of yours beats it.
>
> Inside the editor this costs you nothing: each `.jpd-*` class now
> carries the reset the element under it depended on. What you may have
> been getting for free *outside* the editor, and now need to put back
> yourself:
>
> | What Preflight used to do globally | Where it lives now |
> |---|---|
> | `* { box-sizing: border-box }` | scoped to the editor roots, specificity zero |
> | `margin`/`padding: 0` on headings, paragraphs, lists | on the `.jpd-*` classes that need it |
> | `list-style: none` on `ul`/`ol` | same |
> | `font`/`color`/`background` inherited by form controls | same |
> | `svg { display: block }` | on `.jpd-icon`/`.jpd-micon`/`.jpd-ruler` (23 inline SVGs) |
> | `code { font-family: monospace }` | on `.jpd-code`, with the full stack as a `var()` fallback |
> | `table { border-collapse: collapse }` | on `.jpd-fieldtable` |
> | `appearance: button` on `button`/`[type=button]` | on `.jpd-btn`/`.jpd-iconbtn` |
>
> If you hand-roll that reset yourself, one trap is worth spelling out
> because almost everyone hits it: **`border: 0` also sets
> `border-style: none`**, and after that any `border-width` you set
> computes to zero. Write `border: 0 solid`.

Already had a Tailwind `@source`/`content` entry pointing at
`node_modules/json-pdf-designer/dist/**`? **Delete it.** There is no
utility class left in `dist/` for a scanner to find, so that entry now
produces nothing at all — and produces it silently, which is the worst
kind of stale config.

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
both the editor and generation together — `react`, `react-dom` and
`react-rnd` stay listed as peer dependencies there, but marked optional
(`peerDependenciesMeta`), so a backend-only `npm install` doesn't force
them on you either way.

`react-rnd` (the drag/resize library behind the canvas) is in that list
for a non-obvious reason: as a plain `dependency` it was installed
unconditionally, and because *its own* `react`/`react-dom` peers are **not**
optional, npm then pulled the whole React stack in — about 8.7MB — even
into a project that only ever imports `/server`. Making it an optional peer
is what actually delivers the React-free backend install; the `optional:
true` on our own react peers was not enough by itself.

## Basic usage

```tsx
import { useState } from "react";
import { Designer, generatePdf, downloadPdf, type Template, type Binding } from "json-pdf-designer";
import "json-pdf-designer/theme.css";

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
import { I18nProvider } from "json-pdf-designer";
import { PdfPreview } from "json-pdf-designer/preview";

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
icon locks/unlocks moving/resizing, a trash icon removes it directly,
double-clicking the name renames the field (remaps any `Binding.schemaName`
pointing at the old name along with it)),
**Page** (size/orientation, header/footer/margin, background image,
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
`CURRENCY`), `IF(condition, "then", "else")` (see below), and **simple
arithmetic** (`{qty * price}`, `{subtotal - discount}` — see "How an
expression is read" below). A function CAN receive another function or an
arithmetic expression as an argument (e.g.
`{CURRENCY(SUM(rows.total), "$")}`), including two combined by an
operator (`{SUM(a) - SUM(b)}` subtracts correctly), with one exception:
**`SUM`, `COUNT`, and `AVG`'s own argument is always read as a raw
array path**, never resolved as a nested function call or expression —
`{SUM(CONCAT(a, b))}` doesn't work, the argument has to be a plain path
like `rows.total`. Their *result*, though, can still be nested inside an
outer function just fine (`{CURRENCY(SUM(rows.total), "$")}` above
works because it's `CURRENCY` resolving its own argument, not `SUM`
resolving one).

**How an expression is read.** `*` and `/` bind tighter than `+` and `-`,
and parentheses group:

```
{qty * price + fee}      -> qty * price, then + fee
{(base + fee) * qty}     -> base + fee first, then * qty
```

One rule is unusual and worth knowing, because it is what lets a JSON key
contain a hyphen or a space: **an operator is only an operator when it has
whitespace on both sides.**

```
{my-key}    -> the path "my-key"       (not "my minus key")
{my key}    -> the path "my key"
{a - b}     -> subtraction
{a -b}      -> neither: the path "a -b", which usually resolves to empty
```

The same applies to the comparison operators inside `IF`: `IF(a == 2, …)`
is a comparison, `IF(a==2, …)` is a path called `a==2`.

An expression that cannot produce a number resolves to **empty** rather
than failing: `{"x" + 1}`, `{a / 0}`, and a path that does not exist all
behave that way (a missing path counts as `0` inside a sum, so
`{missing + a}` gives `a`). A **syntax error** — an unterminated quote, an
unclosed parenthesis — also resolves that field to empty rather than
failing the whole document: one stray comma cannot cost a 200-page
report. The position of the error is reported in the editor instead (the
field warning, and live inside the `ƒx` editor), which is where it can
still be fixed. `expressionError(source, t?)` gives you the same message
programmatically, and `parse` throws if you want the strict version.

`IF(condition, "then", "else")` picks one of the two remaining
arguments — `condition` is either a comparison (`status == "paid"`,
`total > 100`; operators `==`, `!=`, `>`, `>=`, `<`, `<=`, always
surrounded by spaces) or a bare path/expression, checked for
true/false (empty string, `"0"`, and `"false"` count as false,
anything else as true). Only the chosen branch is actually resolved —
`{IF(hasDiscount, discountAmount, "0")}` won't fail even if
`discountAmount` doesn't exist in the data when `hasDiscount` is false.

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

**Column widths** (`columnWidths`, mm, one sparse entry per column) — an
explicit width, set from a numeric input in that column's style panel or
by dragging the divider between two column headers on the canvas.
Columns without an explicit width split whatever's left of the table's
total width evenly; with `columnWidths` absent entirely, every column
still divides the width equally, same as before this existed.

**Per-block text alignment** — `headAlign`/`bodyAlign`/`footerAlign`
(`"left"` default/`"center"`/`"right"`) and `headVerticalAlign`/
`bodyVerticalAlign`/`footerVerticalAlign` (`"top"`/`"middle"`
default/`"bottom"`).

**Per-block corner rounding** — `headBorderRadius`/`bodyBorderRadius`/
`footerBorderRadius`, each a `TableCornerRadii` (`{ topLeft?, topRight?,
bottomLeft?, bottomRight? }`, mm; absent/`0` stays square). Only the
corners touching the table's outer edge apply per block (and that's all
the panel shows for it): header rounds its top corners, footer its
bottom corners, and body its bottom corners too, but only while there's
no footer — with a totals row on, the footer closes the bottom instead.

**Zebra striping** (`bodyBandColor`) — background color of odd data rows
(0-based); even rows keep `bodyBackgroundColor`. Absent = no striping.

**Ready-made style presets** (`TableSchema.colorPalette`) — a Palette
picker in the Style tab, grouped Light/Medium/Dark (blue/green/orange/
gray, plus purple in light/medium, and a `default`), same idea as
Excel's "Format as Table" (see `TABLE_PALETTES`/`TABLE_PALETTE_GROUPS` in
`tableColors.ts`). Picking one fills `headBackgroundColor`/
`headTextColor`/`bodyBandColor` at once — still editable by hand
afterward; `colorPalette` itself is only remembered for which preset
shows selected next time, `generatePdf` reads the actual color fields,
not the palette name.

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
`chart/colors.ts`): `"default"`, `"classic"`, `"modern"`, `"vibrant"`,
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

Each of the 4 sub-elements (icon/title/value/subtitle) is independently
**optional** — `title`/`value`/`subtitle` can simply be `undefined` (and
`icon` already had `"none"`), and a removed sub-element just isn't
drawn. Selecting a lone KPI card (not part of a multi-select) shows its
4 sub-elements in the Fields tab, each with a "+"/trash button to add it
back or remove it.

Any sub-element can also be **dragged to its own position** on the
canvas — `iconOffset`/`titleOffset`/`valueOffset`/`subtitleOffset`
(`{ x, y }` mm, relative to the card's top-left corner; absent = the
card's original fixed layout, so existing templates never change). Each
one is **locked** by default (`iconLocked`/`titleLocked`/`valueLocked`/
`subtitleLocked`, absent/`true` = locked) — unlock it via the lock icon
next to it in the Fields tab before dragging. Clicking a sub-element
(Fields tab or directly on the canvas) focuses it, and the Style tab
then shows only that element's own controls plus a "← Card style" link
back and, once it has a custom offset, a "Reset position" button that
clears it.

**Page size and orientation** — `<Designer>` shows a size selector
(A4/A3/A5/Letter/Legal) and orientation (portrait/landscape) in its
"Page" tab; `applyOrientation`/`orientationOf`/`matchPreset`/
`PAGE_SIZE_PRESETS` (exported) do the same math for anyone building
their own selector.

**Page background** (`Template.backgroundImage`) — an image behind
everything, both in the editor and in the final PDF. The "Background
image" button in `<Designer>` accepts PNG/JPEG and normalizes it to a PNG
data URI; the conversion lives in `fileToBackgroundImage` (exported
internally only, for now). PDF files aren't accepted: rasterizing one
would need pdf.js in the main entry (see the `/preview` entry below) — to
use a letterhead that only exists as a PDF, export its page to PNG
first.

**Custom font** — pass `fontBytes` (the bytes of a **real TTF/OTF**) to
`generatePdf(..., { fontBytes })` for full accent/Unicode coverage via
`fontkit`. Without it, it falls back to pdf-lib's default Helvetica
(WinAnsi — covers most Latin accents, but not everything).

`.woff`/`.woff2` (the format packages like `@fontsource/*` ship) are
also accepted — `normalizeFontBytes(bytes)` detects and decompresses
them into the real TTF/OTF that pdf-lib needs, automatically (WOFF v1
is simple enough to decompress in pure JS, no extra install needed —
`tiny-inflate`, a real dependency of this package. WOFF2 needs
`wawoff2`/WASM, which is an **optional peer dependency** — not
installed for you automatically, since most projects never embed a
custom font at all and the decompressor is a sizeable WASM binary
nobody should pay for by default. `npm install wawoff2` only if you
actually pass a `.woff2` file; passing a `.woff2` without it installed
throws a clear error telling you to install it or convert the font to
`.ttf`/`.otf` offline instead — nothing silently breaks). The resulting
file reorders its tables alphabetically (a normal trait of the WOFF
format, which doesn't keep the original physical order) — this doesn't
affect the font: same glyphs, metrics, and character mapping, validated
with `fontkit` (the same library pdf-lib uses under the hood to embed
the font).

**Ruler and zoom** — a mm ruler on the left/bottom of the canvas; a
floating bar at the bottom with zoom -/+, fit width/height, and reset —
doesn't affect the generated PDF, it's just the view. Drag/resize stays
correct at any zoom level (react-rnd receives the scale factor).

**Real PDF preview** (`<PdfPreview bytes={...} />`, from
`json-pdf-designer/preview`) — renders the generated PDF (byte for byte,
with pdf.js) into one `<canvas>` per page, showing the file's real
size/margins.

### The `json-pdf-designer/preview` entry point

Everything that touches pdf.js lives behind its own entry point:

```ts
import { PdfPreview, PdfPreviewModal, configurePdfWorker } from "json-pdf-designer/preview";
```

`pdfjs-dist` is an **optional peer dependency** (same treatment as
`wawoff2`), so npm doesn't install it for you — add it yourself if you
use the preview:

```bash
npm i pdfjs-dist
```

The reason it isn't a regular dependency: pdf.js is ~35MB installed, and
as a dependency of the main entry every consumer paid for it — including
apps that only render `<Designer>` and never preview anything. Nothing
reachable from `"json-pdf-designer"` or `"json-pdf-designer/server"`
imports pdf.js (a test, `test/entryBoundaries.test.ts`, enforces that), so
those two entries work with `pdfjs-dist` absent. `examples/no-preview`
is a working app that never installs it — its build also greps its own
bundle for pdf.js symbols, since the `file:../..` symlink would otherwise
let a leaked import resolve pdf.js from the parent repo.

Rendering the preview is the **only** thing the package uses pdf.js for.
Nothing else in the API depends on the preview being available.

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
import { configurePdfWorker } from "json-pdf-designer/preview";
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

## Conditional visibility (`visibleWhen`)

Any field can carry a condition. It is drawn only when that condition is true:

```ts
{ type: "text", content: "Corporate discount", visibleWhen: 'customer.type == "company"' }
{ type: "table", name: "overdue", visibleWhen: "NOT paid" }
{ type: "kpi", visibleWhen: "total > 1000 AND NOT cancelled" }
```

The condition is an **expression without braces** — it is not a template, so
write `total > 1000`, not `{total > 1000}`. Everything the `{...}` engine
understands works here: paths, comparisons, `AND`/`OR`/`NOT`, functions
(`COUNT(items) > 0`), arithmetic. Truthiness follows the format's rule: empty,
`"0"` and `"false"` are false, anything else is true — so a bare path works
too (`visibleWhen: "paid"`).

In `<Designer>` there is a **"Show only when"** input next to X/Y/width/height,
and a syntax error appears live underneath it.

**It works on every field type**, tables and repeated sections included, and on
the repeating bands (header/footer/margin). A band's condition may use
`pageNumber`/`pageCount`, because those are resolved per page — so "only on the
last page" is:

```ts
{ type: "text", content: "Please check the totals", visibleWhen: "pageNumber == pageCount" }
```

### What hiding does to the layout

Hiding an item gives back its **height**, and nothing else:

```
             visible                     "meio" hidden
  20mm  ┌───────────┐  topo        20mm  ┌───────────┐  topo
        └───────────┘  (10mm tall)       └───────────┘
  40mm  ┌───────────┐  meio
        └───────────┘  (10mm tall)
  60mm  ┌───────────┐  abaixo      50mm  ┌───────────┐  abaixo  <- moved up 10mm
        └───────────┘                    └───────────┘
```

What follows moves up by exactly the hidden height; the spacing authored on
both sides still applies. A hidden table gives back **all** of its pages the
same way.

One exception, and it is the useful one: hiding a field that shares a row with
visible neighbours leaves the hole. Fields at the same authored Y are one row —
the neighbours need their place, so the row keeps its height. Hide them all and
the whole row goes.

### An invalid condition means visible

A condition that does not parse counts as **visible**, never hidden. A typo must
not make a field vanish from a report in silence — the editor flags the field
(alert icon in the field list, message under the input) and the field keeps
showing until someone fixes it.

That is the same trade-off the `{...}` tokens make: **generation is tolerant,
the editor is strict.** A malformed expression renders empty rather than
failing `generatePdf` — one blank field is better than no document — and the
error surfaces before generating, where it can still be fixed.

To check it yourself (a backend refusing a bad template, or your own editor UI):

```ts
import { expressionError, templateExpressionErrors, expressionErrors } from "json-pdf-designer";
// all three also come from "json-pdf-designer/server"; the editor-UI-only helpers
// next to expressionErrors (fieldWarning, filterIncomplete) do not

expressionError("total > 1000");        // null — valid
expressionError("total >");             // "Expressão incompleta (posição 8 em …)"
templateExpressionErrors("a={x} b={y)"); // [{ token: "{y)", message: … }]
expressionErrors(schema, binding);       // every expression a field carries
```

## Multi-page reports (`Template.pages`)

By default a `Template` is one page design, repeated as many times as the
body needs (table/section pagination) — that's still true and unchanged.
Optionally, `Template.pages` lets ONE `Template` hold several
**different** page designs (own size, header/footer, background,
schemas) that `generatePdf` draws into a single PDF, one after another,
with `{pageNumber}`/`{pageCount}` continuing across them — page design #1
ending on physical page 2 makes page design #2 start at page 3, not
restart at page 1.

```ts
import { generatePdf, type Template } from "json-pdf-designer";

const template: Template = {
  page: { width: 210, height: 297 }, // ignored once `pages` is set
  schemas: [],
  pages: [
    { id: "cover", page: { width: 210, height: 297 }, schemas: [/* ... */] },
    { id: "detail", page: { width: 210, height: 297 }, headerHeight: 15, schemas: [/* ... */] },
  ],
};
const bytes = await generatePdf(template, data, bindings); // same call as always
```

- `data`/`Binding[]` are shared across every entry in `pages` — schema
  names must stay unique across the **whole** template, not just within
  one page.
- A `Template` without `pages` (every template from before this feature
  existed) behaves exactly as before — `pages` absent or empty falls back
  to the flat `page`/`headerHeight`/`footerHeight`/`schemas` fields as a
  single implicit page, so nothing already saved needs migrating.
- The `report-builder` example (see "Examples" below) builds a page-tabs
  UI on top of this: each tab edits one entry of `template.pages` with
  its own `<Designer>`, while the JSON data sources stay shared/global
  across all tabs.

## Writing an expression: the `ƒx` editor

`<Designer>` has a `ƒx` button next to every field that accepts an expression:
a table column formula, each cell of the totals row, the KPI's
title/value/caption, and a text field's content. It opens a window with

- **the fields the schema is bound to, on the left**, in two groups. Fields
  **of each item** of the bound array (`total`, no prefix) are what resolve
  inside a table row or a repeated section; the **full data paths**
  (`invoices.total`) are what an aggregation needs. `SUM(total)` from the first
  group would find nothing — the two scopes are the reason the list is split.
- **a multi-line editor with autocomplete**, offering the functions above plus
  `AND`/`OR`/`NOT` with the hint for each. It writes the spaces an operator
  needs on both sides, so it cannot produce a one-sided operator. Suggestions
  appear only **inside** the braces — outside them you are writing literal
  text, and a list of functions there is only in the way.
- **live validation** — the same messages the editor's field warning shows.
  A syntax error blocks saving; a suspicious operator only warns.

The editor holds the **field value itself**, braces included, opened with
whatever was already there. There is no separate compose box: you edit in
place, and a literal prefix stays where it is (`FAT-{invoice}`). Clicking a
field on the left inserts the bare path inside braces, or `{path}` outside
them.

It also reports an **unbalanced brace**, which nothing else does: the template
resolver matches `/\{([^{}]+)\}/g`, so a `{` with no pair simply does not
match and that stretch comes out as literal text in the PDF —
`{CURRENCY(total` printed as-is. It is not an expression syntax error (the
parser never sees that stretch) nor a generation failure; it was just a field
coming out wrong in silence.

The pieces are exported for a custom UI: `suggestAt`, `applySuggestion`,
`insertAtCaret`, `wordAtCaret`, `ALL_SUGGESTIONS`, plus `tokenAtCaret` and
`braceError` for the brace side (`json-pdf-designer/server` too — they are
pure).

## Ready-made UI components

If you don't want to (or can't) build your own visual shell around
`<Designer>`, the package also exports the ready-made components it uses
internally (`Button`, `Card`, `Input`, `Checkbox`, icons, etc — same look
as the property panel) and a complete `PdfPreviewModal` (that one from the
`/preview` entry, since it uses pdf.js):

```tsx
import { Button, Card, CardHeader, CardTitle, Badge, Input, ColorInput, Textarea, Select, Checkbox } from "json-pdf-designer";
import { PdfPreviewModal } from "json-pdf-designer/preview";
import "json-pdf-designer/theme.css";

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

Every one of them takes `className` (merged with ours, yours last),
`style` (yours wins) and the rest of the native element's props. The ones
that render more than one element expose the inner ones through `parts`,
addressed by **role**. The rule is worth stating once because it decides
where anything you pass lands: **`className`/`style`/`...rest` go to the
element that gives the component its name; every other element it renders
is addressed through `parts`.** So `Input.className` still lands on the
`<input>` (same as 2.x) and its `<label>` wrapper is `parts.root`;
`Modal.className` is the panel and the dimmed backdrop is `parts.overlay`.
`parts` accepts only `className`/`style` — no handlers, no refs — with a
string shorthand (`parts={{ label: "my-class" }}`) and an object form when
you need `style` too.

Three 3.0.0 changes worth knowing before you upgrade:

- They **forward `ref`** now, so they are no longer plain functions:
  `Button.name` stops being `"Button"`, and calling `Button(props)`
  directly stops working. It is `forwardRef` rather than React 19's plain
  `ref` prop because React 18 is still a supported peer.
- The **20 icons are the exception** — still plain functions, no ref — and
  their props widened from `{ className }` to `IconProps`, which is
  `SVGAttributes`. Deliberately *not* `SVGProps`: that extends
  `ClassAttributes` and would accept a `ref` that goes nowhere, so the type
  would be lying.
- **`Modal`'s `maxWidthClass` became `size`** —
  `"sm" | "md" | "lg" | "xl" | "full"`, default `"lg"` = 48rem, exactly
  what the old `max-w-3xl` gave. A Tailwind class string had no business in
  the public API of a package that no longer ships Tailwind. An arbitrary
  width is `style={{ maxWidth: 900 }}`, which now reaches the panel.

Newly public, all previously internal: `Checkbox` (it closes a real gap —
the editor had three bare `<input type="checkbox">`), `PalettePicker`,
`PaletteSwatches`, `MaterialIcon`, `CollapsibleSection` and
`ClearFieldButton`. `BulkLocked` stays internal on purpose: it means
"locked because you selected several fields of the same type", which is a
*mode* of `<Designer>` — outside that context it means nothing.

## Composing the editor

`<Designer>` is a **preset**. Since 3.0.0 that is all it is: three
providers and two parts in a two-column layout, 101 lines where it used to
be 986. Its seven original props are unchanged, and `gridSizeMm`,
`expandOnSelect`, `className`, `style` and `components` are optional
additions. If the two-column shell is what you want, nothing here is
required — keep using it.

If you want to decide where each piece goes, mount the state provider
yourself and position the parts:

```tsx
import { DesignerProvider, DesignerCanvas, DesignerFieldList, DesignerPropertyPanel, DesignerToolbar } from "json-pdf-designer";

<DesignerProvider template={template} onChangeTemplate={setTemplate} bindings={bindings} onChangeBindings={setBindings}>
  <DesignerToolbar className="my-toolbar" hint={false} />
  <div className="my-grid">
    <DesignerFieldList />
    <DesignerCanvas />
    <DesignerPropertyPanel section="dados" />
  </div>
</DesignerProvider>
```

### `<DesignerProvider>`

Holds all the editor state. Every part below needs one above it — and only
that one: `I18nProvider` is optional (the context default is English) and
`UiComponentsProvider` is optional (the default is our own primitives).

| Prop | Type | Notes |
|---|---|---|
| `template` | `Template` | required |
| `onChangeTemplate` | `Dispatch<SetStateAction<Template>>` | takes React's `setState` directly — the functional form is used internally, so two fields added in quick succession can't clobber each other through a stale closure |
| `bindings` | `Binding[]` | required |
| `onChangeBindings` | `Dispatch<SetStateAction<Binding[]>>` | same |
| `onCanvasDrop` | `(e: DragEvent<HTMLDivElement>) => void` | passthrough to the canvas container, for dropping external fields (a JSON field explorer) onto the page |
| `dataSources` | `DataSourceOption[]` | known arrays of the sample JSON — becomes the "Data source" dropdown in a table binding. Without it, paths are typed free-hand |
| `gridSizeMm` | `number` | grid step in mm, default 5 |
| `expandOnSelect` | `boolean` | clicking a field reopens a collapsed sidebar, default `true` |
| `children` | `ReactNode` | required |

### The ten placeable parts

Every part takes `className` (merged with ours, yours last), `style`
(yours wins) and `whenTab`. Several take `parts` (inner elements, by role)
and a flag or two:

| Part | Beyond `className`/`style`/`whenTab` |
|---|---|
| `DesignerCanvas` | — |
| `DesignerTabBar` | `parts.strip` — the strip that *scrolls* (just the tabs; the arrows and the "+" sit outside it) |
| `DesignerFieldList` | `heading` (default `true`), `parts.heading`, `parts.scroll` — the scrolling box, which is where the max height lives |
| `DesignerToolbar` | `hint` (default `true`) — the "select a field…" line above the buttons |
| `DesignerPageSettings` | — |
| `DesignerPropertyPanel` | `section` (`"dados"` \| `"estilo"`, default `"dados"`), `position` (default: on only when `section="dados"`), `header` (default `true`), `parts.banner` |
| `DesignerFilterPanel` | `header` (default `true`), `parts.banner` |
| `DesignerBindingEditor` | — |
| `DesignerInspector` | — |
| `DesignerSidebar` | `parts.tabBar`, `parts.panel` — and **no `whenTab`** |

`DesignerSidebar` is the convenience one: it composes the seven content
parts with the same per-tab gate the preset uses, so it is the whole right
column of `<Designer>` in a single element.

### `whenTab` is opt-in, and that is the point

Without `whenTab`, a part renders **always**. Pass `whenTab="pagina"` (or
an array of keys) and it only appears on those tabs — which is exactly how
`DesignerSidebar` and `<Designer>` reproduce today's tabbed behaviour. The
keys are `"campos" | "dados" | "estilo" | "filtro" | "pagina" | "inspetor"`.

The default matters more than it looks. If gating were the default,
`DesignerPropertyPanel` and `DesignerPageSettings` side by side in your own
layout would erase one of the two, because only one tab can be active at a
time. They would be parts that *look* decomposed but only work inside a
tabbed sidebar — which cancels the feature outright.

`DesignerPropertyPanel`'s `section` follows the same logic: it is a **prop**,
not a read of the active tab. Two instances with different `section` values
render together, which is how you get "Data" and "Style" as two cards
instead of two tabs. If it read the tab, the second instance would vanish.

### The ten hooks

Five accessors return a context value as-is; five selectors *derive* from
one. They only work inside a `<DesignerProvider>` — outside, they throw
with a message naming the provider rather than returning `null`, because a
part with no state has no fallback behaviour at all: it would simply not
render, and you'd be staring at a hole in the screen with no clue why.

```ts
// accessors
useDesignerData()            // { template, bindings }
useDesignerActions()         // every mutator (addSchema, updateSchema, moveGroup, handleChangeBinding, …)
useDesignerSelection()       // selectedId, selectedIds, handleSelect, handleSelectMany, …
useDesignerUi()              // sidebarTab, sidebarCollapsed, tabOrder, isolateBands, backgroundUploadError, …
useDesignerConfig()          // dataSources, onCanvasDrop, gridSizeMm, expandOnSelect

// selectors
useDesignerSelectedSchema()  // { selected, selectedBinding } — the last-clicked field and its binding
useDesignerFieldListSchemas()// Schema[] — what the list should show (mirrors the canvas)
useDesignerBulkEdit()        // { selectedSchemas, bulkEditActive }
useDesignerTabWarnings()     // { dadosWarning, filtroWarning }
useDesignerFilterColumns()   // string[] — columns available to the filter panel
```

**Read only what you use.** The five contexts are split by *frequency of
change*, not by topic: `data` changes on every edit (the hottest),
`selection` on every canvas click, `ui` on every tab switch or collapse,
`config` when the provider's props change (almost never) — and `actions`
**never changes identity** for the life of the provider. That last one is
the load-bearing part of the split: it is what lets a memoized part consume
a mutator without re-rendering every time the template changes. One single
context would re-render every part on every keystroke in a text field.

Derived values are selectors rather than context entries for the same
reason: if `selected`/`bulkEditActive`/`fieldListSchemas` lived in the data
context, its value would change identity whenever *any* of them changed,
and every part reading data would re-render because of a derived value it
never touches.

### What is not a part, and why

Not everything was decomposed, and each omission is a decision rather than
a gap:

- **`FieldBox/*` and the per-type `PropertyPanel{Text,Table,…}`** are
  dispatched by `schema.type`. A standalone `<DesignerTextPanel/>` has no
  answer to "which schema?" other than "the selected one" — at which point
  it is a worse `DesignerPropertyPanel`.
- **The `TabPanel` collapse** (double-click the active tab) lives only in
  `DesignerSidebar`. The `1fr`→`0fr` grid trick needs a flex-column parent
  with `min-block-size: 0`, which a standalone part cannot guarantee: it
  would animate wrongly in silence instead of degrading.
- **The Delete / Ctrl+C / Ctrl+V bindings** are registered exactly once, by
  the provider. In a part, whoever doesn't render the canvas would silently
  lose the shortcuts; in two parts, every paste would fire twice.

### Who owns what on the canvas

`DesignerCanvas` owns the **sheet geometry** — mm→px, `transform:
scale(zoom)`, `transformOrigin` — and that is not negotiable: `react-rnd`
receives `scale={zoom}` and computes the drag delta *against* that
transform, so overriding it makes the field run away from the cursor.

You own the **scrolling viewport**, and that is what this part's
`className`/`style` reach: the outer box, not the sheet. You also own the
sidebar's width — it is `inline-size: 20rem` on `.jpd-sidebar` in
`theme.css`, a stylesheet rule you can override, not a value hard-coded in
the part. Panel width is a layout decision, and layout is yours.

Zoom stays internal state of `<PageCanvas>` and never moved into a
context, on purpose: dragging the slider would re-render every part if the
value lived in the provider.

### A complete example

`examples/composed-layout` (port 5177) is the layout that is impossible
with the preset: a full-width toolbar on top, the field list on the left,
the canvas in the middle, and a right column with **five stacked panels**
that inside `<Designer>` would be five different tabs. No part receives
`whenTab`, so eight parts are in the DOM at once and there is no
`.jpd-tabs` anywhere.

```tsx
import { useState } from "react";
import {
  DesignerBindingEditor, DesignerCanvas, DesignerFieldList, DesignerInspector,
  DesignerPageSettings, DesignerPropertyPanel, DesignerProvider, DesignerToolbar,
  downloadPdf, generatePdf, type Binding, type Template,
} from "json-pdf-designer";
import "json-pdf-designer/theme.css";

export default function App() {
  const [template, setTemplate] = useState<Template>(initialTemplate);
  const [bindings, setBindings] = useState<Binding[]>(initialBindings);

  return (
    <DesignerProvider
      template={template}
      onChangeTemplate={setTemplate}
      bindings={bindings}
      onChangeBindings={setBindings}
      dataSources={dataSources}
      // No sidebar to reopen, so the provider shouldn't try.
      expandOnSelect={false}
    >
      <div className="app">
        {/* Full width — the preset never does this (there the toolbar sits
            at the foot of the sidebar). `hint={false}` because "select a
            field in the list" has no referent here: the list is in another
            column. */}
        <DesignerToolbar className="app-toolbar" hint={false} />

        <div className="app-body">
          <aside className="app-left">
            <h2 className="app-h2">Fields</h2>
            {/* `heading={false}`: the title is already above, in our own CSS.
                `parts.scroll` overrides the list's max height — inside
                <Designer> it is short because it shares the sidebar with the
                toolbar; here the column is all its own. */}
            <DesignerFieldList heading={false} parts={{ scroll: "app-list-scroll" }} />
          </aside>

          {/* The canvas owns the sheet geometry; THIS box is the scrolling
              viewport, and it is ours. */}
          <DesignerCanvas className="app-canvas" />

          <aside className="app-right">
            {/* Both halves of the property panel, side by side — this is what
                `section` exists for. Inside <Designer> they are the "Data" and
                "Style" tabs. */}
            <section className="app-card">
              <h2 className="app-h2">Field data</h2>
              <DesignerPropertyPanel section="dados" />
            </section>
            <section className="app-card">
              <h2 className="app-h2">Field style</h2>
              {/* `header={false}` so the field name isn't repeated — the card
                  above already shows it. */}
              <DesignerPropertyPanel section="estilo" header={false} />
            </section>
            <section className="app-card">
              <h2 className="app-h2">JSON binding</h2>
              <DesignerBindingEditor />
            </section>
            <section className="app-card">
              <h2 className="app-h2">Page</h2>
              <DesignerPageSettings />
            </section>
            <section className="app-card">
              <h2 className="app-h2">Inspector</h2>
              <DesignerInspector />
            </section>
          </aside>
        </div>
      </div>
    </DesignerProvider>
  );
}
```

`examples/report-builder` was migrated to the parts too, and there the
layout is **identical** to the preset's — which makes it the useful
comparison, because what the migration bought is not layout. It is
`<SelectedFieldBar>`: the app's *own* chrome reading the editor's selection
through a hook, which was impossible in 2.x (the old comment in its
`App.tsx` said as much — `<Designer>` owned the selection and there was no
prop to drive it from outside). "Remove" in the app's own bar takes the
template from 3 fields to 2, and the app's own Ctrl+Z undoes it (2→3):
the package's mutator goes through the consumer's `setState`, so the
consumer's undo/redo sees it.

## Swapping the primitives

Every button, input, select and modal the editor renders **inside** itself
resolves through one registry, so you can put your own design system's
components in there — not just around the editor:

```tsx
import { UiComponentsProvider, defaultUiComponents, type ButtonProps, type UiComponentsOverride } from "json-pdf-designer";
import { Button as MuiButton } from "@mui/material";

// MODULE constant — see the warning below.
const MY_KIT = {
  Button: ({ variant = "primary", size = "sm", label, ...rest }: ButtonProps) => <MuiButton {...rest} />,
} satisfies UiComponentsOverride;

<UiComponentsProvider components={MY_KIT}>
  <Designer template={t} onChangeTemplate={setT} bindings={b} onChangeBindings={setB} />
</UiComponentsProvider>
```

`<Designer components={MY_KIT}>` is sugar for exactly that provider.
`useUiComponents()` is how a part of your own resolves the same registry,
and `defaultUiComponents` holds ours.

### The twelve slots

`Button`, `Input`, `ColorInput`, `Select`, `Textarea`, `Checkbox`,
`Modal`, `Card`, `CardHeader`, `CardTitle`, `Badge`, `TabPanel`.

The set is **closed** on purpose: each key is public, permanent contract.
Replacement is partial — anything you don't pass stays ours — and the merge
is key-by-key against the *parent* provider, so you can define the app's
vocabulary at the root and override just `Modal` in one corner.

`components={{ Button: MuiButton }}` does **not** type-check directly (MUI's
`variant` conflicts with ours), and no trick fixes that. The target is a
~5-line adapter typed on both ends — which is why every `*Props` is
exported, every non-DOM prop is optional, and the example above uses
`satisfies UiComponentsOverride` rather than a type annotation.

### `undefined` means inherit, not "back to default"

A key set to `undefined` is **pruned**: `{ Modal: cond ? Fancy : undefined }`
means "inherit from the parent provider", not "use the package's own". To
go back to ours explicitly, name it:
`{ Modal: defaultUiComponents.Modal }`.

### The gotcha: your adapter receives the props as the *caller* wrote them

Defaults live inside *our* components. `<Button>` destructures
`{ variant = "primary", size = "sm" }` in its own signature, so a call site
that writes just `<Button>ok</Button>` hands your adapter
`variant: undefined` — not `"primary"`. Measured: of the Toolbar's six
buttons, **five** arrive with no `variant` at all.

An adapter that translates our values into your design system's therefore
needs its own defaults. The editor's, to copy: `Button` `variant="primary"`
`size="sm"`; `Modal` `size="lg"`; `TabPanel.collapsed` is required and has
no default. Everything else non-DOM is optional and undefaulted — absent
means "don't show it" (`label`, `parts`, `mono`).

Two contract points that bite in practice:

- **`label` is the prop that matters most.** A slot that drops `label`
  removes the accessible name from about 16 controls. MUI's `TextField` has
  a compatible `label`; Chakra's `Input` does not.
- **`Textarea` is the one slot where ignoring `ref` breaks something**: the
  formula modal passes a ref to reposition the caret after you accept a
  suggestion. Every slot's type accepts a `ref`; a plain function component
  of yours is still assignable (accepting *fewer* props is allowed), it just
  ignores the ref — which is documented "may ignore" everywhere except here.

### Unstable identity is the sharpest edge

> An inline object creates a **new component type on every render**, and
> React unmounts and remounts anything whose identity changed. The symptom
> is *the input loses focus on every keystroke*, which nobody connects back
> to the registry. Hoist the map to a module constant, or memoize it.
> Outside production the provider logs a one-time console warning naming
> the slots whose identity changed.

This is also why the registry is its own context, separate from the
editor's state: a slot value is a *component type*, so if the map lived in
the state context, every state change would rebuild the value, identities
would churn, and every slotted primitive would remount. With a separate
context and a memoized `components` prop, that is structurally impossible.

One invariant follows from it: **no slottable primitive calls
`useUiComponents`.** Otherwise the most obvious adapter there is — wrapping
*our* component to tweak something —

```tsx
{ Button: (p) => <Button {...p} className={cx("mine", p.className)} /> }
```

would recurse forever. Only the chrome and the composites read the
registry, and a source scan in `test/uiSlots.test.tsx` keeps it that way.

### Not slottable

- **`PageCanvas`/`Ruler`/`FieldBox`** — they are the mock-up of the PDF. A
  foreign primitive's padding breaks the WYSIWYG.
- **The tab bar** — 2.1.1 was spent fitting six tabs into 290px; a slotted
  Button's `min-width` undoes that.
- **The field list's rename input** — depends on `autoFocus` plus commit on
  `onBlur`.
- **The hidden file input, the "ƒx" glyph, the icons.**

`PdfPreviewModal` does **not** inherit primitives from a `<Designer>`
elsewhere on the page: it lives in the `/preview` entry and resolves from
the nearest `UiComponentsProvider`.

## Styling and theming

The editor's markup is stable, documented surface: `.jpd-*` classes for
structure, `data-*` attributes for state, `--jpd-*` custom properties for
values. All three are contract — that is what makes styling from scratch a
supported mode rather than a hack.

### The styling spectrum across the five examples

Each example app in `examples/` sits at a different point on the
spectrum, and no two share a point — between them, both CSS exports get
exercised plus the mode that imports neither:

| Example | Package CSS it imports | What it proves |
|---|---|---|
| `report-builder` | `theme.css` | the ready-made path: the theme as it ships, zero customization |
| `composed-layout` | `theme.css` | **retheme by token alone** — the whole theme in, not one rule rewritten |
| `no-preview` | `theme.css` | **dark mode**, with a toggle; the only app in the repo that exercises dark, and it starts dark |
| `headless-designer` | `reset.css` **only** | the appearance-free export; the only example that takes it |
| `custom-ui` | none | 192 `.jpd-*` selectors written from scratch in its own `index.css` |

The table is guarded: `test/docsFreshness.test.ts` reads the real
`import "json-pdf-designer/*.css"` lines out of every example and fails
if one of them moves without this table moving too. Nothing else would
warn — the example compiles and runs either way, and only the prose would
be wrong.

**Retheming by token is the cheapest point on it.** `composed-layout`
imports `theme.css` whole and writes no `.jpd-*` rule at all; its
`index.css` only sets token values on its own `:root`:

```css
:root {
  --jpd-accent: oklch(54.1% 0.245 292.717);              /* violet-600, was sky-600 */
  --jpd-accent-solid: oklch(54.1% 0.245 292.717);
  --jpd-accent-solid-hover: oklch(49.1% 0.27 292.581);   /* violet-700 */
  --jpd-radius-md: 3px;
  --jpd-radius-lg: 4px;                                  /* the default is 0.5rem */
}
```

Measured in the browser afterwards: `.jpd-btn[data-variant="primary"]`
computes `background-color: oklch(0.541 0.245 292.717)` and
`border-radius: 4px`, against sky-600 and 8px from the stock theme. Every
button, tab, input, callout and canvas band followed, and not one
selector was written. It works because `theme.css` declares its tokens on
`:root`, and a `:root` declaration in *your* CSS — outside any `@layer` —
beats a layered one. It is also the reason the tokens are **not** scoped
to `.jpd-designer`: `<Modal>` renders through
`createPortal(document.body)`, and scoped tokens would leave every
portalled modal without a theme (same root cause as the scoped-dark-island
limitation under ["Dark mode"](#dark-mode)).

**Dark mode is one attribute driving two layers.** `no-preview` is the
only app in the repo that exercises dark, and it defaults to it: a
`data-jpd-theme` attribute on `<html>`, toggled from its header and
persisted in `localStorage`. `theme.css` redefines the `--jpd-*` tokens
under `[data-jpd-theme="dark"]`, and the example declares its own
`--app-*` variables under the same key, so the app shell follows the
editor with no second mechanism. Measured on the toggle: 6 of 6 sampled
properties flip together — `body` background, `.app-sidebar` and
`.panel-title` on the shell, `.jpd-sidebar` and `.jpd-ruler__tick` inside
the editor.

**The bare reset carries no appearance, and one token is read inline.**
`headless-designer` is the only example on `reset.css` alone, and it can
afford that because it never renders `<Designer>`: it builds its own
canvas and takes only `<PdfPreview>` from the package, whose entire
styling surface is four names — `.jpd-error`, `.jpd-error--md`,
`.jpd-preview__count` and the token `--jpd-shadow-page-preview`. Writing
that appearance by hand is about five rules. Measured there: 54 rules
arrived from the package (the reset, and nothing else), and
`--jpd-accent`/`--jpd-surface` compute to the **empty string** — they are
appearance tokens, and only `theme.css` declares them. Of `<PdfPreview>`,
`reset.css` covers exactly one thing: `margin: 0` on `.jpd-error`. Color
and size are the consumer's.

> **The trap in reset-only mode, and it fails silently.** `PdfPreview`
> sets the page shadow **inline**, not through a class:
>
> ```ts
> canvas.style.boxShadow = "var(--jpd-shadow-page-preview)";
> ```
>
> `reset.css` declares no appearance token, so unless *you* declare that
> one, the `var()` is invalid, the whole declaration is dropped, and the
> preview renders with no shadow and nothing in the console.
> `headless-designer` declares its own — computed
> `rgb(15, 23, 42) 0px 2px 0px 0px, rgb(15, 23, 42) 0px 0px 0px 1px`, its
> shadow rather than the theme's diffuse one — and a test keeps it there.
> This is the only place a component reads a token directly instead of
> letting a rule read it, so it is the one token the appearance-free mode
> cannot skip. If you take `reset.css` alone and use `<PdfPreview>`,
> declare `--jpd-shadow-page-preview`.

### Class names and state attributes

The convention is `jpd-block__element--modifier`, one element level deep:
**194 distinct `.jpd-*` selectors across 80 blocks**, counted in
`theme.css` + `reset.css`. State is **never** a class — it is a `data-*`
attribute. The rule that produced that split: if the JSX would have to
*concatenate* or *choose* a class string, it's a `data-*` instead.

```css
.jpd-btn[data-variant="ghost"] { … }
.jpd-field[data-selected] { … }
.jpd-tab[data-active="true"] { … }
.jpd-fieldrow[data-absent] { … }
.jpd-band[data-band="header"] { … }
```

### Tokens

**125 custom properties, 122 of them public.** The largest families, by
count: `--jpd-accent-*` (14), `--jpd-text-*` (13), `--jpd-section-*` (12),
`--jpd-space-*` (10), `--jpd-font-*` (9), `--jpd-surface-*` (8),
`--jpd-danger-*` (7), `--jpd-canvas-*` (6), `--jpd-shadow-*` (6),
`--jpd-line-*` (5), `--jpd-radius-*` (5), `--jpd-border-*` (4),
`--jpd-callout-*` (4), `--jpd-ruler-*` (3), `--jpd-z-*` (3). Overriding one
of them is the intended way to theme:

```css
:root {
  --jpd-accent: #7c3aed;
  --jpd-surface: #fdfdfd;
  --jpd-radius-md: 2px;
}
```

`theme.css` is the list — it is unminified precisely so you can read the
names off it rather than guess them. The remaining **three** are internal
knobs of a single component each (`--jpd-_btn-ring`, `--jpd-_modal-max`,
`--jpd-_swatch-size`); the leading underscore is what keeps the public list
readable. Spacing is in `rem`, not px, so it scales with the user's root
font size.

### The `@layer`, and its consequence

Everything in `theme.css` and `reset.css` lives inside
`@layer json-pdf-designer`. Unlayered CSS beats layered CSS regardless of
specificity, so **every rule you write beats ours by default** — including
a class you pass through `className`. That is the whole reason accepting
`className` means anything: without the layer, our `.jpd-input` would win
over the `p-4` you passed.

Both files also declare `@layer json-pdf-designer, utilities;` before any
rule, so our layer sorts lowest no matter which stylesheet you import
first. (Measured, before that line existed: an example app's `bg-sky-600`
computed to `rgba(0,0,0,0)` because our reset won.) Using a differently
named layer? Declare your own order before importing — the rule is the
same:

```css
@layer json-pdf-designer, my-utilities;
```

The side effect is worth naming: a **bare element selector** wins too, and
reaches the editor's chrome. A loose `button { padding: 1rem }` in your app
will land on the editor's buttons. This is **not new in 3.0.0** — 2.x's
`dist/style.css` was Tailwind v4 output, which also emits
`@layer utilities`, so a bare selector already beat it there. The advice is
the same as it always was: scope by class, and aim at `.jpd-*` deliberately
when you *do* want to restyle the editor.

To beat `theme.css` on purpose, load your CSS after it, or use `style`.
What no longer decides anything is the **order of tokens inside the `class`
attribute** — that was a Tailwind property, and Tailwind is gone.

### Dark mode

Two hooks, and they paint identically (verified in the browser):

```html
<html data-jpd-theme="dark">   <!-- the documented hook -->
<html class="dark">            <!-- alias, kept because 2.x consumers already set it -->
```

`[data-jpd-theme="light"]` forces light. Either attribute works on any
ancestor, not just `<html>`.

There is **no media query**, on purpose: a library shouldn't turn a
light-only app dark because the OS is. If you want to follow the OS, read
it and write the attribute yourself:

```ts
const mq = matchMedia("(prefers-color-scheme: dark)");
const apply = () => document.documentElement.setAttribute("data-jpd-theme", mq.matches ? "dark" : "light");
apply();
mq.addEventListener("change", apply);
```

**One limitation to know.** A *scoped* dark island — the attribute on a
container rather than on `<html>` — does not reach a portalled modal:
`<Modal>` renders through `createPortal(document.body)`, so it is outside
your container in the DOM. The tokens live on `:root` precisely for that
reason. If you need a scoped island *and* dark modals, set the attribute on
`<html>` (or on `document.body`) instead.

## Template versioning (`Template.version`)

A `Template` is a **document format**, not an internal structure. Once it
lives in a database it outlives any given version of this package, so it
carries a format version:

```ts
type TemplateVersion = 1;

type Template = {
  version?: TemplateVersion; // absent = 1
  page: PageSize;
  // ...
};
```

`version` is the version of the **JSON format**, not of the npm package — the
package goes 2.0.0 → 2.1.0 → 3.0.0 without the format changing. It only moves
when the shape of the saved document does.

`migrateTemplate(input)` normalizes a template from anywhere (a database, a
file, an API) into the format this build understands:

```ts
import { migrateTemplate } from "json-pdf-designer";        // or /server

const template = migrateTemplate(await db.templates.find(id));
```

- A template with no `version` is treated as format 1 — exactly right for
  every template saved before the field existed, since no shape change has
  happened since.
- The returned template always carries the current `version`, so saving it
  back writes it explicitly and the next load stops depending on the default.
- It never mutates the input.
- A `version` **higher** than this build understands **throws**. That is
  deliberate: the file was written by a newer package and may contain fields
  this build would silently ignore, and a PDF missing a piece with no error is
  worse than a failure.

`generatePdf` calls it internally, so a PDF is never generated from an
unmigrated template — you do not have to remember. Call it yourself when you
load a template **to edit**, so the editor also works on the current format
(see `parseProjectFile` in `examples/report-builder/src/lib/projectFile.ts`).

Migrations live in one chain in `src/template/migrate.ts`, one step per
version, never as `if (version === 1) … if (version === 2) …` spread across
callers. The chain is empty today because there is one format — it exists
*now* because introducing it after templates are already in production
databases costs far more.

## What can and cannot fail a generation

`generatePdf` draws one line: a problem in the **data**, or in malformed
content, degrades — the field renders empty, a character is replaced, the PDF
comes out. A **structural** problem, or one where content would silently
disappear from a document someone signs, fails loudly. A 200-page report must
not die because one row had a `\n` in it.

**Degrades (the PDF comes out):**

| Situation | What happens |
|---|---|
| Control character in the data (`\n`, `\t`, NUL, C0/C1) | Replaced with a space. No font has a glyph for these, so it is the only possible rendering |
| Invalid `{...}` expression | That token renders empty; the editor flags the field |
| Path that does not resolve | Empty |
| `data` that is null, an array, a string, a number | Ignored; fields render empty |
| Bound array that is a number, items that are not objects, a cell whose value is an object | Ignored or stringified |
| Invalid colour (`"banana"`, `"#zzz"`) | Falls back to the default |
| `fontSize` that is 0, negative or `NaN` | 0/negative are honoured; `NaN` falls back to 10 |
| A field width of 0 or negative | Honoured (nothing is drawn) |
| Image binding resolving to something that is not a data URI | Field stays empty |
| A section repeat taller than a whole page | Placed anyway, overflowing that page; the next repeat starts on a new one |

**Fails loudly (and why):**

Every one of these is a **typed class** with a literal `code`, exported from
both `json-pdf-designer` and `json-pdf-designer/server`. The column below is
what you match on — never `error.message`, which is an English diagnostic
string and may be reworded in a patch release.

| Situation | Class (`code`) | `blame` | Why not degrade |
|---|---|---|---|
| Character with no glyph in the **standard** font (emoji/CJK without `fontBytes`) | `UnsupportedGlyphError` (`unsupportedGlyph`) | `data` | It *does* have a glyph in a complete font — dropping it would silently remove content from a signed document. Pass `fontBytes`, or take it out of the data |
| Invalid page size (`NaN`, 0, negative) | `InvalidPageSizeError` (`invalidPageSize`) | `template` | Structural: there is no sensible default to guess |
| Corrupt image in a field | `ImageUnreadableError` (`imageUnreadable`) | `template` | The author picked that file; silently dropping it hides the mistake |
| Corrupt image as the page background | `BackgroundImageUnreadableError` (`backgroundImageUnreadable`) | `template` | Same, and a missing letterhead is not obvious from the output |
| Image format that is not PNG or JPEG | `UnsupportedImageFormatError` (`unsupportedImageFormat`) | `template` | Re-upload through the editor, which converts |
| A single image over 15MB (decoded) | `ImageTooLargeError` (`imageTooLarge`) | `template` | Protects whoever is generating — a template can come from an untrusted source |
| More than 200 **distinct** images in one document | `TooManyImagesError` (`tooManyImages`) | `template` | Same. Identical images are deduped by content first, so this counts real ones |
| An upload over 20MB, or one the browser cannot read | `ImageUploadTooLargeError` / `ImageUploadUnreadableError` | `data` | Caught at upload, before it can reach a template |
| Document over `maxPages` (default `DEFAULT_MAX_PAGES`, 5000) | `PageLimitError` (`pageLimit`) | `data` | A truncated report that looks complete is worse than no report. Filter the data, split into several PDFs, or raise `maxPages` |
| A pagination pass that consumes nothing | `PaginationStalledError` (`paginationStalled`) | `package` | Arithmetic bug in the package — spinning until a counter ran out used to hide it |
| `.woff2` passed where the runtime cannot decompress it | `Woff2SupportMissingError` / `FontDecompressFailedError` / `FontDecompressTimeoutError` | `config` | An environment problem, not a template one |
| `Template` that is not an object, or a `version` that is not a number | `TemplateNotAnObjectError` / `TemplateVersionInvalidError` | `template` | There is nothing to migrate from |
| `Template.version` newer than this build | `TemplateVersionTooNewError` (`templateVersionTooNew`) | `template` | A newer format may carry fields this build would ignore in silence |
| A migration step missing between two versions | `TemplateMigrationMissingError` (`templateMigrationMissing`) | `package` | Our gap, not yours |
| Invalid `fontBytes` (`Unknown font format`) | **not ours** — pdf-lib throws it | — | Caller error, not template or data. See the `null` case below |

### Handling one

Three lines, and the order matters:

```ts
import { describePdfError, dictFor, PageLimitError } from "json-pdf-designer/server";

try {
  const bytes = await generatePdf(template, data, bindings, { fontBytes });
} catch (err) {
  // 1. A specific case you want to treat specially — by class, not by message.
  if (err instanceof PageLimitError) return splitAndRetry(err.maxPages);

  // 2. Everything else: one call turns it into copy a person can read.
  const problem = describePdfError(err, dictFor("en"));
  //    → { code, blame, title, action?, field?, detail } | null
}
```

`describePdfError` is exhaustive, so there is no "I did not recognise this
one" branch inside it. It returns **`null`** for an error that is not the
package's — the `Unknown font format` row above is exactly that case — instead
of inventing a title for a failure it does not understand. Keep your own copy
for your own errors, and fall through to a generic only when both come up
empty.

If you want the narrowing without the copy — logging, metrics, a status code
and nothing shown to anyone — `isPdfError(err)` narrows `unknown` to
`AnyPdfError`, which gives you `code` and `blame` with no dictionary
involved.

> **Never put the described text in state**
>
> `title` and `action` come out in the language of the `dict` you passed. Store
> them, and they freeze in that language — so a user switching the UI language
> sees that one part of the screen left behind, with nothing failing and nothing
> logged. **Store the raw error, describe it while rendering.**
>
> ```diff
> - catch (err) { setError(describePdfError(err, dictFor(locale))); }
> + catch (err) { setErrorBox({ err }); }
> + // …and in the render body, so it re-derives on every locale change:
> + const problem = errorBox && describePdfError(errorBox.err, dictFor(locale));
> ```
>
> The box (`{ err }`) is not decoration: `null` cannot tell "no error" from "an
> error that is null", and `setError(err)` with an error that happens to be a
> function would be read by React as an updater.

#### On a server

`blame` exists so this decision does not have to be made twice:

| `blame` | Meaning | Reasonable status |
|---|---|---|
| `data` | The payload cannot produce this document | `400`, or `413` for `pageLimit` |
| `template` | The saved template is wrong | `422` |
| `config` | The environment is missing something (a font, a codec) | `500`, and page someone |
| `package` | Our bug | `500`, and please open an issue |

Nothing above needs React: the classes, `isPdfError`, `describePdfError` and
`dictFor` all come from `json-pdf-designer/server`.

**One caveat on the glyph error.** It only fires with the **standard** font
(Helvetica/WinAnsi). With a font embedded through `fontBytes`, a character the
font does not cover is drawn as that font's `.notdef` glyph — usually a blank or
a box — with **no error at all**. That is fontkit's behaviour, not a choice this
package makes, and it means a custom font trades a loud failure for a silent
blank. If a missing glyph must never pass unnoticed, check the data before
generating.

## Public API

Everything below comes from `json-pdf-designer`. The `generatePdf`
subtree (Generation/Bindings/Chart color palettes and the plain types)
is also available React-free from `json-pdf-designer/server` — see
"Server-only usage" above.

```ts
// Component — the preset (see "Composing the editor" above)
Designer                                   // the full React canvas (toolbar + list + rulers + zoom + bands)
type DesignerProps

// Composition — build your own editor layout (see "Composing the editor")
DesignerProvider                           // holds all the editor state; every part below needs it above
type DesignerProviderProps

// The ten placeable parts. Each takes className/style/whenTab; several take parts/flags
DesignerCanvas, DesignerTabBar, DesignerFieldList, DesignerToolbar, DesignerPageSettings,
DesignerPropertyPanel, DesignerFilterPanel, DesignerBindingEditor, DesignerInspector,
DesignerSidebar                            // convenience: the seven content parts + the preset's tab gate
type DesignerCanvasProps, ... (one per part), type TabGate

// The ten hooks — accessors (context value as-is) and selectors (derived)
useDesignerData, useDesignerActions, useDesignerSelection, useDesignerUi, useDesignerConfig
useDesignerSelectedSchema, useDesignerFieldListSchemas, useDesignerBulkEdit,
useDesignerTabWarnings, useDesignerFilterColumns
type DesignerDataValue, DesignerActionsValue, DesignerSelectionValue,
     DesignerUiValue, DesignerConfigValue

// Primitive registry — swap the components the editor uses INSIDE itself
UiComponentsProvider                       // <Designer components={...}> is sugar for this
useUiComponents()                          // how a part of your own resolves the registry
defaultUiComponents                        // ours — name a key to go back to it explicitly
type UiComponents, type UiComponentsOverride, type UiComponentsProviderProps

// UI language (see "UI language" above)
I18nProvider, useT, useLocale, withInlineCode
type Locale, type Dict

// Ready-made UI (optional — see "Ready-made UI components" above)
// The first 12 are also the registry's slots.
Button, Input, ColorInput, Select, Textarea, Checkbox, Modal, Card, CardHeader, CardTitle,
Badge, TabPanel
PalettePicker, PaletteSwatches, MaterialIcon, CollapsibleSection, ClearFieldButton
IconPlus, IconX, IconTrash, IconGrip, IconLink, IconMinus, IconArrowsHorizontal,
IconArrowsVertical, IconDots, IconUpload, IconLock, IconLockOpen, IconBringToFront,
IconSendToBack, IconRefresh, IconDownload, IconFolderUp, IconAlertTriangle,
IconChevronLeft, IconChevronRight
// Every *Props is exported too (a ~5-line adapter needs to name them), plus the
// styling-API types: IconProps, PartStyle, ClassValue, LabeledParts

// Generation
generatePdf(template, data, bindings, { fontBytes?, maxPages? }) => Promise<Uint8Array>
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

// Template format version (also in json-pdf-designer/server)
migrateTemplate(input) => Template          // normalizes a template from a DB/file/API
CURRENT_TEMPLATE_VERSION                    // the format version this build writes

// Generation errors, as classes (all also in json-pdf-designer/server) — see "Failure modes"
PdfGenerationError                          // abstract base; nothing throws it directly
PageLimitError, PaginationStalledError      // pagination: too many pages / a pass that consumed nothing
InvalidPageSizeError                        // width/height not two finite numbers > 0
UnsupportedGlyphError                       // character with no glyph in the font
Woff2SupportMissingError, FontDecompressFailedError, FontDecompressTimeoutError
ImageUploadTooLargeError, ImageUploadUnreadableError // rejected at upload
ImageTooLargeError, TooManyImagesError, UnsupportedImageFormatError
ImageUnreadableError, BackgroundImageUnreadableError
TemplateNotAnObjectError, TemplateVersionInvalidError, TemplateVersionTooNewError
TemplateMigrationMissingError               // our gap between two versions
isPdfError(err) => err is AnyPdfError       // narrows unknown; gives you code + blame
PDF_ERROR_CODES                             // the 18 codes, as a const tuple
type PdfErrorCode, PdfErrorBlame, AnyPdfError
DEFAULT_MAX_PAGES                           // 5000

// Turning a caught error into copy someone can read (also in json-pdf-designer/server)
describePdfError(err, dict) => PdfProblem | null // null when the error is not ours
type PdfProblem                             // { code, blame, title, action?, field?, detail }
type PdfProblemCode                         // PdfErrorCode | "expression" — 19 members
ExpressionError                             // base of the two below; its own hierarchy
ExpressionSyntaxError, ExpressionDepthError

// Expression validation (also in json-pdf-designer/server) — see "Conditional visibility"
expressionError(source) => string | null    // one expression: the syntax error, or null
templateExpressionErrors(template)          // every bad {...} of a template, with its message
expressionErrors(schema, binding)           // every expression a field carries
suspiciousOperator(source)                  // one-sided operator: valid syntax, almost certainly a typo
templateSuspiciousOperators(template)       // the same, token by token
suggestAt(text, caret), applySuggestion(text, caret, s), insertAtCaret(text, caret, insert), wordAtCaret(text, caret), ALL_SUGGESTIONS
tokenAtCaret(template, caret), braceError(template, t?)     // the {...} the caret is in; unbalanced brace
fieldWarning(schema, binding, t?)           // the editor's alert message for a field
dictFor(locale)                             // a translation dictionary as a value, for the `t` above
filterIncomplete(binding)
type SchemaExpressionError

// Types
Template, TemplatePage, TemplateVersion, Schema, TextSchema, TableSchema, TableColumnStyle, ImageSchema,
SectionSchema, ChartSchema, KpiSchema, KpiIcon, BaseSchema, PageSize, Binding,
TableColumn, DataSourceOption, SectionColumnDragPayload, Zone, Bands,
GeneratePdfOptions, Orientation
```

## The `json-pdf-designer/preview` entry point

Everything that uses pdf.js. `pdfjs-dist` is an optional peer dependency,
so run `npm install pdfjs-dist` if you import from here — see
"Real PDF preview" above for the full rationale.

```ts
PdfPreview                                 // <canvas> per page, renders the generated bytes
PdfPreviewModal                            // a full modal around PdfPreview (download/close buttons)
configurePdfWorker(url)                    // self-host pdf.js's worker instead of the default CDN
```

## Package structure

```
src/
  types/
    schema.ts          -> Template/TemplatePage/Schema (text/table/image/section/chart/kpi) + TableColumnStyle
    binding.ts          -> TableColumn, Binding (includes "chart": path/labelColumn/valueColumn/filters)
    dataSource.ts       -> DataSourceOption/DataSourceColumnType, SectionColumnDragPayload
  units.ts             -> mm <-> px <-> pt conversions + grid (GRID_SIZE_MM, snapToGrid)
  zones.ts             -> classifies a field into header/footer/margin/body + drag lock
  materialIcons.ts     -> Material Symbols icon paths + EN/PT-BR search labels (KPI icon picker)
  fieldWarnings.ts     -> "missing binding"/"incomplete filter" warning messages (Fields list, tab icons)
  pageSizes.ts         -> page size presets + orientation (portrait/landscape)
  numberFormat.ts      -> pt-BR number formatting, shared by the KPI card and bindings.ts's CURRENCY/NUMBER
  schemaFactory.ts     -> creates a new schema (text/table/image/section/chart/kpi) + next free Y
  kpiFormat.ts         -> KPI value formatting + per-element (icon/title/value/caption) position/lock helpers
  errorUtils.ts        -> normalizes any thrown value into a display-safe error message
  table/
    columns.ts         -> keeps a table's head/content/footer/columnStyles in sync with its array binding
    colors.ts          -> Excel-style header/body/band color presets (Light/Medium/Dark groups)
    layout.ts          -> resolveColumnWidthsMm — one source of truth shared by the canvas and render/renderTable.ts
    columnFormula.ts   -> parses/builds a calculated column's formula (CURRENCY/NUMBER/DATE/raw)
    columnResize.ts    -> the column-resize drag math (grow one side, shrink+clamp the other)
  chart/
    colors.ts          -> the chart's fixed categorical palettes + labels
    format.ts          -> chart number/label formatting
    pieGeometry.ts     -> pie/donut slice path + label point math, shared by the canvas and render/renderChart.ts
  i18n/
    en.ts, pt-BR.ts     -> the Designer's own UI text, one file per language (en is canonical)
    context.tsx, hooks.ts -> I18nProvider, useT, useLocale
    withInlineCode.tsx -> renders a translated string's `` `code` `` spans as real <code>
  bindings/
    bindings.ts        -> resolves bindings (scalar/array/keyvalue/template/section/chart/kpi)
                          + resolveChartItems/aggregateChartItems ("chart" binding)
    builders.ts        -> pure per-schema-type binding builders used by BindingEditor.tsx, testable without React
    columnParsing.ts   -> parses the table's free-text "col, Label={FUNCTION(...)}" input
    splitDelimited.ts  -> splits on a delimiter while respecting quotes/parens (used by the two above)
  expressions/         -> the {token}/{FUNCTION(...)} engine: parse -> AST -> evaluate
    tokenize.ts        -> chars -> tokens (an operator only counts when surrounded by whitespace)
    parse.ts           -> tokens -> AST, with operator precedence and real grouping
    evaluate.ts        -> AST + data -> value (no eval/new Function)
    functions.ts       -> the SUM/COUNT/AVG/CONCAT/DATE/CURRENCY/NUMBER/IF registry
    dataAccess.ts      -> path lookup + value comparison, shared with the binding filters
    formatters.ts      -> DATE/CURRENCY formatting (UTC-safe, pt-BR numbers)
  pdf/
    generate.ts        -> thin orchestrator: asks layout/ where everything goes, then draws it —
                          no pagination decision of its own
    layout/            -> pure math, no pdf-lib
      layoutDocument.ts-> THE pagination pass: Template+data -> LayoutDocument (pages of Placements)
      layoutTypes.ts   -> BodyItem/FlowBounds shapes
      bodyLayout.ts    -> buildBodyItems (groups schemas into BodyItems by Y) + boundsOf/gapAfter
      pageLayout.ts    -> normalizePageDefs (single vs. multi-page)
      sectionLayout.ts -> section measurement (how many repeats, how tall each one is)
    render/
      index.ts         -> drawFieldOfType, the per-type dispatcher (text/image/table/chart/kpi)
      renderTable.ts   -> draws a table in pdf-lib across page slices, header/value/footer with color/size
      renderSection.ts -> draws a repeated section, one pass per bound array item
      renderChart.ts   -> draws pie (slices via drawSvgPath) or bar + legend in pdf-lib
      renderKpi.ts     -> draws the KPI card (background + traced icon + title/value/caption)
      renderText.ts, renderImage.ts -> the two simplest field types (renderImage.ts also owns the
                          image size/count safety limits)
    pagination.ts      -> splits body content across pages against the header/footer/margin bands
    tableMetrics.ts    -> table row height + rows-per-slice (no pdf-lib, shared with layout/)
    svgShapes.ts       -> roundedRectPath (uniform or per-corner radius) shared by render/renderTable.ts/render/renderKpi.ts
    textSafety.ts      -> control-character sanitisation + missing-glyph error naming the field (see "Failure modes")
    textLayout.ts      -> alignX/alignY offset math + truncateToWidth, shared by render/renderTable.ts/render/renderText.ts
    resolvers.ts, color.ts -> small shared helpers for layout/ and render/
    fontUtils.ts       -> WOFF/WOFF2 -> real TTF/OTF (pure zlib for v1; v2 needs the
                          optional peer dep `wawoff2`, lazy-loaded, not installed by default)
    pdfWorker.ts       -> shared pdf.js worker configuration
    backgroundImage.ts -> turns an uploaded PNG/JPEG into the page's background PNG (image only —
                          see the entry-point boundary in ARCHITECTURE.md)
    thirdParty.d.ts    -> ambient types for wawoff2/tiny-inflate (no official @types)
  css/                 -> hand-written CSS, copied verbatim into dist/ by tsup's publicDir
    theme.css          -> the reset (via @import) + the finished look, all inside @layer json-pdf-designer
    reset.css          -> the appearance-free subset: what the editor used to inherit from Tailwind's Preflight
  designer/
    Designer.tsx       -> the PRESET: three providers + two parts in a two-column layout (101 lines)
    context/           -> DesignerProvider.tsx + the five contexts (contexts.ts), the hooks (hooks.ts)
                          and the pure derivations the selectors call (derived.ts)
    parts/             -> the ten placeable parts, one file each, + useTabGate.ts (the opt-in tab gate)
    actions.ts         -> every Template/Binding[] mutator, each reading from the updater's `prev`
                          (which is what keeps the actions context identity-stable)
    useTabBar.ts, useSelection.ts, useClipboardAndDelete.ts -> the hooks the provider is built from
    helpers.ts         -> pure spawn-position/name-dedup/data-source-lookup helpers
  components/
    PageCanvas.tsx     -> the A4 sheet, rulers, zoom (zoom-aware drag/resize), grid, red bands,
                          marquee selection, drag/resize/inline editing
    canvasGeometry.ts  -> PageCanvas.tsx's section hit-test + marquee-selection math (pure, testable)
    dragField.ts       -> reads a dropped field-tree chip's payload (drag-and-drop from the JSON explorer)
    dragGesture.ts     -> shared mousedown -> window mousemove/mouseup drag-loop wiring (KPI drag, column resize)
    FieldBox/          -> renders text/table/image/section/chart/kpi on the canvas (one file per type)
    FieldList.tsx      -> the side field list (select/lock/remove, send-to-back/bring-to-front)
    TemplateInspector.tsx -> read-only tree of the current page's fields, grouped by header/body/footer zone
    Toolbar.tsx        -> the "+ text/table/image/section/chart/kpi" buttons
    PropertyPanel.tsx  -> thin dispatcher to one PropertyPanel<Type>.tsx per schema type
    PropertyPanelText.tsx, PropertyPanelTable.tsx, PropertyPanelImage.tsx, PropertyPanelSection.tsx,
    PropertyPanelChart.tsx, PropertyPanelKpi.tsx, PropertyPanelFields.tsx -> per-type Data/Style content
    BindingEditor.tsx  -> the generic binding UI (scalar/template/array/keyvalue/section/chart + calculated columns)
    Ruler.tsx          -> the mm ruler (SVG)
    PdfPreview.tsx     -> preview of the generated PDF via pdf.js
    PdfPreviewModal.tsx-> a full modal around PdfPreview (exported, see above)
    ui/                -> Button, Input, Card, Select, Textarea, Checkbox, Modal, TabPanel, PalettePicker,
                          CollapsibleSection, ClearFieldButton, icons — exported (see above), used internally
      registry.ts      -> the 12 slots + defaultUiComponents; UiComponentsProvider.tsx / useUiComponents.ts
      cx.ts            -> class merge (dedupes exact tokens, returns undefined when empty) + mergeStyle
  index.ts             -> the package's public exports (never reaches pdfjs-dist)
  preview.ts           -> the "/preview" entry: the ONLY graph allowed to import pdfjs-dist
examples/
  report-builder/      -> a full app (JSON data sources, field explorer) using the package's ready-made UI,
                          migrated to the parts — same layout as the preset, plus its own <SelectedFieldBar>
  composed-layout/     -> the same editor in a layout the preset cannot do: 8 parts in the DOM at once,
                          no tab bar (the proof that whenTab is opt-in)
  custom-ui/           -> the same idea, a 100% custom shell (hand-written CSS, no package component,
                          no package CSS at all)
  headless-designer/   -> a hand-built canvas over json-pdf-designer/server, no <Designer>/package UI at all
  no-preview/          -> generates + downloads with no preview and no pdfjs-dist installed (the optional-peer gate)
```

## Examples

Five example apps in `examples/`, each with its own README:

Each also sits at its own point on the styling spectrum — see
["The styling spectrum across the five examples"](#the-styling-spectrum-across-the-five-examples).

- **[report-builder](../examples/report-builder)** — the full designer
  (JSON data sources, field explorer, 6 ready-made templates) using the
  package's UI components (`Button`/`Card`/`Input`, plus `PdfPreviewModal`
  from the separate `/preview` entry),
  built from the parts with the preset's own layout, plus a
  `<SelectedFieldBar>` in the app's own chrome that reads the editor's
  selection through a hook. Styling: `theme.css` untouched.
- **[composed-layout](../examples/composed-layout)** — the same editor in
  a layout the preset cannot produce: full-width toolbar, list left,
  canvas centre, and five stacked panels on the right that would be five
  tabs inside `<Designer>`. Eight parts in the DOM at once, no tab bar.
  Styling: `theme.css` rethemed by `--jpd-*` token only.
- **[custom-ui](../examples/custom-ui)** — a lean version (1 fixed
  template), an entirely custom CSS shell, zero package UI components and
  **no package CSS at all** — proof that both `<Designer>` and
  `theme.css` are optional. Styling: 192 `.jpd-*` selectors from scratch.
- **[headless-designer](../examples/headless-designer)** — no `<Designer>`
  at all: a hand-built drag/resize canvas over `generatePdf` + types from
  `json-pdf-designer/server`, plus `PdfPreview`. Styling: `reset.css`
  alone — the only example on the appearance-free export.
- **[no-preview](../examples/no-preview)** — generates and downloads the PDF
  with no preview screen and no `pdfjs-dist` installed; the app that proves
  the main entry never needs the optional peer. Styling: `theme.css` in
  **dark mode**, with a toggle — the only app here that exercises dark.

Each runs independently (`npm install && npm run dev` inside the
folder) — they aren't package workspaces, they just point at it via
`"json-pdf-designer": "file:../.."` in their own `package.json`.

## Build

```bash
npm run build       # tsup (JS + d.ts; src/css/*.css copied via publicDir)
npm run dev          # tsup --watch
npm run typecheck
```
