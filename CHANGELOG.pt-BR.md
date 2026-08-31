[English](CHANGELOG.md) | **Português**

# Changelog

Todas as mudanças relevantes deste pacote ficam documentadas aqui.
Formato inspirado, sem seguir à risca, em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## 1.6.3 (2026-08-31)

### Removido

- **Dependência `lodash.get`** — o único ponto que usava (resolver o
  path do array vinculado de uma seção repetida) passou a usar a
  própria função de path case-insensitive que o pacote já tinha (agora
  exportada de `bindings.ts` como `getCaseInsensitive`), igual todo
  outro tipo de vínculo já resolvia. Remove `lodash.get` e
  `@types/lodash.get` de vez (ambos marcados deprecated pelo próprio
  autor) e corrige uma inconsistência real: path de seção era
  case-sensitive enquanto chart/kpi/tabela já não eram.

## 1.6.2 (2026-08-31)

### Quebra de compatibilidade (dependência peer)

- **`wawoff2` não vem mais instalado sozinho** — saiu de `dependency`
  obrigatória pra **dependência peer opcional**
  (`peerDependenciesMeta.wawoff2.optional: true`). Só quem embute fonte
  `.woff2` de verdade (`generatePdf(..., { fontBytes })` com bytes de um
  `.woff2`) precisa dela agora; rode `npm install wawoff2` no seu
  próprio projeto se for o caso. Sem ele instalado, passar um `.woff2`
  lança um erro claro (em vez do descompressor simplesmente estar lá
  por baixo) pedindo pra instalar ou converter a fonte pra `.ttf`/`.otf`
  offline antes. `.ttf`, `.otf` e `.woff` (v1, descomprimido via
  `tiny-inflate`, que continua obrigatório) não são afetados.
  - Motivo: o binding WASM do `wawoff2` tem um caminho de código só pra
    Node (`fs`/`path`) que bundlers tipo Vite acusam com um aviso
    confuso (mas inofensivo) de "externalized for browser
    compatibility" — pra TODO consumidor, mesmo quem nunca embute fonte
    customizada nenhuma. Tornar opcional faz esse aviso, e o binário
    WASM em si, só aparecerem pra quem realmente usa a funcionalidade.
  - `src/pdf/fontUtils.ts` agora carrega
    `wawoff2/build/decompress_binding.js` sob demanda, via `import()`
    dinâmico em vez de estático, só no momento real de descomprimir um
    `.woff2`.

### Adicionado

- Paleta de cores da tabela ganhou uma entrada **"Personalizada"**
  explícita e clicável no seletor (antes só era alcançável
  implicitamente, sem escolher nenhum preset).
- **Linhas zebradas** da tabela agora é um interruptor à parte de qual
  paleta/preset está ativo — qualquer preset pode ser aplicado com ou
  sem listras.
- **`TableSchema.borderColor`** — a cor da grade da tabela agora é
  configurável (antes era um cinza fixo tanto no PDF gerado quanto no
  preview do canvas); presets de cor também aplicam uma cor de borda de
  verdade.

## 1.6.1

- Refatoração interna: reorganizou `src/` por domínio (`table/`,
  `chart/`, `designer/`, `bindings/builders.ts` etc. — ver
  [docs/ARCHITECTURE.pt-BR.md](docs/ARCHITECTURE.pt-BR.md) e
  [docs/USAGE.pt-BR.md](docs/USAGE.pt-BR.md#estrutura-do-pacote) pra
  estrutura atual), extraiu helpers compartilhados pra remover
  duplicação entre o código de desenho do PDF e do canvas, e adicionou
  cobertura de teste pra módulos de lógica pura que não tinham nenhuma.
  Sem mudança de API pública.
- Corrigiu o contorno da tabela desenhando um quadrado por cima do
  preenchimento arredondado quando `headBorderRadius`/
  `bodyBorderRadius`/`footerBorderRadius` estava definido.

## 1.6.0 e anteriores

Ver o [histórico de commits no GitHub](https://github.com/williamanjo/json-pdf-designer/commits/master)
pras mudanças de antes deste changelog existir.
