# Contributing to json-pdf-designer

Pull requests are welcome — bug fixes, docs, new field types, translations.

## Before you start

For anything larger than a bug fix, open an issue first so we can agree on
the shape of the change. A rejected PR after a week of work is nobody's
idea of a good time.

## Local setup

```bash
git clone https://github.com/williamanjo/json-pdf-designer.git
cd json-pdf-designer
npm install
npm run dev          # library, watch mode
```

To work against a real editor while you change the library:

```bash
cd examples/report-builder
npm install
npm run dev
```

## The gate

A change has to pass the same four commands CI runs. Run them locally
before opening the PR:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

`prepublishOnly` chains exactly those four, so nothing reaches npm
without them.

## Two conventions worth knowing

- **A bug fix comes with the test that would have caught it.** Several
  suites here are source scanners guarding invariants that produce no
  error when broken — an unstyled class, a missing dark-mode token, a
  translated string held in state. If you add one, mutate the code to
  prove the guard actually fails.
- **Measured claims only.** Numbers in the docs and CHANGELOG are meant
  to be reproducible; if you change behavior a number describes,
  re-measure it rather than adjusting the prose.

## Commit messages and versioning

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):
`fix:`, `feat:`, `docs:`, `refactor:`, `test:`, `chore:`. A `!` or a
`BREAKING CHANGE:` footer marks a breaking change.

The project follows semantic versioning. The public surface is what
`src/index.ts` exports and what `test/publicSurface.test.ts` pins — if
your change alters that file's snapshot, it is a breaking change and
needs to be called out in the PR.

## Docs and i18n

- Every user-facing change updates `README.md` **and** `README_pt-BR.md`.
  `test/docsFreshness.test.ts` will tell you when they drift.
- New UI strings go in `src/i18n/locales/en.ts` first; `pt-BR.ts` has to
  implement the same contract, and the type system enforces it.
- Identifiers and new comments are written in English. Existing comments
  are still largely in Portuguese and are being migrated — translating a
  block you are already touching is a welcome PR on its own.

## Reporting a security issue

Do not open a public issue. See [SECURITY.md](SECURITY.md).

## License

By contributing you agree that your contribution is licensed under the
[MIT License](../LICENSE) that covers this project.
