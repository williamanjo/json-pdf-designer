# custom-ui-example

**As mesmas funcionalidades e o mesmo layout do exemplo
[`report-builder`](../report-builder)** — só que **NENHUMA linha de CSS do
pacote é importada**, e **a cara é de outra família de produto**. Nem
`json-pdf-designer/style.css`, nem `json-pdf-designer/theme.css`. Tudo — a
casca (header, sidebar, cards, árvore de campos, modais, botões, inputs)
**e o miolo do `<Designer>`** (canvas, faixas, réguas, barra de zoom,
abas, painel de propriedades) — é **CSS puro escrito à mão** em
`src/index.css`, sem Tailwind e sem nenhum
`Button`/`Card`/`Input`/`Textarea`/ícone/`PdfPreviewModal` do pacote.

Os dois exemplos existem lado a lado de propósito: o `report-builder`
importa o `theme.css` e usa os componentes prontos que a lib exporta;
este aqui é a **prova de que a folha do pacote é opt-in**. Não importar
ela é modo suportado: cada elemento que o `<Designer>` renderiza carrega
uma classe semântica estável `jpd-*` mais atributos `data-*` de estado, e
é isso que o CSS daqui estiliza.

Se você já tem design system próprio (CSS puro, SCSS, Bootstrap,
styled-components, seu Tailwind), este é o exemplo pra copiar.

## O look: app macio, creme e coral

Este example é o único dos cinco cuja aparência **não tem como sair do
`theme.css`** — nem trocando todos os `--jpd-*`. É por isso que ele existe,
e a captura de tela tem de mostrar isso:

| | `theme.css` do pacote | aqui |
|---|---|---|
| botão | retângulo, raio **8px** | **pílula** (`999px`), circular quando é ícone |
| card | raio 12px **+ borda 1px** | raio **20px**, **sem borda** — só sombra |
| input | borda 1px, raio 6px | **preenchido** em creme, raio **12px**, borda transparente |
| superfície | separada por **linha** | separada por **sombra em duas camadas** |
| fundo | branco / cinza-ardósia | **creme** `#fdf8f3` |
| accent | sky/blue | **coral** `#ff6b5b` |
| texto | slate (cinza-azulado) | **marrom** `#4a382f` |
| barra de topo | ardósia `#0f172a` | **cacau** `#4a332b` |
| rótulo de seção | CAIXA ALTA + `letter-spacing` | **minúscula**, peso 700 |
| fonte | pilha do sistema | pilha **arredondada** (`Nunito`, `Quicksand`, `ui-rounded`, …) |
| espaçamento | denso | **um degrau mais solto** em toda caixa |

**Por que só dá aqui**: um retema por token (`--jpd-*`, como o
[`composed-layout`](../composed-layout) faz) troca valores das regras que o
`theme.css` já escreveu. Ele não pode *remover* a borda do card e substituí-la
por uma sombra em camadas, nem trocar a densidade do editor inteiro, nem
transformar `.jpd-btn` em pílula sem afetar todo elemento que compartilha
aquele raio. Aqui as regras são nossas, então essas decisões são possíveis.

Três coisas que a regra "sem borda" **não** apagou, porque ali a borda não é
moldura e sim informação:

- **foco** (`:focus-visible`) — anel sólido de 3px em `--ui-focus`, com 2px de
  folga. Sem moldura em repouso, o anel é a *única* pista de onde o teclado
  está, então ele é mais forte aqui do que num tema com bordas. Sobre a barra
  cacau ele inverte pra tom claro;
- **erro / seleção / tipo de campo** — a borda continua declarada
  `1px solid transparent` no estado neutro justamente pra que `[data-selected]`,
  `.is-error` e `.is-array` a acendam sem mudar a largura (sem pulo de 1px);
- **tracejado** de dropzone, callout e bloco travado — ali a linha diz "solte
  aqui" / "isto é dica" / "isto está desabilitado".

### Nada de webfont externa

