**Português** | [English](ARCHITECTURE.md)

# Arquitetura

Mapa da árvore de código pra quem precisar mexer em algo — agrupado por
responsabilidade, não por ordem de import.

## Modelo de dados (`src/types/`)

```ts
export type Schema = TextSchema | TableSchema | ImageSchema | SectionSchema | ChartSchema | KpiSchema;

export type Template = {
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
  `{FUNÇÃO(...)}` contra o JSON de verdade (`CUSTOM_FIELD_FUNCTIONS`:
  SUM/COUNT/AVG/CONCAT/UPPER/LOWER/TRIM/DATE/CURRENCY/NUMBER).
  `renderTemplate` é quem transforma um `TextSchema.content` ou um
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

## Geração do PDF (`src/pdf/`)

`generate.ts` é o ponto de entrada (`generatePdf(template, data,
bindings, options?)`) — JS puro, sem DOM, seguro de rodar em Node. Pra
cada `schema`, resolve o valor via `buildInputs`/`resolveToken` e delega
o desenho de verdade pra um módulo por tipo:

- `drawTable.ts` — linhas de cabeçalho/corpo/rodapé, override de estilo
  por coluna, paginação quando a tabela não cabe numa página só.
- `drawSection.ts` — repete o grupo de campos membros uma vez por item do
  array vinculado, crescendo/paginando junto com o resto do corpo.
- `drawChart.ts` — pizza/rosca ou barra, posição da legenda, paleta de
  cores (`src/chart/colors.ts`).
- `drawKpi.ts` — o cartão colorido + o path do ícone Material Symbols
  (`src/materialIcons.ts`).

Módulos de apoio: `pagination.ts` (divide o corpo entre páginas contra
`headerHeight`/`footerHeight`/`marginLeft`/`marginRight`, ver
`src/zones.ts` pra como o editor classifica um campo em cabeçalho/
rodapé/margem/corpo só pela posição), `fontUtils.ts` (embute uma fonte
TTF própria via `fontkit`, `normalizeFontBytes`), `backgroundImage.ts`
(transforma um PDF/PNG/JPEG enviado no PNG de fundo da página),
`color.ts`, `resolvers.ts`, e `pdfWorker.ts` (configura o worker do
`pdf.js` pro `PdfPreview`, browser-only).

Só `downloadPdf`, `Designer`, `PdfPreview*` e os componentes de UI tocam
o DOM. Todo o resto sob `src/pdf/`, `src/bindings/` e `src/types/` é
seguro de importar num backend Node (ver
[BACKEND_INTEGRATION.pt-BR.md](BACKEND_INTEGRATION.pt-BR.md)).

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
