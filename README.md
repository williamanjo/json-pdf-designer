# json-pdf-designer

[![npm version](https://img.shields.io/npm/v/json-pdf-designer.svg)](https://www.npmjs.com/package/json-pdf-designer)
[![npm downloads](https://img.shields.io/npm/dm/json-pdf-designer.svg)](https://www.npmjs.com/package/json-pdf-designer)
[![CI](https://github.com/williamanjo/json-pdf-designer/actions/workflows/ci.yml/badge.svg)](https://github.com/williamanjo/json-pdf-designer/actions/workflows/ci.yml)
[![types](https://img.shields.io/badge/types-included-blue)](https://github.com/williamanjo/json-pdf-designer)
[![ESM + CJS](https://img.shields.io/badge/module-ESM%20%2B%20CJS-blue)](#at-a-glance)
[![Docs](https://img.shields.io/badge/docs-website-blue)](https://williamanjo.github.io/json-pdf-designer/)
[![license MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**English** | [Português](README_pt-BR.md)

**Design a PDF report in the browser, generate it anywhere.**

A visual report editor for React — drag/resize canvas, fields bound to a
JSON data source, repeated sections (data band / master-detail), tables
with calculated columns and totals, charts, KPI cards, real pagination,
repeating header/footer, and letterhead backgrounds.

The template you design is **one serializable JSON object**, and the
function that renders it (`generatePdf`) is plain JavaScript over
[pdf-lib](https://github.com/Hopding/pdf-lib) — no DOM, no `canvas`, no
headless browser. So the template drawn on screen renders through the
same code path in the browser, in a Node API, or in a queue worker —
there is no second implementation to drift.

```
 ┌─ browser ─────────────┐     ┌─ your storage ──────┐     ┌─ Node / worker ───────┐
 │ <Designer/>           │     │ { template,         │     │ generatePdf(...)      │
 │       ↓               │ ──▶ │   bindings }        │ ──▶ │       ↓               │
 │ Template + Binding[]  │     │ (plain JSON)        │     │ Uint8Array → S3/email │
 └───────────────────────┘     └─────────────────────┘     └───────────────────────┘
```

## At a glance

| | |
| --- | --- |
| **Install size** | 3 runtime dependencies (`pdf-lib`, `fontkit`, `tiny-inflate`). All 5 peers are **optional** — a backend that only generates installs none of them |
| **Requirements** | Node ≥ 18 · React 18 or 19 (only for the editor) · TypeScript optional, types shipped |
| **Module formats** | ESM **and** CJS, with `.d.ts` for every entry point |
| **Entry points** | `json-pdf-designer` (editor + generation) · `/server` (generation, React-free) · `/preview` (on-screen PDF, keeps `pdfjs-dist` out of installs that never preview) · `/theme.css` · `/reset.css` |
| **Field types** | text, table, image, section (repeating band), chart, KPI card |
| **Expressions** | 11 functions, parsed to an AST — no `eval`, no `new Function` |
| **Composition** | 10 placeable editor pieces · 10 state hooks · 12 swappable UI primitives |
| **Styling** | 190 stable `.jpd-*` classes, 123 `--jpd-*` tokens, hand-written CSS, no build step on your side |

## Why this package

- **One template = one JSON, and it keeps loading.** `Template` +
  `Binding[]` are plain serializable objects — store them in a database,
  version them, send them over an API, with no hidden class or function
  in between. The format itself is versioned (`Template.version` +
  `migrateTemplate`), so a template already sitting in a customer's
  database still opens after the package moves on.
- **One function, both runtimes.** `generatePdf` never touches the DOM
  or the browser `canvas` — just `pdf-lib`/`fontkit`. Design on screen
  with `<Designer>`, then generate the real PDF from the saved JSON in a
  Node backend (see [Backend usage](#backend-usage-no-ui)) without
  duplicating a single line of drawing logic.
- **Composable down to the primitive.** `<Designer>` is a preset over 10
  pieces you can place yourself, 10 hooks that read the same state, and
  12 internal UI primitives you can replace with your own design
  system's. The editor's CSS is a published contract, not an
  implementation detail — retheming it is redeclaring tokens.
- **A data problem degrades; a structural problem fails loudly.** A path
  that isn't in the JSON renders empty, and a broken expression empties
  *that field* — one stray comma can't cost you a 200-page report. But a
  document that would blow past the page cap throws instead of handing
  you a truncated PDF that looks complete, and a character with no glyph
  in the font is an error rather than a silent gap. Every failure is a
  typed class with a `code` and a `blame`, so a backend can pick a status
  code without matching a message. The full table of what degrades and
  what fails is in
  [What can and cannot fail a generation](docs/USAGE.md#what-can-and-cannot-fail-a-generation).
- **The source is right there.** No plugin system to learn and no
  declarative property schema to fight — `<Designer>` and everything
  under it ships readable in your `node_modules`, so the escape hatch for
  anything the package didn't anticipate is reading the file.

## Built to be depended on

Concrete, and checkable in this repo:

- **1115 tests across 75 files**, weighted where the risk is: 19 files
  cover PDF generation and pagination alone, plus 8 on the expression
  parser, 8 on the UI kit, 7 on the editor's state boundaries, 6 on
  tables, 4 on data binding.
- **CI tests the published artifact, not the source.** It runs
  `npm pack`, installs the tarball into a clean directory, and asserts
  that a PDF really comes out — *and* that a failure comes back as a
  typed class with localized copy. That is what catches a broken
  `exports` map, a file missing from `files`, or an import that quietly
  drags React into the `/server` build.
- **Optional peers are enforced, not just declared.** The same CI step
  fails if `pdfjs-dist`, `react-rnd`, `react` or `react-dom` ever appear
  in a backend-only install.
- **A versioned template format with the migration chain already
  wired.** `Template.version` plus `migrateTemplate` normalize anything
  coming from a database or a file, and a format bump that arrives
  without its migration step throws `TemplateMigrationMissingError`
  instead of silently mangling a template. There has only been one
  format version so far, so the chain is empty on purpose — the point is
  that the seam exists and is tested before it is needed.
- **Honest semver.** 3.0.0 removed Tailwind from the package and renamed
  every internal class; the breaking changes are enumerated with
  migration diffs in the [CHANGELOG](CHANGELOG.md), and the old
  stylesheet path fails at build time on purpose rather than resolving to
  something subtly different.
- **Five example apps** that double as regression tests — including one
  installed *without* the optional preview peer, and one that styles the
  entire editor from scratch with no package CSS at all.

## English or Portuguese UI

The `<Designer>` (buttons, tabs, warnings) speaks English by default —
pass `locale="pt-BR"` to switch it to Portuguese:

```tsx
<Designer locale="pt-BR" template={template} onChangeTemplate={setTemplate} bindings={bindings} onChangeBindings={setBindings} />
```

This only changes the editor's own UI — it doesn't change how the
generated PDF formats dates/currency (that's `{DATE(...)}`/
`{CURRENCY(...)}` written into the template itself, see
[docs/USAGE.md](docs/USAGE.md)).

## Supported fields

| Field | What it does |
| --- | --- |
| **Text** | free content with `{token}`/`{FUNCTION(...)}`, font/color/alignment |
| **Table** | columns from an array, calculated columns, a footer (SUM/COUNT/AVG), per-column width, zebra striping, per-block alignment/corner rounding, and ready-made color-palette presets |
| **Image** | upload straight into the canvas, resizes with it |
| **Section** | repeated data band — master-detail, groups other fields and paginates together with the body |
| **Chart** | pie/donut or bar, configurable legend (right/left/top/bottom/on slices), sorting, display mode (number/percent/both), value format (number/currency), a ready-made color palette (Default/Classic/Modern/Vibrant/Pastel/Grayscale) or a fully custom one (color by color), and an advanced filter (OR groups, AND conditions) |
| **KPI indicator** | colored card with an icon ([Google Material Symbols](https://fonts.google.com/icons), searchable), title, value, and caption — each individually optional and freely repositionable on the card |

Everything drags/resizes freely (via [react-rnd](https://github.com/bokuweb/react-rnd)), with a 5mm grid
that snaps position/size by default — hold **Shift** while dragging to
break free of the grid. Multi-select (Ctrl/Cmd+click or a marquee box),
copy/paste, keyboard shortcuts, configurable page size/orientation. A
tabbed side panel — **Fields** and **Page** (always available) plus
**Data**/**Style**/**Filter** (only while a field is selected, depending
on its type) — tabs are drag-reorderable and pinnable (hide with the
"×", bring back with the "+"). Full detail on every feature in
[docs/USAGE.md](docs/USAGE.md).

## Expressions

A field's content is a **template**: literal text plus `{...}` resolved
against the JSON.

```
Invoice {invoice} — {CURRENCY(qty * price, "$")}
{IF(total > 1000, "priority", "standard")}
{UPPER(customer.name)} · {DATE(issuedAt, "MM/DD/YYYY")}
```

Inside the braces: paths, arithmetic (`*` and `/` bind tighter than `+`
and `-`, parentheses group), comparisons, `AND`/`OR`/`NOT`, and 11
functions (`SUM`/`COUNT`/`AVG`/`CONCAT`/`UPPER`/`LOWER`/`TRIM`/`DATE`/
`CURRENCY`/`NUMBER`/`IF`). It is parsed to an AST — no `eval`, no
`new Function`.

One rule is unusual, and it's what lets a JSON key hold a hyphen or a
space: **an operator is only an operator with whitespace on both sides.**

```
{my-key}    the path "my-key", not "my minus key"
{a - b}     subtraction
{a -b}      the path "a -b" — probably not what you meant
```

That last line used to be invisible: the field just came out blank. The
editor now flags it, along with a syntax error and an unbalanced brace
(a `{` with no pair prints as literal text in the PDF).

**Conditional visibility.** Any field carries an optional `visibleWhen`
— the same expression language, without braces — and is drawn only when
it's true. It works on every field type, sections and tables included,
and on the repeating bands, where `pageNumber == pageCount` means "only
on the last page". Hiding a field gives back its height; what follows
moves up.

```ts
{ type: "text", content: "Corporate discount", visibleWhen: 'customer.type == "company"' }
{ type: "table", name: "overdue", visibleWhen: "NOT paid" }
```

**Writing one.** The `ƒx` button next to a table column, a totals cell,
a KPI field or a text field opens an editor with the fields that field
is bound to on the left, autocomplete of the functions and operators in
the middle, and live validation. Validation is public API too
(`expressionError`, `suspiciousOperator`, `braceError`,
`templateExpressionErrors`), so a backend can reject a template with a
broken expression *before* saving it.

## Install

```bash
npm install json-pdf-designer react react-dom react-rnd
```

All peer deps are **optional** (`peerDependenciesMeta`), so pick what you
use: `react`/`react-dom` (18 or 19) and `react-rnd` for `<Designer>`,
`pdfjs-dist` if you render the PDF preview, `wawoff2` only for `.woff2`
fonts. A backend that just calls `generatePdf` from
`json-pdf-designer/server` needs none of them — see
[docs/USAGE.md](docs/USAGE.md).

Import the package's theme once, in your app's entry point:

```ts
import "json-pdf-designer/theme.css";
```

One line is all of it: hand-written CSS, no Tailwind and no build step on
your side, and it pulls in the reset it needs by itself. If you'd rather
style the editor yourself, import `json-pdf-designer/reset.css` instead
— the same reset with none of the looks. See
[Styling and theming](docs/USAGE.md#styling-and-theming).

Only generating PDFs in a backend/Node API, no editor UI? Import from
`json-pdf-designer/server` instead — a React-free build of `generatePdf`
and friends, no `react`/`react-dom` required. See
[Server-only usage](docs/USAGE.md#server-only-usage-no-react-needed).

Want the on-screen PDF preview? It lives behind its own entry point,
`json-pdf-designer/preview` (`PdfPreview`, `PdfPreviewModal`,
`configurePdfWorker`) — that's what keeps `pdfjs-dist` (~35MB) out of
an install that never previews. The main entry has no path to it; the
[no-preview example](examples/no-preview) is the proof.

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

Full guide (data binding, template functions, repeated sections, charts,
KPIs, custom fonts, the entire public API) in
**[docs/USAGE.md](docs/USAGE.md)**.

## Composing the editor

`<Designer>` is a **preset**: it mounts the state and lays out a canvas
next to a tabbed sidebar. Its seven props haven't changed, so none of
this is required — but when that layout isn't the one you want, mount
the same editor piece by piece instead:

```tsx
import { DesignerProvider, DesignerCanvas, DesignerSidebar } from "json-pdf-designer";

<DesignerProvider template={template} onChangeTemplate={setTemplate} bindings={bindings} onChangeBindings={setBindings}>
  <DesignerCanvas />
  <DesignerSidebar />
</DesignerProvider>
```

That is what `<Designer>` itself renders. There are 10 placeable pieces
— canvas, tab bar, field list, toolbar, page settings, property panel,
filter panel, binding editor, inspector, plus the `DesignerSidebar`
convenience that stacks the content ones — and each takes `className`
(merged), `style` (yours wins) and an **opt-in** `whenTab`. Opt-in is
the load-bearing part: without it a piece renders always, which is what
lets five panels that would be five tabs sit side by side in one column.

Ten `useDesigner*` hooks read the same state, so your own shell can show
the current selection or fire a mutation the editor will pick up — the
[report-builder](examples/report-builder) uses them for exactly that.
[examples/composed-layout](examples/composed-layout) builds the layout
the preset can't; the full list of pieces, `parts` and hooks is in
[docs/USAGE.md](docs/USAGE.md).

## Styling

The editor's CSS is hand-written and shipped as a public contract, so
restyling it doesn't mean forking it. Every element carries a stable
`jpd-block__element--modifier` class, state lives on `data-*`
attributes, and colors/spacing/radii/type come from `--jpd-*` custom
properties:

```css
/* your sheet — retheming is redeclaring tokens */
:root { --jpd-accent: #7c3aed; --jpd-accent-solid: #7c3aed; }
```

Dark mode is an attribute you set, not a media query:
`data-jpd-theme="dark"` on `<html>` (the `.dark` class still works as an
alias). A library shouldn't decide it's light-only because the OS is
dark — if you want it to follow the OS, read `matchMedia` and write the
attribute.

Everything of ours sits in `@layer json-pdf-designer`, so any rule you
write beats it with no specificity fight. Same coin, other face: a bare
element selector like `button { … }` also beats it and reaches the
editor's chrome, so scope by class. Not importing our sheet at all is a
supported mode — [examples/custom-ui](examples/custom-ui) styles every
`.jpd-*` from scratch. Full detail, tokens included, in
[Styling and theming](docs/USAGE.md#styling-and-theming).

Coming from 2.x: `json-pdf-designer/style.css` is gone and has no alias,
so the old import fails to resolve at build time. That's deliberate — an
alias would quietly hand you a different sheet, and a resolve error
points at the [CHANGELOG](CHANGELOG.md) instead.

## Backend usage (no UI)

Since `generatePdf` is plain JS, you can split the system into two
parts: a **frontend** with `<Designer>` (where the template is designed
and saved as JSON) and a **backend/API** that receives a template id +
real data, fetches the saved template, calls `generatePdf` directly in
Node, and emails the PDF out — no headless browser, no duplicated
drawing logic.

```ts
// Node backend — no React/DOM dependency at all
import { generatePdf } from "json-pdf-designer";

const template = await db.reportTemplates.findById(templateId); // { template, bindings }
const pdfBytes = await generatePdf(template.template, data, template.bindings);
// pdfBytes: Uint8Array — attach to an email, save to disk/S3, return in a response...
```

Only `downloadPdf`, `Designer`, `PdfPreview*`, and the UI components are
browser-only (they touch `document`/the DOM) — everything else in the
package (`generatePdf`, the `Template`/`Binding`/`Schema` types, and the
`bindings/` helpers) is safe to import in Node.

Full walkthrough — the data model to persist, suggested endpoints, an
example with a custom font loaded from disk, and security
considerations — in **[docs/BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md)**.

## Examples

- **[examples/report-builder](examples/report-builder)** — the full
  designer (JSON data sources, field explorer, 6 ready-made templates),
  composed from the pieces so the app's own bar can read the editor's
  selection.
- **[examples/composed-layout](examples/composed-layout)** — the editor
  assembled piece by piece with no `<Designer>`: toolbar across the top
  and five panels stacked in one column that the preset would show as
  five tabs.
- **[examples/custom-ui](examples/custom-ui)** — the one-line
  `<Designer>` path with **no package CSS at all**: every `.jpd-*` class
  styled from scratch in plain CSS.
- **[examples/headless-designer](examples/headless-designer)** — no
  `<Designer>` at all: a hand-built drag/resize canvas over `generatePdf` +
  types from `json-pdf-designer/server`, plus `PdfPreview`.
- **[examples/no-preview](examples/no-preview)** — generates and downloads
  the PDF with no preview screen and **no `pdfjs-dist` installed**, proving
  the main entry never needs the optional peer. It is also the smoke test
  for the theme with **no Tailwind pipeline anywhere** — not in the app,
  not in the package.

All five run live in the browser at
**[the playground](https://williamanjo.github.io/json-pdf-designer/playground/)**
— no local setup needed.

## Documentation

**[williamanjo.github.io/json-pdf-designer](https://williamanjo.github.io/json-pdf-designer/)**
— full rendered docs (English/Português), install guide, every
`<Designer>` feature, and the complete public API.

Raw markdown, if you'd rather read it in the repo:

- **[docs/USAGE.md](docs/USAGE.md)** — install, usage, every `<Designer>`
  feature, and the full public API.
- **[docs/BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md)** — how to
  split the frontend (Designer) from the backend (generation + emailing).
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the package's
  internal architecture decisions.
- **[CHANGELOG.md](CHANGELOG.md)** — what changed release by release.

## Stack

React + TypeScript, [pdf-lib](https://github.com/Hopding/pdf-lib) +
[fontkit](https://github.com/foliojs/fontkit) for PDF generation,
[react-rnd](https://github.com/bokuweb/react-rnd) for drag/resize,
[pdf.js](https://github.com/mozilla/pdf.js) for the preview, and
hand-written CSS (`theme.css`) for the editor's own look — no Tailwind
in the package and no CSS build step in your app. Zero third-party UI
dependency (Material UI, Ant Design, etc.) — `<Designer>`'s visual
components are its own and exported alongside it, and the 12 primitives
it uses internally (`Button`, `Input`, `Modal`, …) can be swapped for
yours through `<Designer components={...}>`.

## Contributing

Pull requests are welcome. The gate a change has to pass is the same one
CI runs, and you can run all of it locally:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

`prepublishOnly` chains exactly those four, so nothing reaches npm
without them. Two conventions worth knowing before you open a PR:

- **A bug fix comes with the test that would have caught it.** Several
  suites here are source scanners guarding invariants that produce no
  error when broken — an unstyled class, a missing dark-mode token, a
  translated string held in state. If you add one, mutate the code to
  prove the guard actually fails.
- **Measured claims only.** Numbers in the docs and CHANGELOG are meant
  to be reproducible; if you change behavior a number describes,
  re-measure it rather than adjusting the prose.

| | Name | Role |
| --- | --- | --- |
| <img src="https://avatars.githubusercontent.com/u/69880957?v=4" width="40" height="40"> | [@williamanjo](https://github.com/williamanjo) | Author and maintainer |

## License

[MIT](LICENSE) — free for commercial use, no attribution required in
your output.
