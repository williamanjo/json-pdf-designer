**English** | [Português](CHANGELOG.pt-BR.md)

# Changelog

All notable changes to this package are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## 2.1.0 (2026-09-01)

Phase 1 of the post-2.0.0 roadmap: the foundation the rest depends on —
template format versioning, then an expression AST, then a unified layout
pass. On top of it, what the AST made possible: conditional visibility, a
typed failure surface, and an expression editor with field list and
autocomplete.

### Added

- **Expression editor (`ƒx`)** — the `ƒx` button now opens a window with the
  fields the schema is bound to on the left and a multi-line editor in the
  middle, with autocomplete of the format's functions and operators plus live
  validation. The editor holds the **field value itself**, braces included,
  opened with whatever was already there — you edit in place, so a literal
  prefix (`FAT-` in `FAT-{invoice}`) stays where it is. Suggestions appear only
  inside the braces; outside them you are writing literal text.
  - **An unbalanced brace is now reported** — nothing else did. The template
    resolver matches `/\{([^{}]+)\}/g`, so a `{` with no pair simply does not
    match and that stretch comes out as **literal text** in the PDF
    (`{CURRENCY(total` printed as-is). It is not an expression syntax error
    (the parser never sees it) nor a generation failure; it was a field coming
    out wrong in silence. `braceError(template, t?)` and
    `tokenAtCaret(template, caret)` are exported for a custom editor.
  - Available on four targets: a table column formula, each cell of the totals
    row, the KPI's title/value/caption, and a text field's content. Before
    this, only the column formula had anything, and it was a one-line input in
    a 320px sidebar.
  - The field list has two groups, because they resolve in different scopes:
    fields **of each item** of the bound array (`total`, no prefix — what works
    inside a row) and the **full data paths** (`invoices.total` — what an
    aggregation needs). Mixing them up was one of the easiest mistakes to make.
  - Autocomplete offers the 11 functions with their hints plus `AND`/`OR`/`NOT`,
    and it puts the surrounding spaces an operator needs — so it cannot produce
    the one-sided operator described below.
  - A syntax error blocks saving; a suspicious operator only warns (a JSON key
    with `/` in the name is legitimate).
  - `Modal` joins the ready-made UI exports.
- **`suspiciousOperator(source)` / `templateSuspiciousOperators(template)`** —
  an operator with whitespace on **exactly one side** is now reported. It is
  not a syntax error and cannot become one: an operator is only an operator
  when surrounded by whitespace on both sides, which is what keeps `{my-key}`,
  `{invoice/2}` and `{a==2}` reachable as data paths. But `{invoice /}` — `/`
  with `}` on its right — silently became the key `"invoice /"`, resolved to
  empty, and nothing flagged it. Now it does.
  - The check runs over the `ident` **tokens**, not the raw string, which is
    what makes it free of false positives: a real operator is already an `op`
    token, quoted text is a `string` token, and a negative sign (`-1` after a
    comma) is a `number` token — none of them reach the check.
  - `SchemaExpressionError` gained `severity: "error" | "warning"`. Error means
    the field renders empty for sure; warning means it compiles but almost
    certainly is not what the author meant. `fieldWarning` reports the error
    first.
- **Conditional visibility (`schema.visibleWhen`)** — an expression, without
  braces, evaluated against the real JSON at generation time; the field is
  drawn only when it is true.

  ```ts
  { type: "text", content: "Corporate discount", visibleWhen: 'customer.type == "company"' }
  { type: "table", visibleWhen: "NOT cancelled" }
  ```

  - Works on **every** field type, including tables and repeated sections, and
    on the repeating bands — a header/footer condition may use
    `pageNumber`/`pageCount`, so "only on the last page" is
    `pageNumber == pageCount`.
  - **Flow:** hiding an item gives back its **height** and nothing else. What
    follows moves up by exactly that much, and the spacing authored on both
    sides still applies. Hiding one field of a row that has visible neighbours
    leaves the hole, because the row still exists for them; hide them all and
    the whole row goes.
  - Absent (or blank) = always visible, so every existing template is
    unaffected.
  - An **invalid** condition counts as **visible**, never hidden: a typo must
    not make a field vanish from a report in silence. The editor flags it (see
    below) and the field keeps showing until someone fixes it.
  - `<Designer>` has a "Show only when" input for it, next to X/Y/width/height,
    with the syntax error shown live under the field.
