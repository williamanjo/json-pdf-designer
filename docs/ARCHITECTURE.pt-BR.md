**Português** | [English](ARCHITECTURE.md)

# Arquitetura

Mapa da árvore de código pra quem precisar mexer em algo — agrupado por
responsabilidade, não por ordem de import.

## Modelo de dados (`src/types/`)

```ts
export type Schema = TextSchema | TableSchema | ImageSchema | SectionSchema | ChartSchema | KpiSchema;

export type Template = {
  version?: TemplateVersion; // versão do formato — ausente = 1, ver src/template/migrate.ts
  page: PageSize; // { width, height } em mm
  headerHeight?: number; // faixas estáticas (mm) repetidas em toda página gerada
  footerHeight?: number;
  marginLeft?: number;
  marginRight?: number;
  backgroundImage?: string; // PNG data URI, fundo tipo letterhead
  schemas: Schema[];
};

export type Binding =
  | { schemaName: string; type: "scalar"; path: string }
  | { schemaName: string; type: "array"; path: string; columns: TableColumn[] }
  | { schemaName: string; type: "keyvalue"; paths: string[] }
  | { schemaName: string; type: "template"; template: string }
  | { schemaName: string; type: "section"; path: string }
  | { schemaName: string; type: "chart"; path: string; labelColumn: string; valueColumn: string; filters?: ChartFilterGroup[] };
```

Todo `Schema` compartilha `BaseSchema` (`id`, `name`, `x`/`y`/`width`/
`height` em mm, `locked?`, `sectionId?`) mais os campos específicos de
cada tipo — ver `src/types/schema.ts` pra forma completa e atual de cada
um (cresce toda vez que um tipo de campo ganha uma opção nova, então esse
arquivo é a fonte da verdade, não este doc).

Unidade de medida: **mm** em todo o modelo de dados (fácil de raciocinar
— folha A4 é 210×297mm). Convertido pra **px** só pra renderizar no canvas
do editor (`src/units.ts`, `mmToPx`/`pxToMm`) e pra **pt** na hora de
desenhar o PDF de verdade via pdf-lib (`mmToPt`).

## Editor (`src/designer/Designer.tsx` + `src/components/`)

`Designer.tsx` guarda o estado de seleção, a barra de abas (Campos/Dados/
Estilo/Filtro/Página), clipboard (copiar/colar), atalhos de teclado, e
toda mutação em `Template`/`Binding[]` (adicionar/remover/reordenar
schemas, atualizar um vínculo, redimensionar faixa de página...).
Renderiza dois filhos:

- **`PageCanvas.tsx`** — a página de verdade: um `<Rnd>` (react-rnd) por
  schema pra arrastar/redimensionar, as faixas de cabeçalho/rodapé/margem
  desenhadas em vermelho, a grade, seleção por caixa (marquee), controles
  de zoom. Delega a aparência de cada campo pra **`FieldBox/`** (um
  componente pequeno por `schema.type` — `TextField.tsx`,
  `TableField.tsx`, `ImageField.tsx`, `SectionField.tsx`,
  `ChartField.tsx`, `KpiField.tsx`).
- **O painel lateral** — `FieldList.tsx` (lista de campos, clique
  seleciona), `Toolbar.tsx` (botões de adicionar campo) e, com um campo
  selecionado, `PropertyPanel.tsx` — um dispatcher fino pra um
  `PropertyPanel<Tipo>.tsx` por tipo de schema, cada um dividido em aba
  "Dados" e "Estilo". `BindingEditor.tsx` (o editor de vínculo genérico
  de path/array/seção/gráfico) e `PropertyPanelFields.tsx` (inputs
  compartilhados de X/Y/largura/altura) são reaproveitados por vários
  deles.

Seleção, edição e vínculo vivem todos na mesma árvore React — sem ponte
de módulo, sem API imperativa entre canvas e painel.

## Vínculos e templates (`src/bindings/`, `src/table/columns.ts`)

`bindings.ts` é lógica pura sobre strings/objetos simples, sem
dependência de terceiros:

- `resolveToken`/`renderTemplate` — avalia um template `{token}`/
  `{FUNÇÃO(...)}` contra o JSON de verdade, delegando pro motor de
  expressões em `src/expressions/` (ver abaixo). `renderTemplate` é quem
  transforma um `TextSchema.content` ou um
  `KpiSchema.title`/`value`/`subtitle` na string que de fato é desenhada.
  A formatação dentro de `DATE`/`CURRENCY` é propositalmente
  independente do idioma da UI do Designer (prop `locale`, ver abaixo) —
  é parte do conteúdo do relatório gerado, escrito por quem monta o
  template, não da casca da ferramenta.
