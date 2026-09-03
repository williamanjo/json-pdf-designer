# no-preview-example

Um gerador de relatórios completo que **gera o PDF e baixa direto** — sem
tela de preview e, o ponto do example, **sem o `pdfjs-dist` instalado**.

```bash
npm install
npm run dev   # http://localhost:5176
```

## O look: TERMINAL / IDE

Quase-preto, **mono em tudo** (inclusive dentro do editor), **raio de 2px**,
accent em **verde-fósforo**, hairlines, e denso de verdade. Rótulo de seção
com prefixo `▸`, título do app com prefixo `$`, aba ativa como bloco
preenchido, foco como contorno duro de 1px, zero sombra difusa.

| | |
|---|---|
| fonte | `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, …` (sem webfont) |
| raio | 2px em `sm`/`md`/`lg`/`xl`; `full` fica em 9999px (o pill da barra de zoom) |
| papel | `#0a0e14` escuro / `#f6f8fa` claro |
| painel | `#0d1117` / `#ffffff` |
| poço (campo) | `#010409` / `#eaeef2` |
| hairline | `#1f2430` / `#d0d7de` |
| verde de TEXTO/BORDA | `#7ee787` / `#177130` |
| verde de PREENCHIMENTO | `#3fb950` / `#177130` |
| corpo | 11px (o editor tinha 12) |

Duas forças de verde de propósito: o fósforo puro só aparece como texto,
borda e glifo; quem preenche área é um degrau mais fundo. Medido na tela, o
fósforo preenchendo os seis botões de "adicionar campo" mais o primário da
casca virava um bloco de neon e o verde deixava de significar "isto é ação".

O tema **claro continua funcionando** (há toggle ☀/☾ no header): ele é um
"terminal claro" — papel `#f6f8fa`, tinta quase-preta, o mesmo verde
escurecido. O toggle troca claro/escuro, **não** a identidade: continua mono,
continua 2px.

**Contraste medido no navegador**, percorrendo todo nó de texto visível,
compondo o fundo efetivo e considerando alpha (o parser é o `<canvas>`, pra
não tentar ler `oklch()` como se fosse `rgb()`):

| tema | nós medidos | abaixo do mínimo | menor aprovado |
|---|---|---|---|
| escuro | 127 | 3 | 4.57:1 |
| claro | 193 | 3 | 4.60:1 |

Os 3 de cada lado são o MESMO caso e não são tema: o cabeçalho da tabela do
template de exemplo (`data/initialTemplate.ts`) é branco sobre `#0284c7`,
4.10:1 — é a aparência do documento, igual nos cinco examples, e sai no PDF
assim.

## Os recursos

Os cinco examples têm o MESMO conjunto de recursos; o que muda é como cada
um monta e estiliza o editor. Aqui é `<Designer>` (o preset, não as peças) +
CSS puro com variáveis `--app-*` nos dois temas.

| Recurso | Onde |
|---|---|
| **Fontes de dados JSON** — várias, mescladas, soltar arquivo | [`components/DataSourcePanel.tsx`](src/components/DataSourcePanel.tsx), [`lib/sources.ts`](src/lib/sources.ts) |
| **Explorador de campos** — arrasta campo pro canvas, ou "+" sem arrastar | [`components/FieldTree.tsx`](src/components/FieldTree.tsx), [`lib/jsonExplorer.ts`](src/lib/jsonExplorer.ts) |
| **6 templates prontos** no dropdown | [`data/templates/`](src/data/templates) |
| **Undo/redo** (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y) | [`hooks/useUndoRedo.ts`](src/hooks/useUndoRedo.ts) |
| **Autosave** em `localStorage` | [`hooks/useAutosave.ts`](src/hooks/useAutosave.ts) |
| **Salvar/carregar projeto** em arquivo `.json` | [`lib/projectFile.ts`](src/lib/projectFile.ts) |
| **Múltiplas páginas** com abas | [`components/PageTabs.tsx`](src/components/PageTabs.tsx), [`lib/pages.ts`](src/lib/pages.ts) |
| **Painel de problemas** — expressão torta, vínculo faltando | [`components/ProblemsPanel.tsx`](src/components/ProblemsPanel.tsx), [`lib/templateProblems.ts`](src/lib/templateProblems.ts) |
| **Erro de geração traduzido** — por classe de erro, não por `err.message` | [`components/GenerationErrorBanner.tsx`](src/components/GenerationErrorBanner.tsx), [`lib/generationError.ts`](src/lib/generationError.ts) |
| **Seletor de idioma** — troca o editor **e** a casca | seletor inline no [`App.tsx`](src/App.tsx), dicionário em [`src/i18n.ts`](src/i18n.ts) |
| ~~Preview de PDF~~ | **proibido aqui**, ver abaixo |