- **`AND` / `OR` / `NOT`** in expressions — `{a > 1 AND NOT cancelled}`. `AND`
  binds tighter than `OR`, parentheses group, and both short-circuit. Same
  lexical rule as every other operator: **only surrounded by whitespace**, so a
  JSON key literally named `AND` is still reachable as `{AND}`. Case-insensitive,
  like function names.
- **Expression validation is now public API** — `expressionError(source)`,
  `templateExpressionErrors(template)` (both entries) and
  `expressionErrors(schema, binding)` / `fieldWarning(schema, binding, t)` (main
  entry). A backend can reject a template with a broken expression *before*
  saving it; a custom editor UI can flag it the way `<Designer>` does.
  - `t` on `fieldWarning` is now **optional** (English by default), and
    **`dictFor(locale)`** returns a translation dictionary as a plain value.
    `fieldWarning` was exported but needed a `Dict` that could only be obtained
    from `useT()`, inside a React component — so the one place it was most
    useful, a validation pass outside the editor, could not call it. Found by
    writing that pass in `examples/report-builder`.

- **`Template.version` and `migrateTemplate()`** — a `Template` is a document
  format, not an internal structure: once it lives in a database it outlives
  any version of this package. `version` tracks the **JSON format** (not the
  npm package), `TemplateVersion` is a one-member union today so that adding
  `| 2` makes the compiler point at every place that has to decide, and
  `migrateTemplate(input)` normalizes a template from a DB/file/API into the
  format this build understands.
  - Absent `version` is treated as format 1 — exact for every template saved
    before the field existed, since no shape change has happened since.
  - A `version` higher than this build understands **throws** instead of
    generating a PDF that silently drops fields it does not know.
  - `generatePdf` calls it internally, at the single point every template
    passes through, so a PDF is never generated from an unmigrated template.
  - Migrations live in one chain (`src/template/migrate.ts`), one step per
    version — never `if (version === 1) … if (version === 2) …` spread across
    callers. The chain is empty today because there is one format; it exists
    now because adding it after templates are in production databases costs
    far more.
  - Exported from both `json-pdf-designer` and `json-pdf-designer/server`.

### Fixed

- **Editing a table cell on the canvas now updates the column formula too.**
  The cell **is** the column formula — `generate.ts` resolves the row from
  `schema.content` — and the `ƒx` panel reads `binding.columns[i].formula`.
  Editing through `ƒx` already wrote both; editing the cell directly wrote only
  the content, so the panel kept showing the old formula: two values for the
  same thing, with the one on display being the one that does **not** reach the
  PDF. Same rules in both directions (an emptied cell goes back to the raw
  column).
- **A table column formula is no longer reported as a broken expression.**
  `bindingExpressionErrors` validated `column.formula` as a bare expression,
  but the renderer resolves it with `renderTemplate` — a formula is a
  *template*, so `"FAT-{fatura}"` is correct and was being flagged. Two of the
  package's own shipped example templates lit up because of it. Now validated
  as a template, matching what actually runs.

- **A malformed expression no longer takes the whole PDF down.** Generation is
  tolerant again: an invalid `{...}` resolves to empty, so one stray comma
  leaves *that field* blank instead of failing `generatePdf` and producing no
  document at all. That was the blast radius before the AST, and trading "one
  blank field" for "no report" was not an improvement.
  - The parser itself stays strict — that is what powers the new field warning
    (`"Invalid expression in \"content\" — renders empty"`), which is where the
    problem is meant to surface: in the editor, before generating.
  - `CONCAT(a,)` — a trailing comma before `)` — is tolerated again, as it was
    before the AST.