- `buildInputs` — transforma o documento JSON inteiro + `Binding[]` num
  `Record<schemaName, string>` plano (ou um array 2D serializado, pra
  tabelas) que tanto o preview do canvas quanto o `generate.ts` leem.
- `resolveChartItems`/`aggregateChartItems` — resolve o `Binding` de um
  gráfico contra o array de verdade, aplica `filters` (grupos em OU de
  condições em E), agrupa o resto em "Outros" a partir de `topN`.
- `describeBinding`/`describeBindingShort` — resumos legíveis usados só
  na UI do editor (aceitam um `Dict` opcional pro `locale` ativo, default
  inglês).

`table/columns.ts` guarda as funções puras que mantêm `head`/`content`/
`footer`/`columnStyles` de uma `TableSchema` sincronizados com o
`Binding` dela (array) quando uma coluna é adicionada/removida/
reordenada/reformatada pelo painel.

### Degradar ou falhar: onde está a linha

O `src/pdf/textSafety.ts` guarda as duas metades de uma decisão, e a divisão
vale entender antes de mexer em qualquer uma.

Problema no **dado** degrada. Caractere de controle (`
`, `	`, NUL) vira
espaço em todo caminho que chega ao papel — o `truncateToWidth` é o funil de
célula de tabela, KPI e rótulo de gráfico, e o `renderText.ts` sanitiza o
próprio valor porque é o único caminho que não trunca. Fonte nenhuma tem glifo
pra caractere de controle, nem uma Unicode completa, então isso é a única
renderização possível, não perda de conteúdo. Antes disso, um `
` no nome de um
cliente fazia o documento inteiro falhar.

Caractere que uma fonte *completa* renderizaria, mas esta não, falha — e o
`withGlyphContext` é o que torna a falha útil. Ele envolve uma chamada de
desenho e, no erro, acha o caractere culpado testando os candidatos um por um
contra a fonte, em vez de casar a mensagem de erro do pdf-lib (o mesmo erro que
a hierarquia de erros do motor de expressões existe pra evitar). A lista de
candidatos é uma função **lazy**, então resolver os rótulos de um gráfico ou
achatar as linhas de uma tabela não custa nada no caminho normal. É aplicado em
cinco pontos: o campo de texto, o KPI e o gráfico no `render/index.ts`, e dentro
do `drawTableSlice`, que é o funil dos três caminhos de tabela (corpo, faixa
repetida, aninhada em seção).

O `docs/USAGE.pt-BR.md`, "O que pode e o que não pode derrubar uma geração", é a
versão da mesma tabela voltada pra quem usa — mantenha as duas em sincronia.

## O motor de expressões (`src/expressions/`)

`parse -> AST -> evaluate`, em quatro arquivos: `tokenize.ts`, `parse.ts`,
`evaluate.ts`, mais o registry `functions.ts` (os 11 nomes de
`CUSTOM_FIELD_FUNCTIONS`). O `dataAccess.ts` e o `formatters.ts` guardam a
busca de path, a comparação de valor e a formatação de DATE/CURRENCY — moram
aqui, e não em `bindings.ts`, porque o `bindings.ts` importa o motor, então o
motor não pode importar de volta.

Três decisões que vale conhecer antes de mexer:

- **Um operador só é operador quando cercado de espaço em branco dos dois
  lados.** `{my-key}` e `{my key}` são paths; `{a - b}` é subtração; `{a -b}`
  não é nenhum dos dois. Não é uma esquisitice pra limpar — é o que permite
  uma chave JSON com hífen ou com espaço, template em produção depende disso, e
  um tokenizador convencional quebraria `{my-key}` em três tokens e devolveria
  0. O `tokenize.ts` implementa isso explicitamente, com testes.
- **Valores intermediários são `string | number`, coagidos na fronteira de
  cada operador.** O motor que isto substituiu mantinha todo intermediário
  como string e reparseava em cada nível de aninhamento — daí ele não ter
  precedência de operador (`{a + b * c}` dava 20, não 14), nem agrupamento por
  parêntese (`{(a + b) * c}` dava 0), e estourar em `{"x" + 1}` e `{a / 0}`:
  esses dois caíam numa recursão infinita que o guarda de aninhamento pegava,
  reportando um problema de profundidade que não existia.
