**English** | [Português](CHANGELOG.pt-BR.md)

# Changelog

All notable changes to this package are documented here. Format loosely
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