- **A big report is no longer silently truncated.** Two iteration counters
  (1000 table slices, 20000 section repeats) used to cap volume *without saying
  so*: 60 000 table rows came out as 40 998, and 20 000 section repeats came out
  as 18 667, in a PDF that looked complete. Omitting rows from a report without
  a word is the worst possible outcome.
  - They also guarded against a loop that cannot happen: the table loop always
    breaks on `capacity <= 0`, and the section loop always manages to place the
    item on the next page (on a freshly opened page the cursor *is* the header
    height, so `needsNewPageForItem` is false). Counting iterations measured the
    wrong thing.
  - The limit is now on **pages** — the actually scarce resource, whether the
    pages come from a table, a section or several page designs — it defaults to
    5000, it is configurable with `generatePdf(..., { maxPages })`, and
    exceeding it throws `PageLimitError` naming the field being paginated and
    saying what to do about it. Volumes that used to be truncated (60 000 rows →
    1464 pages) now come out complete.
  - A pagination pass that consumes nothing and opens no page now throws too:
    that is an arithmetic bug in the package, and spinning until a counter ran
    out hid it.
- **Generation errors are exported as classes** — `PageLimitError`,
  `UnsupportedGlyphError`, `ExpressionSyntaxError`/`ExpressionDepthError` (under
  `ExpressionError`) and `DEFAULT_MAX_PAGES`, from both entries. A backend can
  answer 413 for one and 400 for another without matching error messages.

- **A control character in the data no longer takes the PDF down.** A `\n` in a
  customer name — from a textarea, an address with a line break, a CSV import —
  used to fail the whole document with `WinAnsi cannot encode "\n"`. Control
  characters (C0, DEL, C1) are now replaced with a space before measuring or
  drawing, in every path that reaches the page: text field, table cell, KPI,
  chart label and the repeating bands. They have no glyph in *any* font, not
  even a full Unicode one passed via `fontBytes`, so this is not content loss —
  it is the only possible rendering. This was the highest-impact crash in the
  package: the trigger is the **data**, which whoever authored the template does
  not control.
- **A missing glyph now says which field and which character.** Emoji/CJK
  without a custom font still fails — dropping a character from a document
  someone signs would be worse — but the error is now
  `Campo "cliente_nome": o caractere "🎉" (U+1F389) não existe na fonte usada …`
  instead of pdf-lib's bare `WinAnsi cannot encode`, which named nothing.
  Covered in all five paths (text, table cell, KPI, chart label, table nested in
  a repeated section), and an astral-plane emoji is reported as one character
  rather than two surrogate halves.
- **A corrupt page background throws a real `Error`.** pdf-lib/pako threw a raw
  **string** there (`"The input is not a PNG file!"`), so a caller's
  `catch (e) { e.message }` got `undefined`. Same treatment the image field
  already had.
- **An image binding now actually reaches the PDF.** `drawImageField` read
  `schema.content` and ignored the resolved value, so the editor let you bind an
  image field to the JSON and the generator always drew the design-time image.
  A bound value that is not a data URI (a wrong path, an http URL, loose text)
  leaves the field empty instead of failing.
- **A degenerate number no longer produces an opaque pdf-lib `TypeError`.** A
  `NaN` font size falls back to a default (a lost measurement must not cost the
  document); an invalid **page size** fails with
  `Página "…": tamanho inválido (width=NaN, …)` — structural, and there is no
  sensible default to guess.

- **A too-deeply-nested expression no longer takes the PDF down either.** The
  depth guard used to throw a plain `Error`, and the tolerant layer only caught
  `ExpressionSyntaxError` — so the one case the guard exists for (a malformed or
  malicious template) was also the one case tolerance did not cover. The errors
  are now a small class hierarchy (`ExpressionError` → `ExpressionSyntaxError` /
  `ExpressionDepthError`), so the tolerant layer catches both by type instead of
  by matching the error message with a regex, and anything that is *not* a
  template problem still propagates.
  - The original guarantee is intact and still tested: excessive nesting is a
    clear, bounded error rather than a V8 stack overflow. It now lives on the
    strict API (`parse`, `expressionError`), while generation renders the field
    empty and the editor flags it — the same trade-off syntax errors make.
- **A number literal keeps the digits the author wrote.** `{2.50}` renders
  `"2.50"` again (not `"2.5"`), `{007}` renders `"007"`. Inside a calculation
  the value is coerced as usual, so `{2.50 + 0}` is still `2.5`.