- **`SUM`/`COUNT`/`AVG` recebem um path de array cru, não um valor.** Em
  `SUM(itens.total)`, `itens.total` quer dizer "a coluna `total` do array
  `itens`". É por isso que os nós `call` guardam `argSources` (o texto
  original) ao lado dos `args` já parseados.

Sem `eval`/`new Function`: um template pode vir de fonte não confiável, então o
avaliador percorre a AST. O `MAX_EXPRESSION_DEPTH` (40) protege a call stack do
V8 contra template mal-formado ou malicioso.

Os erros são uma hierarquia de dois membros em `errors.ts` —
`ExpressionSyntaxError` e `ExpressionDepthError`, os dois sob
`ExpressionError`. A classe base é o que o `resolve.ts` captura, e isso
importa: a geração engole problema de **template** (o campo renderiza vazio, o
editor aponta) e deixa passar o resto, porque engolir tudo esconderia bug do
motor. Reconhecer um deles casando a mensagem seria o mesmo erro com outra
cara — e foi: o erro de profundidade era um `Error` cru farejado por regex, e
por isso uma expressão aninhada demais derrubava o PDF inteiro.

## Geração do PDF (`src/pdf/`)

`generate.ts` é o ponto de entrada (`generatePdf(template, data,
bindings, options?)`) — JS puro, sem DOM, seguro de rodar em Node. É só um
orquestrador fino: pergunta pro `layout/` onde tudo cai e desenha o que volta.
Não contém nenhuma decisão de paginação própria (ver "Layout e desenho"
abaixo).

- `layout/` — funções puras, sem `pdf-lib` nenhum:
  - `layoutDocument.ts` — **A** travessia de paginação: entram `Template` +
    dado + vínculos, sai um `LayoutDocument` (páginas de `Placement`s já
    posicionados e com valor resolvido).
  - `layoutTypes.ts` — os tipos `BodyItem`/`FlowBounds`.
  - `bodyLayout.ts` — agrupa os schemas de uma página em `BodyItem`s
    ordenados por Y (`buildBodyItems`), mais os helpers (`boundsOf`,
    `gapAfter`) que a travessia usa pra percorrer essa sequência.
  - `pageLayout.ts` — `normalizePageDefs` (`Template` de página única vs.
    `Template.pages` multi-página).
  - `sectionLayout.ts` — quantas repetições uma seção vinculada tem e
    quanto cada uma ocupa depois das tabelas mestre-detalhe crescerem.
- `render/` — o desenho de verdade, um arquivo por tipo de campo,
  despachado pelo `drawFieldOfType` de `render/index.ts`:
  - `renderTable.ts` — linhas de cabeçalho/corpo/rodapé, override de
    estilo por coluna, paginação quando a tabela não cabe numa página só.
  - `renderSection.ts` — repete o grupo de campos membros uma vez por
    item do array vinculado, crescendo/paginando junto com o resto do
    corpo.
  - `renderChart.ts` — pizza/rosca ou barra, posição da legenda, paleta
    de cores (`src/chart/colors.ts`).
  - `renderKpi.ts` — o cartão colorido + o path do ícone Material Symbols
    (`src/materialIcons.ts`).
  - `renderText.ts`/`renderImage.ts` — os dois tipos de campo mais
    simples; `renderImage.ts` também guarda os limites de segurança de
    tamanho/contagem de imagem (`MAX_IMAGE_BYTES`/`MAX_DISTINCT_IMAGES`).

### Layout e desenho: uma travessia, depois pintura

O `layout/layoutDocument.ts` decide **toda** a paginação de um Template + dado
+ vínculos, sem desenhar nada e sem tocar em pdf-lib. Devolve um
`LayoutDocument`: uma entrada por página física, cada uma com `Placement`s já
posicionados (`yMm` vindo do cursor do fluxo) e já resolvidos (o valor do
texto, as linhas de uma fatia de tabela). O `generate.ts` então percorre esse
array e pinta; não contém nenhuma decisão de paginação.