O único recurso que fica de fora é o preview — e não por falta de tempo:
ele é o que este example existe pra NÃO ter.

Cada módulo é cópia local, sem import cruzado com os outros examples: a
pasta tem de ler sozinha e ser copiável direto pro seu projeto.

O JSON inicial mora inline em [`data/initialTemplate.ts`](src/data/initialTemplate.ts)
como objeto TypeScript (dois níveis de objeto aninhado + dois arrays). O
`report-builder` carrega um `initialSample.json` de 111KB; aqui o sample
tem de caber na leitura de quem abre o repo.

## Um seletor de idioma, duas camadas

O `<select>` de idioma do header troca **o editor e a casca do app juntos**,
num clique. Mesmo mecanismo do toggle de tema: um valor de estado
(`locale`, no `useState<Locale>` do [`App.tsx`](src/App.tsx)) alimentando dois
consumidores.

- **O editor** — `<Designer locale={locale}>`: abas, toolbar, painel de
  propriedades, avisos de vínculo, erro de expressão. É o dicionário do
  PACOTE.
- **A casca** — `t(locale)` de [`src/i18n.ts`](src/i18n.ts): título de painel,
  botão do header (inclusive o ☀/☾), dica, `aria-label`, mensagem de estado
  vazio, erro de geração. É o dicionário DESTE app, e ele mora aqui porque
  cada example é autossuficiente.

O tipo `Locale` vem do pacote de propósito: quando ele ganhar um idioma novo,
este example para de compilar até alguém traduzir. E dentro do dicionário,
`const en: typeof pt` faz o mesmo por chave — tradução esquecida não compila,
em vez de renderizar vazio em silêncio.

Duas regras que valem repetir, porque errar nelas é pior que não traduzir:

1. **Onde o conceito é do pacote, reusa-se o dicionário dele**, nunca se
   duplica. O `label` do `<Select>` slotado já chega traduzido (é o editor que
   monta aquele controle); o `aria-label` do "×" do modal do explorador de
   campos sai de `dictFor(locale).modal.close`; e a mensagem de cada problema
   do template vem de `expressionErrors`/`fieldWarning` com `dictFor(locale)`
   (ver [`lib/templateProblems.ts`](src/lib/templateProblems.ts)). `dictFor` é
   o dicionário como VALOR — é o que serve fora de um `<I18nProvider>`.
2. **Dado não se traduz.** Conteúdo dos templates de exemplo, JSON de amostra,
   nome de campo (`titulo_relatorio`), caminho de dado (`rows.total`), nome de
   fonte (`principal`, `fonte_2`), nome do arquivo baixado (`relatorio.pdf`),
   o `detail` cru do erro que o pacote lançou e o texto que sai no PDF ficam
   como estão nos dois idiomas. Um relatório em português continua em
   português com a UI em inglês: **o idioma da interface não é o idioma do
   documento.** Nome de idioma no seletor também não se traduz — `Português` e
   `English` ficam cada um no próprio idioma.

## Por que este example existe

O `pdfjs-dist` é um peer dependency **opcional** (~35MB instalado) e mora
atrás do entry `json-pdf-designer/preview`. Este app importa só do entry
principal — `<Designer>`, `generatePdf`, `downloadPdf` — e por isso não
precisa dele.

**`pdfjs-dist` está deliberadamente ausente de todos os campos de
dependência do `package.json` daqui.** Não adicione: a ausência dele é
metade do teste.

A outra metade é o `check-no-pdfjs.mjs`, que roda no fim do `npm run
build`. Ele existe porque só omitir a dependência não prova nada: o
`json-pdf-designer` entra como `"file:../.."` (symlink), e o Vite resolve
import bare pelo caminho REAL do arquivo — então um import de pdf.js que
vazasse pro entry principal ainda acharia o pacote no `node_modules` do
repo pai (onde ele existe como devDependency), e o build passaria com ~1MB
de pdf.js embutido sem ninguém pedir. O script olha o bundle gerado e
falha se qualquer símbolo público do pdf.js (`GlobalWorkerOptions`,
`PDFDocumentLoadingTask`, `pdf.worker.min.mjs`) aparecer nele.