- **The syntax-error position is now the exact offset.** Each token carries its
  own start, so the position is right even with whitespace between tokens and
  with a repeated token — neither `indexOf` (first occurrence) nor summing token
  lengths (ignores whitespace) got that right.

- **Operator precedence in template expressions.** `{a + b * c}` now
  evaluates as `a + (b * c)`. The previous engine folded left to right, like
  a pocket calculator, so with `a=2 b=3 c=4` it produced **20** instead of
  **14** — a wrong number on a financial report, with no error.
- **Parenthesised grouping.** `{(a + b) * c}` now works. The previous engine
  had no notion of grouping: the function-call pattern did not match a leading
  `(`, the arithmetic pass could not group, and the result was **`0`**,
  silently.
- **Text in an arithmetic expression no longer throws.** `{"x" + 1}` returns
  empty, the format's convention for "could not resolve". Before, the
  arithmetic pass gave up, the fallback re-processed the same string, and the
  recursion ran until the nesting guard threw — with a message about nesting
  depth that had nothing to do with the actual problem.
- **Division by zero no longer throws.** `{a / zero}` returns empty, same
  reason as above. This one is a plausible real input: a denominator that
  happens to be zero on one row.

### Changed

- **The expression engine is now parse → AST → evaluate**
  (`src/expressions/`), replacing the recursive string-rewriter that re-parsed
  the same string at every nesting level. The four fixes above come from the
  structure, not from patches on top of it.
  - `resolveToken(token, data)` keeps its signature and its `string` return, so
    nothing downstream changed and the whole existing test suite ran unmodified
    as the regression proof.
  - The format's lexical rule is now explicit and tested: **an operator is only
    an operator when surrounded by whitespace on both sides**. `{my-key}` and
    `{my key}` stay paths (JSON keys with hyphens and spaces are common),
    `{a - b}` is subtraction. The old engine had this by accident, through a
    regex; a conventional tokenizer would have broken `{my-key}` into three
    tokens and returned 0.
  - Intermediate values are now `string | number` instead of always strings.
    Coercion happens at each operator boundary — that is what makes
    precedence work at all.
  - Syntax errors (unterminated quote, unclosed paren) now throw with the
    position, instead of silently returning `0` or empty.
  - Still no `eval`/`new Function`: a template can come from an untrusted
    source, and the evaluator walks the AST.
- **Pagination is decided in one pass** (`src/pdf/layout/layoutDocument.ts`),
  replacing the two traversals it had before: `generate.ts` used to decide
  page breaks *and* draw in the same loop, while `countBodyPages` walked the
  whole body a second time just to get the total, because `{pageCount}` needs
  the number before the first mark is drawn. Only the atomic decisions were
  shared (`pagination.ts`); the cursor advance, the table-slicing loop and the
  section repetition were written twice, and a change to one copy would have
  meant "the dry run said 7 pages, the drawing made 8".
  - `layoutDocument(template, data, bindings, inputs)` returns a
    `LayoutDocument`: pages, each holding `Placement`s already positioned and
    with values already resolved. Page count is `pages.length` — it cannot
    disagree with the drawing because it *is* the drawing.
  - `countBodyPages` is gone. `generate.ts` no longer contains a single
    pagination decision; `render/*` receives resolved values instead of
    resolving them.
  - The cursor after a table now advances by `computeTableSlice().heightMm`
    instead of by the Y coordinate `drawTableSlice` returned — the layout no
    longer has to draw in order to know where to continue.
  - Section measurement moved to `layout/sectionLayout.ts` and the table
    metrics to `pdf/tableMetrics.ts`, so `layout/` no longer imports from
    `render/` and is genuinely pdf-lib-free.
  - Verified against the v2.0.0 build on 11 templates (tables of 1/35/36/37/
    120/600 rows, totals row, `repeatHeader: false`, text-table-text flow,
    master-detail sections, `Template.pages`): identical page counts
    everywhere, and byte-identical content streams except one Y coordinate
    that differs by 1.4e-13 mm — float round-trip noise the new path has one
    step less of.