Essa forma é recente e vale entender, porque substituiu um risco de verdade. A
paginação era calculada **duas vezes**: o laço de desenho decidia quebra de
página e desenhava na mesma passada, e o `countBodyPages` percorria o corpo uma
segunda vez só pra produzir o total — o `{pageCount}` tem que estar certo já na
primeira página física, então a contagem precisa terminar antes do primeiro
traço. As duas compartilhavam só as decisões atômicas de `pagination.ts`
(`needsNewPageForItem`, `computeTableSlice`); o avanço de cursor, o laço de
fatiar tabela e a repetição de seção existiam em duas cópias. Uma mudança em
uma delas significava "o dry-run disse 7 páginas, o desenho fez 8" — silencioso
e muito difícil de rastrear.

Hoje a contagem de páginas é `pages.length`, então a divergência é
estruturalmente impossível.

Duas consequências que vale manter:

- **O cursor depois de uma tabela avança por `computeTableSlice().heightMm`,**
  não pelo Y que o `drawTableSlice` devolve. A geometria de tabela é
  determinística (`TABLE_ROW_HEIGHT_MM` é fixo e a célula trunca em vez de
  quebrar linha), então a altura é função da CONTAGEM de linhas — que é
  exatamente o que permite o layout saber onde a tabela termina sem
  desenhá-la.
- **O `layout/` não pode importar do `render/`.** A medição de seção mora em
  `layout/sectionLayout.ts` e as métricas de tabela em `pdf/tableMetrics.ts`
  por esse motivo; o `render/renderTable.ts` importa `rgb` do pdf-lib como
  valor, e arrastar isso pro grafo do layout custaria a independência dele — a
  propriedade que permite o mesmo `LayoutDocument` alimentar outra coisa além
  do pdf-lib mais adiante.

`{pageNumber}`/`{pageCount}` são resolvidos pelo **renderizador**, não pelo
layout, e só pras faixas repetidas (cabeçalho/rodapé/margem) — nenhum campo do
corpo os usa. É isso que remove o ovo-e-galinha que tornava o dry-run
necessário.

Módulos de apoio (continuam direto sob `src/pdf/`, usados tanto por
`layout/` quanto por `render/`): `pagination.ts` (divide o corpo entre
páginas contra `headerHeight`/`footerHeight`/`marginLeft`/`marginRight`,
ver `src/zones.ts` pra como o editor classifica um campo em cabeçalho/
rodapé/margem/corpo só pela posição), `fontUtils.ts` (embute uma fonte
TTF própria via `fontkit`, `normalizeFontBytes`), `backgroundImage.ts`
(transforma um PNG/JPEG enviado no PNG de fundo da página — só imagem,
ver a fronteira de entry points abaixo), `color.ts`, `resolvers.ts` e
`pdfWorker.ts` (configura o worker do `pdf.js`, browser-only).

Só `downloadPdf`, `Designer`, `PdfPreview*` e os componentes de UI tocam
o DOM. Todo o resto sob `src/pdf/`, `src/bindings/` e `src/types/` é
seguro de importar num backend Node (ver
[BACKEND_INTEGRATION.pt-BR.md](BACKEND_INTEGRATION.pt-BR.md)).

## Entry points e a fronteira do pdf.js

Três entries compilados, cada um um subconjunto de exports mantido à mão:

- `src/index.ts` — `"json-pdf-designer"`, a superfície de browser inteira
  (`<Designer>`, componentes de UI, `generatePdf`/`downloadPdf`, i18n).
- `src/server.ts` — `"json-pdf-designer/server"`, o mesmo menos tudo que é
  React/DOM, pra um backend Node nunca resolver react.
- `src/preview.ts` — `"json-pdf-designer/preview"`, `PdfPreview`,
  `PdfPreviewModal`, `configurePdfWorker`.

O `pdfjs-dist` é **peer dependency opcional** (~35MB instalado), e o grafo
do `/preview` é o único lugar que pode importá-lo. Renderizar o preview
também é a única coisa pra que o pacote usa pdf.js — e é por isso que o
`backgroundImage.ts` aceita só imagem: rasterizar um PDF enviado teria
colocado o pdf.js de volta no `<Designer>`, e portanto no entry principal,
pra todo mundo. Um `import()` lazy também não resolveria: o bundler ainda
precisa resolver o specifier em tempo de build.

### Os peers opcionais, e por que são opcionais

Cinco pacotes são peer dependencies com `optional: true`, e nenhum deles é
opcional por acidente:

