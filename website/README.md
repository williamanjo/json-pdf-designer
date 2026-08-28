# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Installation

```bash
npm install
```

**Note**: feel free to use the package manager of your choice.

## Local Development

```bash
npm run start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

## Build

```bash
npm run build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

This site is deployed automatically by `.github/workflows/pages.yml`
(GitHub Actions → GitHub Pages) on every push to `master`, alongside
the three playground apps under `examples/`. `npm run deploy` (the
Docusaurus `gh-pages`-branch script) isn't used — don't run it, it
would publish a stale/incomplete site.