- **A bare comparison now renders as `"true"`/`"false"`** — `{a > 1}` used to
  render empty, because the old engine treated the whole thing as a path and
  found nothing. This is deliberate: the old output was accidental, and a
  comparison that evaluates to something is the foundation `visibleWhen` needs.
  A comparison inside `{IF(...)}` behaves exactly as before.

## 2.0.0 (2026-09-01)

Ships the `pdfjs-dist` split that had been sitting under "Planned" —
plus the second half of it that entry wasn't accounting for: the PDF
page background also went through pdf.js, straight from `<Designer>`, so
the new entry point alone would not have freed the main entry. That
feature is dropped here (page backgrounds are images only now), which
leaves the preview as the single place pdf.js is used.

### Breaking

- **`pdfjs-dist` is no longer installed automatically** — it moved from a
  required `dependency` to an **optional peer dependency**
  (`peerDependenciesMeta["pdfjs-dist"].optional: true`), the same
  treatment `wawoff2` got in 1.6.2. Only projects that render a PDF
  preview need it; run `npm install pdfjs-dist` in your own project if you
  do.
  - Why: pdf.js is ~35MB installed, and as a `dependency` of the main
    entry every consumer paid for it — including apps that only render
    `<Designer>` and never preview anything.
- **`react-rnd` is no longer installed automatically either** — same move,
  and it is what actually makes the React-free backend install real. It was
  a plain `dependency`, so it came down on every install, and because *its
  own* `react`/`react-dom` peers are **not** optional, npm then installed
  the whole React stack (`react`, `react-dom`, `react-draggable`,
  `re-resizable`, `scheduler`, `prop-types`, …: ~8.7MB) even in a project
  that only ever imports `json-pdf-designer/server`. The `optional: true`
  this package already had on its own react peers was being defeated one
  level down.
  - If you use `<Designer>`, add it alongside react:
    `npm install react react-dom react-rnd`. Only `PageCanvas.tsx` uses it
    (drag/resize), and nothing reachable from `/server` does.
  - A backend install now resolves `fontkit`, `pdf-lib` and `tiny-inflate`
    plus their own trees, and nothing React.
- **`PdfPreview`, `PdfPreviewModal`, and `configurePdfWorker` moved to a
  new `json-pdf-designer/preview` entry point.** Update the import:

  ```diff
  - import { PdfPreviewModal, configurePdfWorker } from "json-pdf-designer";
  + import { PdfPreviewModal, configurePdfWorker } from "json-pdf-designer/preview";
  ```

  Everything else — `<Designer>`, `generatePdf`, `downloadPdf`, the UI
  components, the types — stays exactly where it was. A lazy `import()`
  inside the old files would not have worked: re-exported from the main
  entry's module graph, any bundler resolving `"json-pdf-designer"` still
  had to resolve `pdfjs-dist` at build time.
- **A page background can no longer be a PDF — images only.** The
  background upload accepts PNG/JPEG, and the button reads "Background
  image" instead of "Background PDF/image". Rasterizing an uploaded PDF's
  first page was the *other* thing pdf.js did in this package, and
  `src/pdf/backgroundImage.ts` imported it directly while `<Designer>`
  imports *that* — so the entry split above would have left pdf.js in the
  main entry's graph regardless. Dropping the feature is what actually
  frees the main entry, and it leaves rendering the preview as the only
  use of pdf.js in the whole package.
  - Migration: if you use a letterhead that only exists as a PDF, export
    its page to PNG once and upload that. Existing templates are
    unaffected — `Template.backgroundImage` was always a PNG data URI, so
    a background captured from a PDF before this release keeps working
    exactly as before.
  - `fileToBackgroundImage(file)` (internal) no longer branches on
    `application/pdf`; `src/pdf/rasterizePdfPage.ts` is gone.

### Added

- **`examples/no-preview`** — a fourth example app: `<Designer>` +
  `generatePdf` + `downloadPdf`, straight to download with no preview
  screen, and **no `pdfjs-dist` in any dependency field**. It's the app
  that proves the main entry works without the optional peer, and it
  builds in CI, so a pdf.js import leaking back into the main entry fails
  the Pages build.