| Peer | Usado por | Custo se fosse obrigatório |
|---|---|---|
| `react`, `react-dom` | `<Designer>` e os componentes de UI | um backend Node resolvendo React que nunca renderiza |
| `react-rnd` | só o `PageCanvas.tsx` (arrastar/redimensionar) | ver abaixo — ele puxa o React junto |
| `pdfjs-dist` | só o grafo do `/preview` | ~35MB instalados |
| `wawoff2` | `fontUtils.ts`, lazy, pra fonte `.woff2` | caminho WASM só-Node que bundler avisa |

O `react-rnd` é o sutil. Ele era `dependency` normal até a 2.0.0, então era
instalado sempre — e como os peers `react`/`react-dom` *dele* **não** são
opcionais, o npm instalava o stack React inteiro (`react`, `react-dom`,
`react-draggable`, `re-resizable`, `scheduler`, `prop-types`, …: cerca de
8,7MB) até num projeto que só importa `/server`. O nosso próprio
`optional: true` no react era derrotado em silêncio um nível abaixo. Um
install de backend hoje resolve `fontkit`, `pdf-lib` e `tiny-inflate` mais
as árvores deles, e nada de React.

### Como as fronteiras são garantidas

Um import no arquivo errado quebra uma promessa de *empacotamento*, não o
build: custa megabytes que ninguém pediu pra todo consumidor, ou deixa uma
dependência real não declarada — e só apareceria no `npm install` de outra
pessoa. Três checagens guardam isso, cada uma cobrindo um ângulo que as
outras não pegam:

1. **`test/entryBoundaries.test.ts`** (roda no `npm test`) — percorre o
   grafo de código a partir de `src/index.ts`, `src/server.ts` e
   `src/preview.ts` seguindo imports relativos, e garante que:
   - o `/server` não alcança `react`, `react-dom` nem `react-rnd`;
   - nem o entry principal nem o `/server` alcançam o `pdfjs-dist`.

   A mais rápida e a mais precisa: ela nomeia o arquivo culpado. Dois casos
   de controle garantem que a varredura ainda *vê* o que deveria — pdf.js
   pelo `/preview`, React e `react-rnd` pelo entry principal — pra que um
   walker quebrado não faça as outras afirmações passarem por vacuidade.

   Ela ignora statements type-only (`import type` / `export type … from`),
   que são apagados na compilação: o `src/server.ts` legitimamente faz
   `export type { Locale, Dict } from "./i18n"`, e o `./i18n/index.ts`
   reexporta o `I18nProvider`, que é React. Nada disso chega no
   `dist/server.*` — nem o JS nem o `.d.ts`, que o tsup inlineia.
2. **`examples/no-preview`** (builda na CI) — um app que nunca instala o
   `pdfjs-dist`, cobrindo o `node_modules` de verdade em vez da árvore de
   código. Omitir a dependência não basta sozinho: o example linka o pacote
   com `file:../..`, e um bundler resolve import bare pelo caminho *real* do
   arquivo — então um import vazado ainda acharia o pdf.js no
   `node_modules` do repo pai (onde ele existe como devDependency). É por
   isso que o script `build` dele termina no `check-no-pdfjs.mjs`, que varre
   o bundle gerado procurando símbolos do pdf.js (`GlobalWorkerOptions`,
   `PDFDocumentLoadingTask`, `pdf.worker.min.mjs`). Nunca adicione o
   `pdfjs-dist` nesse example — isso anula a checagem.
3. **A checagem do tarball em `.github/workflows/ci.yml`** — depois de
   `npm install ./pkg.tgz`, garante que o `node_modules/pdfjs-dist` não
   existe. Essa prova a afirmação de *empacotamento*: o npm não puxa o peer
   sozinho, ou seja, ele continua opcional de verdade.

## Idioma da UI (`src/i18n/`)

O texto da própria UI do Designer (botões, abas, avisos, placeholders)
vem de um dicionário pequeno — `en.ts` (canônico, default) e `pt-BR.ts`
(tipado contra ele, então uma chave faltando é erro de compilação, não
uma string vazia silenciosa). `I18nProvider`/`useT`/`useLocale` (contexto
React) ligam a prop `<Designer locale="en" | "pt-BR">` até cada
componente; um componente usado sozinho, sem `<Designer>` por cima,
continua renderizando texto certo (em inglês) via o valor default do
contexto. Isso só cobre a casca do editor — nunca muda como
`{DATE(...)}`/`{CURRENCY(...)}` formatam o conteúdo do relatório gerado
(ver "Vínculos e templates" acima).