O `npm run build` só passa com a última linha `OK: N bundle(s) sem nenhum
vestígio de pdf.js.` — se você acrescentar um recurso aqui, é essa linha
que diz se a fronteira continua de pé.

Os outros dois guardas do mesmo invariante, cada um cobrindo um ângulo
diferente:

- `test/entryBoundaries.test.ts` (roda no `npm test` da raiz) — percorre o
  grafo de código-fonte a partir de cada entry e falha se `src/index.ts`
  ou `src/server.ts` alcançarem o `pdfjs-dist` (e, pelo mesmo raciocínio,
  se o `/server` alcançar `react`/`react-dom`/`react-rnd`). É o mais
  rápido e o mais direto: aponta o arquivo culpado.
- A checagem do tarball em `.github/workflows/ci.yml` — depois de
  `npm install ./pkg.tgz`, garante que o `pdfjs-dist` NÃO apareceu no
  `node_modules`. Prova que o npm não o instala sozinho, ou seja, que o
  peer continua opcional de verdade.

## Também é o smoke test do `theme.css`

Segundo papel, que a 3.0.0 deu de brinde: este é o único example com
**zero pipeline de Tailwind em ponta nenhuma** — nem no app, nem no
pacote (o Tailwind saiu do `json-pdf-designer` inteiro na 3.0.0). O
`<Designer>` aqui é estilizado só por `json-pdf-designer/theme.css`, e
nada mais na página emite reset.

É isso que faz dele o lugar certo pra testar primeiro: o
`report-builder` tem Tailwind próprio, então emite Preflight por conta e
**esconde** qualquer reset que o `theme.css` tenha esquecido de carregar
— testar lá dá falso verde. Se um `<svg>` voltar a ficar inline-baseline
ou um `<button>` voltar pro chrome do sistema operacional, aparece aqui.

## E é o único que exercita o dark mode

Terceiro papel: **este example começa no escuro**, e tem um toggle no header.
Nada mais no repo exercita o dark do editor.

O hook é UM atributo no `<html>`:

```html
<html data-jpd-theme="dark">   <!-- ou "light", ou nada (= claro) -->
```

E o ponto instrutivo é que o **mesmo atributo dirige o editor e a casca do
app**. O `theme.css` redefine os `--jpd-*` dele sob `[data-jpd-theme="dark"]`;
as variáveis `--app-*` do [src/index.css](src/index.css) seguem a mesma chave.
Um toggle, dois temas, zero lógica duplicada.

Medido no clique do toggle: 6 de 6 propriedades trocam juntas — `body`
background, `.app-sidebar` e `.app-panel__title` (casca) mais `.jpd-sidebar` e
`.jpd-ruler__tick` (editor). A escolha persiste em `localStorage`.

`.dark` no `<html>` também funciona, como alias — é o que os consumidores de
dark do 2.x já punham. Continua suportado; `data-jpd-theme` é o hook
documentado.

**Sem media query, de propósito.** Uma biblioteca não deve virar light-only
porque o SO está claro, nem escura porque o SO está escuro. Quem quiser seguir
o SO lê `matchMedia("(prefers-color-scheme: dark)")` e escreve o atributo — o
que este example faz é deixar a decisão explícita, no botão.

Uma limitação que vale saber: uma **ilha** de dark (o atributo num container
em vez do `<html>`) não pinta modal portalizado, porque o `<Modal>` renderiza
por `createPortal(document.body)`. É por isso que os tokens moram no `:root`.

## O mecanismo: TOKEN **+** OVERRIDE DE REGRA

Quinto papel, e é a razão de este example importar o `theme.css` inteiro em
vez de escrever CSS do zero. Ele é o único do repo que demonstra as **duas
alavancas juntas**, e a diferença entre elas é a lição.

### Alavanca 1 — token (`--jpd-*`)

Trocar valor de custom property. Repinta o que o `theme.css` **já declara**:
cor, raio, espaçamento, tamanho de fonte, sombra. É o mecanismo que o
[`composed-layout`](../composed-layout) demonstra sozinho — lá há um guard
que **proíbe** regra `.jpd-*`, porque a restrição é a demonstração.