- **`test/entryBoundaries.test.ts`** — walks the source graph from
  `src/index.ts`, `src/server.ts`, and `src/preview.ts` and fails if
  `pdfjs-dist` is reachable from the first two, or if `react`/`react-dom`/
  `react-rnd` is reachable from `/server`. Two control cases keep a broken
  walker from making the others pass vacuously. The CI tarball check also
  asserts `pdfjs-dist` is absent from `node_modules` after installing the
  packed package.

## 1.6.4 (2026-08-31)

Follows up on an external code review — fact-checked its claims against
the actual codebase before acting on them (see the plan/audit for the
full verdict; several claims turned out stale or overstated, e.g. the
reported npm/GitHub version mismatch no longer exists, and the "no
eval/new Function" security concern was already satisfied). This
release covers the parts that checked out as real and worth fixing now,
plus a couple of follow-up features and an internal reorg done in the
same pass.

### Fixed

- **`{SUM(a) - SUM(b)}` now actually subtracts.** Before, the function-
  call regex greedily matched the whole expression as a single call
  (capturing `"a) - SUM(b"` as one argument), silently rendering `"0"`
  instead of the difference. Any two function calls combined by an
  operator in the same `{...}` now correctly falls through to
  arithmetic instead.

### Security

- **Recursion depth limit on nested `{FUNCTION(...)}` calls** —
  previously unbounded; a template with several thousand nested parens
  (e.g. `{CURRENCY(CURRENCY(CURRENCY(...)))}`) could crash the process
  with an uncaught stack overflow. Now throws a clear, catchable error
  past ~40 nesting levels — far more than any legitimate template needs.
- **Image size/count limits** — `ImageSchema.content` and
  `Template.backgroundImage` now enforce a 15MB decoded-size cap per
  image and a 200-distinct-image cap per document (both throw a clear
  error instead of silently accepting anything). The browser-side
  background upload (`fileToBackgroundImage`) also rejects files over
  20MB before attempting to process them. Matters most for anyone
  accepting templates from an untrusted source (multi-tenant).

### Added

- **Golden/torture test suite** (`test/pdf/generate.torture.test.ts` +
  `test/pdf/fixtures/`) — runs the real `generatePdf` pipeline (not a
  fake page, an actual `pdf-lib` document) against deliberately extreme
  templates: empty table, a 600-row table spanning many physical pages,
  a section taller than an entire page, missing/null bound data, and
  the real text-encoding boundary (pt-BR accents work with the default
  font, emoji/CJK correctly need `fontBytes` — now locked in as an
  explicit, intentional test rather than an undocumented crash).
- **CI now verifies the published tarball, not just the source** — a
  new step runs `npm pack`, installs the resulting `.tgz` into a
  throwaway consumer, and calls `generatePdf` from
  `json-pdf-designer/server` for real. Catches `exports`/`files`/`.d.ts`
  regressions that only show up in what actually gets published (see
  `test/pack-consumer/`).
- **`{IF(condition, "then", "else")}` template function** — `condition`
  is either a comparison (`status == "paid"`, `total > 100`; operators
  `==`, `!=`, `>`, `>=`, `<`, `<=`, always surrounded by spaces, reusing
  the same eq/gt/lt logic chart/KPI filters already use) or a bare
  path/expression checked for truthiness (empty string, `"0"`, and
  `"false"` count as false). Only the chosen branch is resolved, so
  `{IF(hasDiscount, discountAmount, "0")}` doesn't fail even when
  `discountAmount` is missing from the data on the false branch. Added
  to the function picker in the binding editor and the table column-
  formula editor alongside `SUM`/`CONCAT`/etc.
- **Template Inspector** — new optional/removable sidebar tab (same
  show/hide/reorder pattern as "Data"/"Style"/"Filter"/"Page") showing a
  read-only tree of every field on the current page, grouped by zone
  (Header/Body/Footer/margins, reusing the existing `classifyZone`/
  `isRedZone` from `src/zones.ts` — no new classification logic). Each
  row shows the field's type, position, parent section (if it's a
  section member), a short binding summary, and its z-index (same order
  send-to-back/bring-to-front already uses). Clicking a row selects that
  field on the canvas, reusing the existing selection handling — no
  parallel selection mechanism.

