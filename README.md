# json-pdf-designer

[![npm version](https://img.shields.io/npm/v/json-pdf-designer.svg)](https://www.npmjs.com/package/json-pdf-designer)
[![npm downloads](https://img.shields.io/npm/dm/json-pdf-designer.svg)](https://www.npmjs.com/package/json-pdf-designer)
[![CI](https://github.com/williamanjo/json-pdf-designer/actions/workflows/ci.yml/badge.svg)](https://github.com/williamanjo/json-pdf-designer/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-website-blue)](https://williamanjo.github.io/json-pdf-designer/)

**English** | [Português](README.pt-BR.md)

Visual PDF report editor for React — drag/resize canvas, bind fields to a
JSON data source, repeated sections (data band/master-detail), charts,
KPI cards, real pagination, repeating header/footer, and letterhead-style
backgrounds. A React component that's entirely yours: no plugin system,
no declarative propPanel, no third-party UI dependency — changing
anything is just editing the file.

PDF generation (`generatePdf`) is **plain JS** ([pdf-lib](https://github.com/Hopding/pdf-lib))
— the same template designed in the browser can be generated on the
client or on a Node backend, no headless browser required.

## Why this package

- **You own the code.** No plugin system, no declarative property
  schema — the `<Designer>` component and the rest of the source sit
  right inside your `node_modules`, ready to read and edit if you need
  something the package didn't anticipate.
- **One template = one JSON.** `Template` + `Binding[]` are plain,
  serializable objects — save them to a database, version them, send
  them over an API, no hidden class or function in between.
- **The same function generates on the browser and the server.**
  `generatePdf` doesn't touch the DOM or the browser `canvas` — just
  `pdf-lib`/`fontkit`. Design the template on screen with `<Designer>`
  and generate the real PDF on a Node backend from the saved JSON (see
  [Backend usage](#backend-usage-no-ui) below).

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

Import the package's CSS once, in your app's entry point:

```ts
import "json-pdf-designer/style.css";
```

Already have your own Tailwind (v3 or v4) set up and want it to
generate the Designer's classes instead of loading a second stylesheet
— e.g. to avoid a duplicate Preflight/reset — see
[Using your own Tailwind installation](docs/USAGE.md#using-your-own-tailwind-installation).

Only generating PDFs in a backend/Node API, no editor UI? Import from
`json-pdf-designer/server` instead — a React-free build of `generatePdf`
and friends, no `react`/`react-dom` required. See
[Server-only usage](docs/USAGE.md#server-only-usage-no-react-needed).

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

Full guide (data binding, template functions, repeated sections, charts,
KPIs, custom fonts, the entire public API) in
**[docs/USAGE.md](docs/USAGE.md)**.

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
  designer (JSON data sources, field explorer, 6 ready-made templates).
- **[examples/custom-ui](examples/custom-ui)** — a lean version with its
  own plain-CSS shell, without the package's UI components.
- **[examples/headless-designer](examples/headless-designer)** — no
  `<Designer>` at all: a hand-built drag/resize canvas over `generatePdf` +
  types from `json-pdf-designer/server`, plus `PdfPreview`.
- **[examples/no-preview](examples/no-preview)** — generates and downloads
  the PDF with no preview screen and **no `pdfjs-dist` installed**, proving
  the main entry never needs the optional peer.

All four run live in the browser at
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
[pdf.js](https://github.com/mozilla/pdf.js) for the preview, Tailwind CSS
for the editor's own look. Zero third-party UI dependency (Material UI,
Ant Design, etc.) — `<Designer>`'s visual components are its own and
exported alongside it, in case you want to reuse them.

## License

[MIT](LICENSE)

## Contributors

| | Name | Role |
| --- | --- | --- |
| <img src="https://avatars.githubusercontent.com/u/69880957?v=4" width="40" height="40"> | [@williamanjo](https://github.com/williamanjo) | Original author |

Contributions via pull request are welcome.