A pilha começa em `"Nunito"`/`"Quicksand"` mas **nenhum `@font-face` e nenhum
`<link>` pra Google Fonts**: o example tem de abrir offline. Em máquina sem
essas fontes ele cai em `ui-rounded` (Safari/iOS) e depois em `system-ui`, e o
resto da identidade — raio, cor, sombra, espaçamento — sustenta o look sozinho.

### Contraste

Medido no navegador contra o fundo *composto* de verdade (não estimado), em
todos os estados: nada selecionado, cada uma das seis abas do painel, sete
tipos de campo, modal de picker, modal de fórmula, prévia do PDF e painel de
problemas com problema real. **Nenhum texto abaixo de 4.5:1.**

Paleta quente clara é onde é mais fácil errar isso, e dois casos exigiram
decisão explícita (os dois estão comentados no CSS):

- **branco sobre o coral do brief dá 2.8:1.** Por isso existem dois rótulos
  "sobre preenchimento": `--ui-text-on-coral` (marrom escuro, **5.3:1** sobre
  `#ff6b5b`) pro botão primário, e `--ui-text-on-accent` (branco) pros
  preenchimentos escuros (`--ui-accent` 5.0:1, `--ui-danger` 7.2:1,
  `--ui-section` 6.4:1). Trocar um pelo outro derruba o contraste na hora.
- **hover CLAREIA em vez de escurecer** (`#ff6b5b` → `#ff8577`): escurecendo,
  o rótulo marrom cairia abaixo de 4.5:1.

E o tema antigo tinha um caso que **regrediu pra melhor**: a coluna `z` do
Inspetor usava `#cbd5e1` sobre branco — **1.6:1**, texto que existe e não se
lê. `--ui-text-faint` continua sendo o degrau mais claro da escala, mas agora
passa 4.8:1 até dentro da linha selecionada.

### A camada `--ui-*`

O `src/index.css` tinha **276 cores e 52 raios cravados no meio das regras** e
só 7 variáveis. Um retema era 328 edições soltas — impossível de revisar, e
ilegível como material de ensino.

Agora há um bloco `:root` no topo com a paleta, a escala de raio, a de
espaçamento, as sombras e as pilhas de fonte. A regra do arquivo é:
**nenhuma cor, raio, sombra ou pilha de fonte literal fora do `:root`** (a
única exceção é o `border-radius: 0` do reset local). Fora dele restam **zero**
literais de cor e **zero** de raio.

Isso é o que faz a lição caber numa tela: trocar a identidade visual inteira
deste app é editar um bloco, não caçar 328 valores. Dois detalhes do desenho da
camada valem copiar:

- **raio de CHROME vs raio de PAPEL.** `--ui-radius-btn/control/panel/card`
  mudam com o tema; `--ui-radius-paper` e `--ui-radius-paper-lg` **não** —
  são o raio das coisas que imitam o PDF que vai sair (barra do gráfico,
  etiqueta de faixa, moldura de seção). Inflar esses faria o preview mentir
  sobre o resultado. Pelo mesmo motivo `--ui-paper` é branco puro e separado
  de `--ui-surface`: a folha é papel, não uma superfície de interface.
- **`--ui-*` não é `--jpd-*`.** Ver a última seção deste README.

## Por que este example continua no `<Designer>`

Porque ele é o **teste de regressão do caminho de uma linha**: um
`<Designer>` com as sete props de sempre (`template`,
`onChangeTemplate`, `bindings`, `onChangeBindings`, `onCanvasDrop`,
`dataSources`, `locale`) e mais nada. A 3.0.0 decompôs o editor em peças,
mas o preset continua sendo a forma normal de usar — e se ele quebrasse,
tinha de quebrar aqui primeiro, com a variável mais difícil (CSS 100%
alheio) já em jogo.

O `<Designer>` **não é indivisível**. Ele é um preset, e quem quer outro
layout usa as peças: `<DesignerProvider>` mais `<DesignerCanvas>`,
`<DesignerFieldList>`, `<DesignerToolbar>` e as outras — cada uma
aceitando `className` e `style` (e `parts`, nas que têm elemento interno
endereçável). Os dois pontos do espectro ficam nos outros exemplos:

