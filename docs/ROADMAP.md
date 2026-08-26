# Depois da v1

Não faz parte do escopo inicial — anotado aqui pra não esquecer, não pra
fazer já.

## Mais tipos de campo
- `date` / `select` / `checkbox` — mais fácil que parece, já que o
  `FieldRenderer` já troca por `schema.type`; só adicionar o tipo em
  `types.ts` + o desenho no `generate.ts`.
- `qrcode`/`barcode` — precisa de uma libzinha de geração de código de
  barras (ex. `bwip-js` ou `jsbarcode` + canvas -> embedPng no pdf-lib).
- `signature` — canvas de assinatura + embed como imagem.

## Múltiplas páginas
Hoje o modelo (`Template.schemas: Schema[]`) é uma página só. Pra suportar
mais de uma: `Template.pages: Schema[][]`, canvas com abas/scroll por
página, `generate.ts` faz um `doc.addPage()` por página do array.

## Publicar de verdade
`LICENSE`, `repository`/`homepage`/`author`/`keywords` no `package.json` já
estão prontos. Falta só: `CHANGELOG.md`, e tirar `"private": true` quando
decidir publicar de verdade (`npm publish --dry-run` já funciona pra
conferir o conteúdo do tarball antes disso).
