# custom-ui-example

**As mesmas funcionalidades e o mesmo layout do exemplo
[`report-builder`](../report-builder)** — só que a casca inteira (header,
sidebar, cards, árvore de campos, modais, botões, inputs) é **CSS puro
escrito à mão** (`src/index.css`), sem Tailwind e sem nenhum
`Button`/`Card`/`Input`/`Textarea`/ícone/`PdfPreviewModal` importado do
pacote.

Os dois exemplos existem lado a lado de propósito: o `report-builder`
mostra o caminho rápido (usar os componentes prontos que a lib exporta);
este aqui mostra que a mesma aplicação sai idêntica em capacidade com um
design system totalmente seu.

O `<Designer>` em si continua com a aparência pronta do pacote — ele é
uma peça só (canvas + painel de propriedades + toolbar), não dá pra
"desmontar" e trocar só uma parte. O que fica 100% livre é tudo em volta.

## Como rodar

```bash
npm install
npm run dev
```

Abre em `http://localhost:5174` (porta fixa em `vite.config.ts` — o
`report-builder` usa a 5173, pra rodar os dois ao mesmo tempo sem
conflito).

## O que tem

Paridade completa com o `report-builder`:

- **Múltiplas fontes de dados JSON** — colar, arrastar arquivos `.json`
  (vários de uma vez), renomear, remover. Na hora de gerar, todas são
  mescladas no nível superior (última chave repetida vence). Erro de
  parse é mostrado por fonte.
- **Explorador de campos** — "Resync campos" varre o JSON mesclado e
  monta uma árvore: variáveis nativas (`pageNumber`, `pageCount`) +
  campos do JSON agrupados por DataSource, cada coluna de array
  arrastável individualmente.
- **Arrastar campo pro canvas** — escalar vira texto vinculado; array com
  colunas vira tabela; coluna solta entra numa seção já vinculada ao
  mesmo array. Botão `+` abre um modal pra adicionar sem arrastar.
- **6 templates de exemplo** no dropdown (Lei Kandir, Recibo, Pedidos com
  Itens, Boletim de Turma, Relatório Financeiro, Painel de Vendas) — cada
  um troca template, vínculos e a fonte de dados de uma vez.
- **Undo/redo** (`Ctrl+Z` / `Ctrl+Shift+Z`) e **autosave** em
  `localStorage` (chave `custom-ui:autosave-v1`).
- **Salvar/carregar projeto** como `.json`.
- **Idioma da UI do `<Designer>`** (en / pt-BR) via prop `locale` — não
  afeta o PDF gerado.
- **Prévia do PDF** num modal próprio, com zoom que ajusta a folha
  inteira ao redimensionar a janela, e botão de baixar.
- Dados de exemplo são **fabricados** — nenhum CNPJ/nome real.

## O que vem do pacote e o que é local

Do `json-pdf-designer` só entram peças que **não são chrome**:

| Do pacote | Local (HTML/CSS deste app) |
| --- | --- |
| `<Designer>` (canvas + painel de propriedades) | header, sidebar, cards, botões, inputs, selects |
| `<PdfPreview>` (renderizador pdf.js em `<canvas>`) | o modal de prévia em volta dele |
| `generatePdf`, `downloadPdf` | árvore de campos, painel de fontes, modal de picker |
| `I18nProvider` (só pras mensagens do `<PdfPreview>`) | |
| `classifyZone`, `makeSectionColumnPair`, tipos | |

## Estrutura do código

```
src/
  components/
    DataSourcePanel.tsx  -> múltiplas fontes JSON (colar/arrastar/mesclar/resync)
    FieldTree.tsx        -> árvore de campos arrastável (nativos + JSON agrupado)
    DesignerPanel.tsx    -> <Designer> + drop no canvas + modal de picker de campos
    PdfPreviewModal.tsx  -> modal de prévia próprio, em volta do <PdfPreview> do pacote
  data/
    initialTemplate.ts   -> template/vínculos/amostra iniciais
    templates/           -> os 6 exemplos do dropdown
    samples/             -> os JSONs de amostra de cada exemplo
  hooks/
    useUndoRedo.ts       -> histórico de template+vínculos (Ctrl+Z / Ctrl+Shift+Z)
    useAutosave.ts       -> persistência em localStorage
  lib/
    jsonExplorer.ts      -> varre o JSON e monta a lista/árvore de campos
    sources.ts           -> mescla as fontes num objeto só
    projectFile.ts       -> salvar/carregar o projeto como .json
    font.ts              -> Inter (TTF) embutida no PDF gerado
    uid.ts
  App.tsx     -> estado + casca (header/sidebar/main)
  index.css   -> CSS puro (sem Tailwind) de TODA a casca — cores/layout próprios
  main.tsx    -> importa "json-pdf-designer/style.css" (obrigatório — estiliza o <Designer> por
                 dentro) + "./index.css"
```

Os arquivos de `lib/`, `hooks/` e `data/` são cópias dos do
`report-builder` — nenhum deles toca em UI, então são idênticos de
propósito: cada exemplo continua autocontido e instalável sozinho.

## Por que ainda importa `json-pdf-designer/style.css`

O CSS do pacote não depende do consumidor ter Tailwind configurado — vem
**pré-compilado** (`dist/style.css`, gerado a partir do próprio `src/` da
lib). Esse import é sobre o `<Designer>` renderizar certo por dentro
(painel de propriedades etc), não sobre a casca deste app — a prova de
que dá pra usar sem Tailwind nenhum no lado do consumidor é este próprio
example não ter `@tailwindcss/vite` nem `tailwind.config` em lugar nenhum.