- [`composed-layout`](../composed-layout) — layout que o preset não sabe
  fazer: toolbar na largura toda e cinco painéis empilhados numa coluna
  só (dentro do `<Designer>` seriam cinco abas).
- [`report-builder`](../report-builder) — o caso intermediário: layout
  **idêntico** ao do preset, montado com as peças só pra que a casca do
  próprio app possa ler a seleção do editor por hook.

Trocar de caminho não muda nada do que este README diz sobre CSS: as
peças põem no DOM as mesmas classes `.jpd-*` que o preset.

## Como rodar

```bash
npm install
npm run dev
```

Abre em `http://localhost:5174` (porta fixa em `vite.config.ts` — os
outros usam 5173/5175/5176/5177, pra rodar todos ao mesmo tempo sem
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
- **Múltiplas páginas** — abas próprias (`.page-tab*`) acima do editor,
  uma por `TemplatePage` do mesmo `Template`. O `<Designer>` recebe só a
  página ATIVA e não sabe que existem outras; `lib/pages.ts` garante que
  todo template que entra no estado tenha `pages` (autosave ou projeto
  salvo antes das abas existirem cai no `ensurePages`).
- **Painel de problemas** — o outro lado da tolerância da geração: uma
  expressão torta resolve pra vazio em vez de derrubar o PDF, então sem
  este painel o campo sai em branco sem explicação. Montado com
  `expressionErrors` e `fieldWarning` (exports públicos), separa "vai
  renderizar VAZIO" de "compila mas é suspeito" de "falta vínculo", e o
  clique navega até a página do campo.
- **Undo/redo** (`Ctrl+Z` / `Ctrl+Shift+Z`) e **autosave** em
  `localStorage` (chave `custom-ui:autosave-v1`).
- **Salvar/carregar projeto** como `.json`.
- **Idioma da interface** (en / pt-BR) — **um seletor, duas camadas**: o
  mesmo `locale` vai como prop pro `<Designer>` (abas, botões, avisos do
  editor) e alimenta `src/i18n.ts`, o dicionário desta casca (header,
  títulos de painel, dicas, `aria-label`, banner de erro). Não afeta o PDF
  gerado. Ver [Como o seletor de idioma troca as duas
  camadas](#como-o-seletor-de-idioma-troca-as-duas-camadas).
- **Prévia do PDF** num modal próprio, com zoom que ajusta a folha
  inteira ao redimensionar a janela, e botão de baixar.
- **Erro de geração traduzido** — o banner nunca mostra `err.message`
  cru: `lib/generationError.ts` decide por `instanceof` nas classes que o
  pacote exporta (`PageLimitError`, `UnsupportedGlyphError`,
  `ExpressionError`) e devolve título, o que fazer e de quem é a culpa
  (dado / template / configuração / pacote). É a mesma decisão que um
  backend toma pra escolher entre 413, 400 e 500 — e o tom do banner muda
  com ela: vermelho é "você conserta", cinza é "reporte".
- Dados de exemplo são **fabricados** — nenhum CNPJ/nome real.

## O que vem do pacote e o que é local

Do `json-pdf-designer` entram só **comportamento e marcação** — zero CSS:

| Do pacote | Local (HTML/CSS deste app) |
| --- | --- |
| `<Designer>` (canvas + painel de propriedades) — só o DOM e as classes `jpd-*` | **a aparência de tudo isso**, em `index.css` |
| `<PdfPreview>` (renderizador pdf.js em `<canvas>`) | o modal de prévia em volta dele |
| `generatePdf`, `downloadPdf`, `DEFAULT_MAX_PAGES` | header, sidebar, cards, botões, inputs, selects |
| `I18nProvider` (só pras mensagens do `<PdfPreview>`) | árvore de campos, painel de fontes, modal de picker |
| `expressionErrors`, `fieldWarning`, `dictFor` (painel de problemas, rótulos do modal de prévia, a palavra "página") | as abas de página, o painel de problemas e o banner de erro |
| `Locale` + o `locale` do `<Designer>` (chrome do editor) | `src/i18n.ts`, o dicionário da casca |
| `PageLimitError`, `UnsupportedGlyphError`, `ExpressionError` (as classes de erro) | |
| `classifyZone`, `makeSectionColumnPair`, tipos | |

## Estrutura do código

```
src/
  components/
    DataSourcePanel.tsx  -> múltiplas fontes JSON (colar/arrastar/mesclar/resync)
    FieldTree.tsx        -> árvore de campos arrastável (nativos + JSON agrupado)
    DesignerPanel.tsx    -> <Designer> + drop no canvas + modal de picker de campos
    PageTabs.tsx         -> abas de página da casca (uma por TemplatePage)
    ProblemsPanel.tsx    -> expressão torta / vínculo faltando, antes de gerar
    GenerationErrorBanner.tsx -> a falha de geração já traduzida
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
    pages.ts             -> ensurePages/blankPage (o Template sempre tem `pages`)
    templateProblems.ts  -> o que está torto no template (expressionErrors/fieldWarning)
    generationError.ts   -> traduz o erro de generatePdf por `instanceof`
    font.ts              -> Inter (TTF) embutida no PDF gerado
    uid.ts
  i18n.ts     -> dicionário da CASCA (pt/en) + `pageLabel` (reusa `dictFor`)
  App.tsx     -> estado + casca (header/sidebar/abas de página/main)
  index.css   -> CSS puro (sem Tailwind) de TUDO, em três partes:
                 1. `:root` -> a camada `--ui-*` (paleta, raios, espaço, sombras)
                 2. a casca deste app (`.app-header`, `.card`, `.btn`, ...)
                 3. as classes `.jpd-*` do <Designer> ("MIOLO DO DESIGNER")
  main.tsx    -> importa SÓ "./index.css" — nenhum CSS do pacote
```

Os arquivos de `hooks/` e `data/` são cópias dos do `report-builder` —
nenhum deles toca em UI, então são idênticos de propósito: cada exemplo
continua autocontido e instalável sozinho. Os de `lib/` são quase: os que
produzem texto que aparece na tela (`generationError.ts`,
`projectFile.ts`, `templateProblems.ts`, `jsonExplorer.ts`) recebem
`locale` e puxam a frase do `i18n.ts` daqui.

Os componentes, não: cada painel é reescrito com as classes daqui
(`.page-tab*`, `.problem-*`, `.gen-error*`, `.count-badge`, `.btn-banner`)
em vez do `Card`/`Badge`/`Button`/`IconX` que a versão do `report-builder`
importa. Note também que **nenhum dos três painéis novos precisou de
classe `.jpd-*` nova**: eles não renderizam elemento do editor, e é essa a
regra pra quem acrescentar painel aqui — se o painel usar um primitivo do
`<Designer>`, a classe `.jpd-*` correspondente já tem de estar no
`index.css`, senão o elemento sai como HTML nu.


### Como o seletor de idioma troca as duas camadas

O `<select>` do header alimenta **um** estado (`locale`, default `"pt-BR"`),
e esse estado vai pra dois dicionários:

| Camada | Quem traduz | Exemplo |
| --- | --- | --- |
| chrome do **editor** | o pacote, via prop `locale` do `<Designer>` | abas `Campos`/`Dados`/`Página`, botões `+ texto`, avisos de vínculo |
| **casca deste app** | `src/i18n.ts`, dicionário local | header, títulos de painel, dicas, `aria-label`, banner de erro |

`src/i18n.ts` é um par de objetos e uma função:

```ts
const pt = { saveProject: "Salvar projeto", fieldsLoaded: (n: number) => `${n} campo(s) carregado(s)` };
const en: typeof pt = { saveProject: "Save project", fieldsLoaded: (n) => `${n} field(s) loaded` };
export const t = (locale: Locale) => (locale === "pt-BR" ? pt : en);
```

Três detalhes que valem copiar:

1. **`Locale` vem do pacote.** Quando o pacote ganhar um idioma novo, o
   `en: typeof pt` para de compilar até alguém traduzir — chave faltando
   viraria `undefined` renderizado como vazio, em silêncio.
2. **Mensagem com número é função** (`fieldsLoaded: (n) => ...`), não
   concatenação no JSX: concatenar amarra a ordem das partes a um idioma.
3. **Nada de frase traduzida em estado.** O que fica guardado é o dado — o
   erro cru (`useState<{ err: unknown }>`), o código do problema da fonte
   (`"invalidJson"`), o nome do arquivo que falhou — e a frase é montada no
   render. Guardar a frase congela o idioma no momento do erro: a mensagem
   ficaria em português na tela depois de trocar o seletor pro inglês.

#### O que o seletor **não** traduz

O idioma da interface não é o idioma do documento. Continuam como estão:

- o conteúdo dos 6 templates prontos (`data/templates/`) e os rótulos deles
  no dropdown ("Lei Kandir", "Boletim de Turma") — é o documento;
- o JSON de amostra (`data/samples/`) e todo nome de campo / caminho de
  dado (`tabela_vendas`, `rows.total`, `pageNumber`) — é chave de dado;
- o nome default de uma fonte (`fonte_2`) e o do projeto salvo
  (`projeto-relatorio.json`) — trocar de idioma não pode renomear dado que
  já existe;
- o `detail` cru do banner de erro — é o texto que se cola num relato de
  bug;
- os nomes dos idiomas no próprio seletor (`Português`, `English`), como é
  convenção;
- e nada do PDF gerado.

#### Onde a casca **reusa** o dicionário do pacote

Quando o conceito já é do pacote, o rótulo sai de `dictFor(locale)` (a
versão de `useT()` que funciona como valor, fora de um `<I18nProvider>`) em
vez de virar mais uma entrada local — duas traduções do mesmo conceito são
duas coisas pra dessincronizar:

- `PdfPreviewModal.tsx` — título, `Baixar`, o `×` e o nome default do
  arquivo saem de `dict.pdfPreviewModal` / `dict.modal.close`. O pacote
  exporta um modal de prévia pronto com esses mesmos rótulos; aqui só a
  **marcação** é reescrita, o vocabulário continua sendo dele;
- `PageTabs.tsx` e `lib/templateProblems.ts` — a palavra "página" vem de
  `dict.tabBar.page` (via `i18n.ts::pageLabel`), a mesma que a aba `Página`
  do painel de propriedades usa, logo abaixo na tela;
- `lib/templateProblems.ts` — as mensagens de expressão inválida e de
  vínculo faltando vêm de `expressionErrors`/`fieldWarning` com
  `dictFor(locale)`.

### O espectro de estilo, e onde este example fica

Cada example usa uma estratégia diferente — juntos eles cobrem os dois
exports de CSS do pacote mais o modo sem nenhum:

| Example | CSS do pacote | Estratégia |
|---|---|---|
| [report-builder](../report-builder) | `theme.css` | tema como vem, zero customização |
| [composed-layout](../composed-layout) | `theme.css` | retema **só por token** (`--jpd-*`) |
| [no-preview](../no-preview) | `theme.css` | **dark mode**, com toggle |
| [headless-designer](../headless-designer) | `reset.css` | só o reset, aparência à mão |
| **custom-ui** (este) | *nenhum* | `.jpd-*` do zero (~190 classes) |

Este é o extremo caro da tabela, e é de propósito: alguém tem de provar que o
modo sem CSS nenhum funciona de verdade. Se você só quer trocar as cores,
comece pelo `composed-layout` — retema por token é uma dúzia de linhas.

O preço se paga em **liberdade de forma**, não de cor: é o único example que
pode mudar a *estrutura* do desenho (tirar a borda das superfícies e trocá-la
por sombra, virar o botão em pílula, subir a densidade do editor inteiro).
Veja [O look](#o-look-app-macio-creme-e-coral).

Guardado por `test/docsFreshness.test.ts`.

## Como estilizar o `<Designer>` sem o `theme.css`

O contrato é: **classe semântica + atributo de estado**. `theme.css` do
pacote é a lista autoritativa do que existe — todo seletor `.jpd-*` que
aparece lá é um elemento que o `<Designer>` põe no DOM. O que não for
estilizado renderiza como HTML nu.

Quatro coisas que custam tempo se você descobrir por conta (as três
primeiras estão anotadas no `index.css`, no lugar em que valem):

1. **`border-width` sem `border-style` não desenha nada.** Não existe mais
   um reset global `*{border:0 solid}` fornecendo o estilo, e largura sem
   estilo computa borda NENHUMA, sem erro no console. Escreva
   `border: 1px solid <cor>` sempre.
2. **Botão e controle nu voltam pro chrome do sistema operacional** (Arial
   13px, fundo `ButtonFace`, borda `2px outset`) — o reset vinha do
   Preflight do Tailwind, que saiu no 3.0.0. `.jpd-btn`, `.jpd-input`,
   `.jpd-select`, `.jpd-textarea`, `.jpd-tab`, `.jpd-fieldrow`,
   `.jpd-zoombar__btn` e `.jpd-iconpick__item` precisam de
   `font: inherit` + `appearance` + `border: 0 solid` do seu lado.
3. **`data-active` na aba carrega o booleano cru**, então aba INATIVA tem
   literalmente `data-active="false"`. Use `[data-active="true"]`; um
   `[data-active]` pelado pinta a barra inteira de ativa. Os outros
   `data-*` booleanos (`data-selected`, `data-locked`, `data-dragging`,
   `data-collapsed`, ...) são presença/ausência — nesses o seletor pelado é
   o certo. Os de enum (`data-band`, `data-variant`, `data-size`,
   `data-tone`, `data-role`, `data-part`, `data-legend`) sempre têm valor.
4. **Geometria é inline e não se briga com ela.** `.jpd-page`,
   `.jpd-field` e `.jpd-canvas__zoom` recebem `width`/`height`/
   `transform: scale()` inline (milímetros × zoom), e o react-rnd calcula
   o arraste contra essa escala. Declarar tamanho, posição ou transform
   neles faz o campo fugir do cursor.

Duas classes são lidas por **JavaScript**, não só por CSS:
`jpd-section__body` (hit-test com `classList.contains`) e
`jpd-section__handle` (`dragHandleClassName` do react-rnd). Estilizar
pode; remover do DOM quebra arraste e seleção sem erro nenhum.

E note o que este example NÃO faz: não declara nenhuma custom property
`--jpd-*`. Aquelas são o contrato de TEMA do `theme.css` (é o caminho pra
quem importa a folha e só quer trocar as cores). Quem escreve o CSS
inteiro, como aqui, ignora os tokens e usa a própria paleta.

O que existe aqui é uma camada `--ui-*` **nossa**, com os mesmos papéis
(superfície, texto, accent, perigo, aviso, raio, sombra) mas montada à mão. A
distinção é a lição inteira do example:

- `--jpd-*` é **API do pacote**. Você troca o valor e as regras que a lib
  escreveu obedecem. Chega até onde o `theme.css` deixou uma variável.
- `--ui-*` é **variável do consumidor**. Ela só significa algo porque as
  regras logo abaixo a consomem — regras que *você* escreveu, e que por isso
  podem mudar estrutura (remover borda, inflar raio, trocar densidade), não
  só matiz.

Ou seja: nenhum `--jpd-*` deste arquivo teria efeito (não há folha do pacote
pra ler), e nenhum `--ui-*` seria suficiente se as regras não fossem locais.
As duas metades do argumento estão no mesmo arquivo, na ordem.