### Changed

- **`src/pdf/` reorganized into `layout/` and `render/`** — pure
  internal refactor, no public API change. `generate.ts` is now a thin
  orchestrator; the pagination math (`buildBodyItems`, `boundsOf`/
  `gapAfter`, `normalizePageDefs`, `countBodyPages`) moved into
  `src/pdf/layout/`, and the actual `pdf-lib` drawing (previously
  `drawTable.ts`/`drawSection.ts`/`drawChart.ts`/`drawKpi.ts`, plus two
  new files split out of `generate.ts` for text/image) moved into
  `src/pdf/render/` as `renderTable.ts`/`renderSection.ts`/
  `renderChart.ts`/`renderKpi.ts`/`renderText.ts`/`renderImage.ts`,
  dispatched by `render/index.ts`. Verified as a pure move: same test
  count passing before and after, and the built bundle size is
  unchanged. Only matters if you imported one of those internal files
  directly (not part of the package's public entry points) — update the
  import path if so.

## 1.6.3 (2026-08-31)

### Removed

- **`lodash.get` dependency** — replaced its one call site (resolving a
  repeated section's array binding path) with the package's own
  existing case-insensitive path getter (now exported from
  `bindings.ts` as `getCaseInsensitive`), matching how every other
  binding type already resolved paths. Removes `lodash.get` and
  `@types/lodash.get` entirely (both were flagged deprecated upstream)
  and fixes a real inconsistency: section paths used to be
  case-sensitive while chart/kpi/table paths were not.

## 1.6.2 (2026-08-31)

### Breaking (peer dependency)

- **`wawoff2` is no longer installed automatically** — it moved from a
  required `dependency` to an **optional peer dependency**
  (`peerDependenciesMeta.wawoff2.optional: true`). Only projects that
  embed a real `.woff2` font (`generatePdf(..., { fontBytes })` with
  `.woff2` bytes) need it now; run `npm install wawoff2` in your own
  project if you do. Without it installed, passing a `.woff2` file
  throws a clear error (instead of the decompressor silently being
  there) telling you to install it or convert the font to `.ttf`/`.otf`
  offline instead. `.ttf`, `.otf`, and `.woff` (v1, decompressed via the
  still-mandatory `tiny-inflate`) are unaffected.
  - Why: `wawoff2`'s WASM binding has a Node-only code path (`fs`/`path`)
    that bundlers like Vite flag with a confusing (but harmless)
    "externalized for browser compatibility" warning — for every
    consumer, even ones that never embed a custom font. Making it
    optional means that warning, and the WASM binary itself, only shows
    up for projects that actually use the feature.
  - `src/pdf/fontUtils.ts` now lazy-loads `wawoff2/build/decompress_binding.js`
    via a dynamic `import()` instead of a static one, only at the moment
    a `.woff2` file is actually being decompressed.

### Added

- Table color palette gained an explicit, selectable **"Custom"**
  entry in the picker (previously only reachable implicitly by not
  picking a preset).
- Table **zebra/banded rows** is now a toggle independent of which
  palette/preset is active — any preset can be applied with or without
  striped rows.
- **`TableSchema.borderColor`** — the table grid color is configurable
  now (was a hardcoded gray in both the generated PDF and the canvas
  preview); color presets apply a real border color too.

## 1.6.1

- Internal refactor: reorganized `src/` by domain (`table/`, `chart/`,
  `designer/`, `bindings/builders.ts`, etc. — see
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
  [docs/USAGE.md](docs/USAGE.md#package-structure) for the current
  layout), extracted shared helpers to remove duplication across the
  PDF-drawing and canvas code, and added test coverage for previously
  untested pure-logic modules. No public API changes.
- Fixed the table's rounded-corner border drawing a square outline on
  top of a rounded fill when `headBorderRadius`/`bodyBorderRadius`/
  `footerBorderRadius` was set.

## 1.6.0 and earlier

See the [GitHub commit history](https://github.com/williamanjo/json-pdf-designer/commits/master)
for changes before this changelog started.