Aqui saem por token: as ~120 cores do editor, os 4 raios, os 9 passos de
espaçamento, os 6 tamanhos de fonte, o tracking, e as 3 sombras genéricas
(que viram `none`). Inclusive coisas que parecem estruturais — a moldura
dura do modal, por exemplo, é uma linha só (`--jpd-shadow-2xl: 0 0 0 1px …`),
porque `.jpd-modal__panel` já faz `box-shadow: var(--jpd-shadow-2xl)`.

### Alavanca 2 — regra (`.jpd-* { … }`)

**Por que ela ganha:** todo o `theme.css` mora numa `@layer
json-pdf-designer`, e CSS **sem** layer vence CSS **com** layer independente
de especificidade. O `src/index.css` daqui não declara layer nenhuma, então
um `.jpd-btn { … }` de uma linha ganha de um
`.jpd-btn[data-variant="primary"]:hover` de lá. Não é hack — é o desenho da
cascata de layers, e é a razão de o pacote ter posto o tema numa layer.

Os 13 overrides do arquivo são cada um de um dos três casos em que token não
alcança:

**(a) ACRESCENTAR uma declaração que não existe.** Token só repinta o que já
está escrito; não existe token que crie uma borda onde não havia, nem que
ligue `text-transform`.

| override | o que token não alcançava |
|---|---|
| `.jpd-sectionhead::before`, `.jpd-eyebrow::before` | `content` — o `▸` da identidade |
| `.jpd-grouplabel`, `.jpd-labeled__text` | `text-transform`/`letter-spacing` nesses rótulos |
| `.jpd-card__header` | o `theme.css` não declara borda nenhuma ali |
| `.jpd-badge` | `background: transparent` + uma `border` que não existia |
| `.jpd-btn` | caixa alta |
| `.jpd-designer__canvas`, `.jpd-fieldlist__scroll` | `scrollbar-*` e pseudo-elemento de barra |
| `.jpd-checkline__box` | `accent-color` (é o que deixa o Checkbox slotado verde) |
| `.jpd-fieldrow__pos`, `.jpd-fieldrow__z`, `.jpd-ruler__label`, `.jpd-colname` | `font-variant-numeric: tabular-nums` |
| `.jpd-page` | **bug**: sem `color`, o texto do documento herda `--jpd-text` do tema — cinza-claro sobre papel BRANCO no escuro, 1.54:1 medido |
| `.jpd-palette__trigger` | **bug**: `<button>` fora da lista do `reset.css` e com classe, então cai no `ButtonFace` do sistema — `#6b6b6b` com `color-scheme: dark`, 3.45:1 |

Os dois últimos são achados desta rodada, e os dois só aparecem no escuro —
que é o modo default *deste* example e de nenhum outro. Consertados aqui por
regra; a correção de raiz é no `theme.css`/`reset.css` do pacote.

**(b) Mudar GEOMETRIA cravada na regra.** A cor sai de token, o número não.

| override | o número literal que estava no caminho |
|---|---|
| `.jpd-input:focus` & co. | `box-shadow: 0 0 0 2px …` → `outline: 1px` duro |
| `.jpd-tab[data-active="true"]` | `border-block-end: 2px solid` → bloco preenchido |
| `.jpd-sidebar` | `inline-size: 20rem` → 18rem (não existe token de largura) |

**(c) DESEMPATAR um token com dois papéis conflitantes.** O caso mais
interessante: `--jpd-text-on-accent` serve **cinco** papéis no `theme.css` —
botão primário (sobre o accent), botão danger (sobre vermelho), etiqueta de
faixa (vermelho), alça de seção (roxo) e barra de zoom (chip escuro). Quatro
querem texto claro em qualquer tema; o primeiro quer texto escuro no tema
escuro, porque lá o verde de preenchimento é claro. Enquanto o accent do
pacote era sky-600/700 os cinco concordavam e um token bastava — **verde
quebra o empate**, e nenhum valor satisfaz os dois lados (medido: `#e6edf3`
sobre o verde dá 2.15:1). Duas regras isolam os papéis divergentes:

```css
/* inverte junto com o tema: 8.1:1 no escuro, 5.2:1 no claro */
.jpd-btn[data-variant="primary"] { color: var(--jpd-surface-sunken); }
/* o chip da barra de zoom é escuro nos DOIS temas: 16.5:1 */
.jpd-zoombar { color: var(--app-zoombar-fg); }
```

### A armadilha que a alavanca 2 cria

Justamente porque regra sem layer ganha, um `:root { --jpd-surface: … }`
escrito no seu CSS ganha **também** do bloco `[data-jpd-theme="dark"]` do
`theme.css`, que é layerizado. Ou seja: **token sobrescrito só no `:root`
fica congelado nos dois temas**, e o toggle deixa de trocá-lo.

Daí as duas metades da regra deste arquivo:

- token que **deve trocar** com o tema → declarado nos **dois** blocos
  (`:root` e `:root[data-jpd-theme="dark"], :root.dark`);
- token que **deve ser igual** nos dois → declarado só no `:root`, e o
  congelamento é exatamente o que se quer. É o caso do chrome do canvas: a
  folha é papel branco no claro E no escuro, então `--jpd-canvas-*`,
  `--jpd-selection`, `--jpd-shadow-page` e a barra de zoom moram num bloco
  só, com um comentário dizendo por quê.

### A regra que todo painel novo daqui tem de seguir

Como o dark é o modo DEFAULT deste example, um painel escrito com cor fixa
não fica "um pouco errado": fica ilegível na primeira tela que a pessoa vê.
Duas regras, então:

1. **Nenhuma cor literal numa regra de cor.** Toda cor sai de um `--app-*`
   declarado nos DOIS blocos do `index.css` (`:root` e
   `:root[data-jpd-theme="dark"], :root.dark`). A única exceção é o grupo do
   header, que é escuro nos dois temas — e está comentada lá.
2. **Escope regra de elemento por classe própria**, nunca por container.
   Um `textarea, button { … }` solto alcança todo botão do `<Designer>` e
   **ganha** — o `theme.css` mora numa `@layer`, e CSS sem layer vence CSS
   com layer independente de especificidade. Já foi bug real aqui: um
   `color: #0f172a` solto deixava o texto das abas do editor invisível no
   escuro. E escopar por container não basta: as abas de página e o modal
   do explorador de campos moram dentro do mesmo `.app-main` do editor.
   (Mirar `.jpd-*` **de propósito** é a alavanca 2 acima; o que não pode é
   pegar o editor de raspão.)
3. **Todo `--jpd-*` que você sobrescrever tem de aparecer nos DOIS blocos de
   tema** — ou, se for igual nos dois, no bloco de congelados, com o motivo
   escrito. Um token sobrescrito só no `:root` para de trocar no toggle, e o
   sintoma é silencioso: um painel que fica claro no escuro sem erro nenhum
   no console. Ver "a armadilha que a alavanca 2 cria".

### Onde este example fica no espectro

Cada example usa uma estratégia de estilo diferente — juntos eles cobrem os
dois exports de CSS do pacote mais o modo sem nenhum:

| Example | CSS do pacote | Estratégia |
|---|---|---|
| [report-builder](../report-builder) | `theme.css` | tema como vem, zero customização |
| [composed-layout](../composed-layout) | `theme.css` | retema **só por token** (`--jpd-*`) |
| **no-preview** (este) | `theme.css` | **token + override de regra `.jpd-*`** + slots, e o dark mode com toggle |
| [headless-designer](../headless-designer) | `reset.css` | só o reset, aparência escrita à mão |
| [custom-ui](../custom-ui) | *nenhum* | `.jpd-*` do zero (~190 classes) |

E cada um tem uma cara diferente, de propósito: SaaS padrão, brutalista
preto-e-amarelo, **terminal/IDE** (este), blueprint azul-e-ciano, app macio
creme-e-coral. Se dois pudessem ser confundidos numa captura de tela, o
espectro não estaria demonstrado.

Guardado por `test/docsFreshness.test.ts`.

## E é o único que troca os primitivos do editor

Quarto papel. A 3.0.0 abriu os **12 primitivos** que o editor usa por dentro
(`Button`, `Input`, `ColorInput`, `Select`, `Textarea`, `Checkbox`, `Modal`,
`Card`, `CardHeader`, `CardTitle`, `Badge`, `TabPanel`) pra substituição — e
esta era a única parte dessa API sem nenhum example.

Aqui trocamos **dois**, de propósito: o ponto é a mecânica e a forma do
adapter, não repetir o mesmo gesto doze vezes. Ver
[src/uiSlots.tsx](src/uiSlots.tsx).

```tsx
// constante de MÓDULO — ver o aviso abaixo
const MEUS_PRIMITIVOS = {
  Select: ({ label, parts: _parts, children, ...rest }: SelectProps) => (
    <label className="slot-field">
      {label && <span className="slot-field__label">{label}</span>}
      <span className="slot-select"><select {...rest}>{children}</select></span>
    </label>
  ),
  // ...
} satisfies UiComponentsOverride;

<Designer /* ...as 7 props de sempre... */ components={MEUS_PRIMITIVOS} />
```

Medido nesta build, com o editor rodando:

| | |
|---|---|
| `[data-slot="select"]` no DOM | **2** — o `<Select>` do consumidor renderizou dentro do editor |
| `.jpd-select` no DOM | **0** — o do kit saiu |
| `.jpd-input` no DOM | **4** — o `Input` **não** foi trocado, e continua sendo o nosso |
| `[data-slot="checkbox"]` | **3**, cada um com uma `.jpd-checkline__box` **por dentro** |

As duas últimas linhas são as interessantes. A terceira mostra que a
substituição é **parcial**: omitir uma chave deixa o primitivo do pacote no
lugar (`undefined` numa chave significaria HERDA do provider pai, não
"volta ao nosso" — pra isso é `{ Select: defaultUiComponents.Select }`).

A quarta mostra o caso de uso mais natural que existe: o adapter de
`Checkbox` **embrulha o nosso próprio `<Checkbox>`** em vez de
reimplementá-lo. Isso só funciona por uma invariante do desenho —
**primitivo slotável nunca lê o registry**. Se o `<Checkbox>` do kit
resolvesse a si mesmo por `useUiComponents()`, esse adapter recursionaria
pra sempre. Há teste de fonte no pacote garantindo isso.

### Duas coisas que mordem

**`label` é a prop que morde.** O editor tem ~16 controles cujo nome
acessível vem dela. Um slot que a descarta deixa leitor de tela sem nada pra
anunciar. Os dois adapters daqui a honram num `<label>` de verdade.

**Os defaults NÃO vêm no slot.** O `<Button>` do kit faz
`{ variant = "primary", size = "sm" }` na desestruturação *dele*, então um
chamador que escreve só `<Button>ok</Button>` manda `variant: undefined` pro
seu adapter — medido: dos 6 botões da toolbar, **5 chegam sem `variant`**. Se
o seu adapter traduz nossos valores pros do seu design system, ele precisa
repetir o default.

**E o mapa tem de ser constante de módulo.** Objeto inline no JSX cria
componente novo a cada render, o React remonta o slotado, e o campo perde o
foco a cada tecla. Fora de produção o provider avisa no console, uma vez.

### Por que aqui, e não no `custom-ui`

Palpite óbvio, mas impossível: lá a identidade é estilizar as ~190 classes
`.jpd-*` que o editor emite. Trocar os primitivos **remove do DOM** justamente
as `.jpd-btn`/`.jpd-input`/`.jpd-select` que aquele CSS estiliza. As duas
coisas são mutuamente exclusivas.

Este example usa o `<Designer>` preset, e `components={...}` é o açúcar que
monta o `<UiComponentsProvider>` — o caminho que a maioria toma. Quem
renderiza peça avulsa monta o provider na mão.

## O que funciona

Tudo. O `<Designer>` inteiro (arrastar, redimensionar, painel de
propriedades, vínculo com JSON, imagem de fundo) e a geração do PDF
(texto, tabela, chart, KPI, seção, paginação, fontes) não dependem de
pdf.js — nenhum recurso do pacote fica de fora por não instalar o
`pdfjs-dist`.

A única coisa que o `pdfjs-dist` habilita é **ver o PDF na tela antes de
baixar**. Pra isso, instale e use o `<PdfPreviewModal>` do entry
`/preview` — ver o example `report-builder`.

Aqui, o botão "Gerar e baixar PDF" chama `generatePdf` (que devolve os
bytes) e `downloadPdf` (que entrega o arquivo). Nenhum passo intermediário
renderiza o PDF na tela, então nada nesse caminho precisa do pdf.js — e o
recibo ao lado do botão ("Baixado: relatorio.pdf — 36.1 KB") é o único
retorno visual que este example pode dar.
