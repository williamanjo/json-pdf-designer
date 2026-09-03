# composed-layout

Editor montado **peça por peça**, sem o componente `<Designer>` — e
retematizado **inteiro** (preto e amarelo, raio zero, mono) **só trocando
custom properties**, sem escrever uma regra de CSS do editor. Ver
[Estilo](#estilo-brutalista-e-retematizado-só-por-token).

```bash
npm install
npm run dev     # http://localhost:5177
```

## O que este example prova

Que o `<Designer>` não é indivisível. Ele é um **preset**: monta os providers
e um layout de duas colunas. Aqui o layout é outro, e o preset não sabe
fazê-lo:

```
┌──────────────────────────────────────────────────────────────────┐
│  header: idioma · exemplos · salvar/carregar · Gerar PDF          │
├──────────────────────────────────────────────────────────────────┤
│  banner de erro de geração (só quando falha)                      │
├──────────────────────────────────────────────────────────────────┤
│  toolbar (largura toda)                                           │
├──────────────┬────────────────────────────┬──────────────────────┤
│ fontes JSON  │  abas de página            │  Dados do campo       │
│ campos do    ├────────────────────────────┤  Estilo do campo      │
│   JSON       │  canvas                    │  Vínculo com o JSON   │
│ campos no    │                            │  Filtro de linhas     │
│   canvas     │                            │  Página               │
│              │                            │  Inspetor             │
│              │                            │  Problemas do template│
└──────────────┴────────────────────────────┴──────────────────────┘
```

**A ausência da barra de abas é o teste de verdade.** Dentro do `<Designer>`,
aqueles painéis da direita são abas diferentes — só uma aparece por vez. Aqui
eles renderizam **todos ao mesmo tempo**, porque nenhuma peça recebe
`whenTab`:

```tsx
<DesignerPropertyPanel section="dados" />
<DesignerPropertyPanel section="estilo" header={false} />
<DesignerBindingEditor />
<DesignerFilterPanel />
<DesignerPageSettings />
<DesignerInspector />
```

Se o gate por aba fosse o **default** em vez de opt-in, esta coluna mostraria
um painel e apagaria os outros cinco — e as peças seriam decompostas só no
nome. Medido nesta build, com um campo selecionado: **9 instâncias de peça no
DOM ao mesmo tempo** (toolbar, lista de campos, canvas, as duas metades do
painel de propriedades, vínculo, filtro, página, inspetor), **zero
`.jpd-tabs`** e **zero `.jpd-sidebar`**.

## As três coisas que só dá pra fazer assim

**1. As duas metades do painel de propriedades, uma abaixo da outra.**
`section="dados"` e `section="estilo"` são duas instâncias da mesma peça. É
prop, e não leitura da aba ativa — se lesse a aba, a segunda desapareceria.

**2. O editor de vínculo e o painel de filtro sozinhos.** Dentro do
`<Designer>` o vínculo só existe aninhado no painel de cada tipo de campo, e o
filtro é uma aba que aparece e desaparece com a seleção. São as duas peças que
o [headless-designer](../headless-designer) dizia ter tido de abrir mão.

**3. A toolbar fora da sidebar.** No preset ela vive no pé do painel lateral;
aqui ocupa a largura toda. `hint={false}` desliga a frase "selecione um campo
na lista", que não tem referente quando a lista está em outra coluna.

## Os recursos, e onde cada um ficou

Os cinco examples do repo têm o **mesmo conjunto de recursos** — o que muda é
como montam o editor e como estilizam. Aqui o layout de três colunas decidiu
onde cada coisa entra:

| Recurso | Onde | Arquivo |
|---|---|---|
| **Fontes de dados JSON** (várias, mescladas, drop de arquivo) | coluna da esquerda, no topo | [`components/DataSourcePanel.tsx`](src/components/DataSourcePanel.tsx), [`lib/sources.ts`](src/lib/sources.ts) |
| **Explorador de campos** (arrasta pro canvas, ou "+") | coluna da esquerda, logo abaixo | [`components/FieldTree.tsx`](src/components/FieldTree.tsx), [`lib/jsonExplorer.ts`](src/lib/jsonExplorer.ts) |
| **6 templates prontos** | dropdown "Carregar exemplo…" no header | [`data/templates/`](src/data/templates) |
| **Undo/redo** (Ctrl+Z / Ctrl+Y) | atalho global; a etiqueta `⌃Z / ⌃Y` no header é só o aviso de que existe | [`hooks/useUndoRedo.ts`](src/hooks/useUndoRedo.ts) |
| **Autosave** (localStorage, debounce 500ms) | etiqueta `AUTOSALVO` / `AUTOSAVED` no header | [`hooks/useAutosave.ts`](src/hooks/useAutosave.ts) |
| **Salvar/carregar projeto** (.json) | header | [`lib/projectFile.ts`](src/lib/projectFile.ts) |
| **Múltiplas páginas** | abas acima do canvas | [`components/PageTabs.tsx`](src/components/PageTabs.tsx), [`lib/pages.ts`](src/lib/pages.ts) |
| **Painel de problemas** | fim da pilha da direita | [`components/ProblemsPanel.tsx`](src/components/ProblemsPanel.tsx), [`lib/templateProblems.ts`](src/lib/templateProblems.ts) |
| **Erro de geração traduzido** | banner abaixo do header | [`components/GenerationErrorBanner.tsx`](src/components/GenerationErrorBanner.tsx), [`lib/generationError.ts`](src/lib/generationError.ts) |
| **Seletor de idioma** (troca a casca **e** o editor, ver abaixo) | header | [`src/i18n.ts`](src/i18n.ts) + o `<I18nProvider>` no [`App.tsx`](src/App.tsx) |
| **Preview de PDF** (pdf.js) | modal, depois de "Gerar PDF" | `PdfPreviewModal` de `json-pdf-designer/preview` |

Cada módulo é **cópia local**: nada aqui importa de outro example. Material de
exemplo tem de ler sozinho e ser copiável direto pro seu projeto.

Duas escolhas de posicionamento que valem explicação:

- **Abas de página acima do canvas, e não no header.** Elas são o único
  "aba" da tela, e trocar de página é trocar o que o canvas mostra — perto
  dele é onde a relação fica óbvia. Elas não são a barra de abas do editor:
  a `<DesignerTabBar>` troca qual PAINEL aparece, e este example não a usa.
- **Problemas do template no fim da pilha da direita.** É o único cartão que
  fala do template INTEIRO (todas as páginas); os seis de cima falam do campo
  selecionado ou da página atual. Ele fecha a coluna em vez de interromper.

### O `locale` sem o `<Designer>`

No preset, `locale` é prop do `<Designer>`. Montando na mão, o idioma vem do
`<I18nProvider>` por fora do `<DesignerProvider>` — é responsabilidade de quem
monta:

```tsx
<I18nProvider locale={locale}>
  <DesignerProvider template={activePage} …>
    …
  </DesignerProvider>
</I18nProvider>
```

Fora da árvore React (o painel de problemas roda no render do App, não dentro
de um componente do editor) o dicionário vem como **valor**, por
`dictFor(locale)` — `useT()` só existe dentro de um componente.

### Um seletor, duas camadas de texto

O `<select>` do header troca **as duas** coisas de uma vez:

1. **a UI do editor** — o `<I18nProvider locale={locale}>` acima;
2. **a casca deste app** — os títulos dos cartões, os botões do header, as
   dicas, os `aria-label`, as abas de página, o painel de problemas. Eles saem
   de [`src/i18n.ts`](src/i18n.ts), dicionário próprio deste example
   (`t(locale)`).

É um estado só (`useState<Locale>("pt-BR")`) alimentando dois dicionários — o
nosso e o do pacote. Zero sincronização manual, e o `Locale` vem do pacote, de
modo que um idioma novo lá faz `src/i18n.ts` parar de compilar até alguém
traduzir. As chaves do `en` são tipadas com `typeof pt`: **tradução esquecida
não compila** (em vez de renderizar vazio em silêncio).

**O que reusa o dicionário do PACOTE.** Quando o conceito já é dele, o texto
vem de `dictFor(locale)` em vez de ser duplicado aqui — os sete cartões da
coluna da direita são exatamente as abas do `<Designer>`:

```tsx
const pacote = dictFor(locale);
<h2>{ui.doCampo(pacote.tabBar.data)}</h2>   {/* "Dados do campo" / "Field data" */}
<h2>{pacote.bindingEditor.title}</h2>       {/* "Vínculo com o JSON" / "Bind to JSON" */}
<h2>{pacote.tabBar.page}</h2>               {/* "Página" / "Page" */}
```

Só o **qualificador** ("do campo", "de linhas", "no canvas") é nosso. Duplicar
o substantivo criaria duas traduções pra dessincronizar. O
[`lib/templateProblems.ts`](src/lib/templateProblems.ts) já fazia isso pras
mensagens de problema; agora a casca faz o mesmo pros rótulos.

**O que NÃO troca de idioma, e é de propósito:** o conteúdo dos templates de
[`data/templates/`](src/data/templates) (o dropdown continua oferecendo
"Recibo Simples (só texto)" com a UI em inglês), o sample de
[`data.ts`](src/data.ts), o nome das fontes de dados (`principal`,
`fonte_2` — é dado, vai pro autosave e pro projeto salvo), nome de campo,
caminho de dado e o texto que sai no PDF. **O idioma da interface não é o
idioma do documento**: um relatório em português continua em português.

**A pegadinha:** frase traduzida guardada em `useState` fica congelada no
idioma em que foi montada — trocar o seletor não retraduz o que já está na
tela. Aqui o estado guarda **dado** e a tradução acontece na renderização:
`errorsById` guarda código (`"jsonInvalido"`, ver
[`lib/sources.ts`](src/lib/sources.ts)), o banner guarda o erro **cru** e
`describeGenerationError(err, locale)` roda no render, e a lista de arquivos
que falharam guarda o **nome** do arquivo. Dá pra testar: deixe um erro na
tela e **então** troque o idioma.

### O sample de dados

Pequeno e **inline** ([`src/data.ts`](src/data.ts)), de propósito: o assunto
deste example é layout, não dado. Ele tem objeto aninhado e dois arrays de
objetos porque é o mínimo pro explorador de campos mostrar grupo colapsável,
coluna individual arrastável e dois "Data Source" no dropdown de vínculo. Os 6
exemplos do dropdown trazem sample próprio cada um.

O dropdown "Data Source" do editor de vínculo é montado **a partir do
explorador** (cada array de objetos que ele acha vira uma opção) — trocar de
fonte de dados muda o dropdown junto.

## Estilo: brutalista, e retematizado SÓ por token

Casca em CSS puro ([src/index.css](src/index.css)), sem Tailwind. O editor vem
estilizado de `json-pdf-designer/theme.css` — uma linha, que já importa o
`reset.css` por dentro.

O look é **brutalista**: preto e amarelo, **zero raio** em tudo, nenhuma
sombra difusa (o que flutua ganha bloco preto deslocado), **mono no editor
inteiro**, borda dura e densidade apertada.

**E aqui está a parte que este example demonstra: ele chega nesse look sem
reescrever UMA regra.** Só troca valores de `--jpd-*` no `:root` — e o ponto
é que os tokens não controlam só matiz, controlam **estrutura**:

```css
:root {
  /* cor */
  --jpd-accent: #8a6d00;          /* accent de TEXTO (amarelo escuro) */
  --jpd-accent-solid: #ffd400;    /* accent de FUNDO (amarelo puro)   */
  --jpd-text-on-accent: #000;     /* o que vai em cima do fundo       */
  --jpd-border: #111;

  /* ESTRUTURA — é isto que prova o ponto */
  --jpd-radius-sm: 0;             /* … e md, lg, xl, e o `full` também */
  --jpd-radius-full: 0;           /* a pílula vira retângulo           */
  --jpd-shadow-2xl: 8px 8px 0 0 #000;  /* bloco duro, não desfoque    */
  --jpd-font-sans: var(--jpd-font-mono);
  --jpd-space-2: 0.375rem;        /* escala de espaçamento um degrau   */
  --jpd-tracking-wide: 0.08em;
}
```

Medido depois da troca, sem um único seletor escrito:
`.jpd-btn[data-variant="primary"]` renderiza `rgb(255,212,0)` com texto
`rgb(0,0,0)` e `border-radius: 0px`; `.jpd-modal__panel` (que vive num
**portal** no `document.body`) sai com `box-shadow: rgb(0,0,0) 8px 8px 0 0` e
raio 0; `.jpd-page` fica com o mesmo bloco duro em 6px; a `.jpd-zoombar`, que
era pílula escura, virou retângulo amarelo; e o editor inteiro — input,
label, aba, callout, régua — está em `ui-monospace`. Contado no DOM da tela
carregada: **zero elementos com `border-radius` diferente de `0px`**, editor e
casca juntos.

E o anel de foco continua vivo, o que não é dado de graça — ver a decisão 3
abaixo: `.jpd-input:focus` computa
`box-shadow: rgb(255,212,0) 0 0 0 2px, rgba(0,0,0,0) 0 0 0 0`.

Funciona porque os tokens do `theme.css` moram no `:root`, e uma declaração no
`:root` do **seu** CSS — fora de `@layer` — ganha da nossa. É também por isso
que os tokens não são escopados em `.jpd-designer`: o `<Modal>` renderiza por
portal no `document.body`, e escopado ele ficaria sem tema — inclusive o modal
de preview de PDF que este example usa.

Os nomes de token saem de `src/css/theme.css`, que não é minificado
justamente pra ser lido.

Os painéis **próprios** do app (fontes de dados, explorador, abas de página,
problemas, banner) não leem `--jpd-*`: eles têm tokens `--app-*` no mesmo
`:root`, com o mesmo preto, o mesmo amarelo e o mesmo raio zero. Editor e
casca são duas peles diferentes, e misturar faria o app depender de nome de
token nosso pra pintar o que é dele. A casca é onde as bordas ficam
**grossas** (2px): no editor a espessura é regra, e regra aqui não se toca.

### As quatro decisões que o CSS explica, e valem ler antes de copiar

**1. O accent tem DOIS valores, porque tem dois papéis.** `--jpd-accent-solid`
é fundo (`#ffd400` puro, com texto preto em cima: 14,7:1).  `--jpd-accent` é
texto sobre branco, e aí amarelo puro dá **1,4:1** — ilegível. O token de
texto vai pra `#8a6d00` (4,92:1). Usar o mesmo valor nos dois é o erro
clássico deste tipo de paleta.

**2. `--jpd-text-on-accent` é lido por CINCO fundos, não um.** Botão
primário, botão de perigo, etiqueta da faixa de cabeçalho, barra de zoom e
cabeçalho de seção no canvas. Trocar só ele pra preto apagaria a barra de
zoom (que era slate-800 com texto branco) — por isso os cinco fundos também
foram pra tons claros o bastante pra preto.

**3. `--jpd-shadow-sm` não pode ser `none`.** O tema compõe o foco do input
como `box-shadow: 0 0 0 2px var(--jpd-accent-ring), var(--jpd-shadow-sm)`, e
`none` dentro de uma lista de sombras é **CSS inválido**: a declaração
inteira cai e o anel de foco desaparece calado. A forma que sobrevive a estar
numa lista é `0 0 0 0 transparent`.

**4. `--jpd-radius-full: 0` foi conferido no navegador.** Ele afeta quatro
sites — `.jpd-swatch`, `.jpd-zoombar`, `.jpd-zoombar__btn` e
`.jpd-chart__dot`. Nenhum precisava continuar redondo; a bolinha da legenda
do gráfico era a única candidata a exceção, e o renderizador de PDF desenha
essa legenda com `page.drawRectangle`, então quadrado no canvas é **mais**
fiel ao PDF. Se algum precisasse, o certo seria devolver só aquele token a
`9999px` e comentar o porquê.

Contraste medido (não estimado — e cuidado: `oklch()` não se calcula como se
fosse `rgb()`; por isso todo valor aqui é hex): texto do editor 18,9:1;
accent de texto 4,92:1; hover 7,26:1; preto sobre o amarelo de fundo 14,7:1;
preto sobre o vermelho de erro 5,92:1; vermelho de texto 6,48:1; placeholder
4,54:1. Elementos de UI: seleção no canvas 21:1 (borda preta de 2px, com halo
amarelo por fora), contorno de campo não selecionado 3,45:1.

Cada peça aceita `className` (faz **merge** com a classe dela, a sua vem
depois) e `style` (o seu ganha). As classes deste app entram junto das nossas:

```tsx
<DesignerToolbar className="app-toolbar" />   →  class="jpd-sidebar__footer app-toolbar"
<DesignerCanvas className="app-canvas" />     →  class="jpd-designer__canvas app-canvas"
```

Elementos de DENTRO da peça vão por `parts`, por papel:

```tsx
<DesignerFieldList parts={{ scroll: "app-list-scroll" }} />
```

Aqui isso serve pra tirar a altura máxima da lista: dentro do `<Designer>` ela
é curta porque divide a sidebar com a toolbar, e nesta coluna ela é dona do
espaço todo.

### Uma armadilha, e ela é real

Um seletor de elemento **solto** alcança o editor também, e **ganha**:

```css
button { color: #0f172a; }        /* ❌ pinta as abas e a toolbar do editor */
.app-left button { color: … }     /* ✅ escopado à sua casca */
```

O `theme.css` mora numa `@layer`, e CSS sem layer vence CSS com layer
independente de especificidade. Isso é de propósito — é o que faz o
`className` que você passa sempre ganhar do nosso. O efeito colateral é que
regras globais de elemento também ganham. (Não é novidade da 3.0.0: o
`dist/style.css` do 2.x era output do Tailwind v4, que também emite
`@layer utilities`.)

Por isso toda regra de elemento no `index.css` deste example é escopada por
classe (`.app-select option`, `.app-problem__title code`), e os painéis novos
são todos `.app-*`.

Se você **quiser** redefinir o chrome do editor, é isto mesmo que se faz — só
faça mirando `.jpd-*` de propósito.

## Onde este example fica no espectro de estilo

Cada example do repo usa uma estratégia de estilo diferente — juntos eles
cobrem os dois exports de CSS do pacote mais o modo sem nenhum:

| Example | CSS do pacote | Estratégia | Look |
|---|---|---|---|
| [report-builder](../report-builder) | `theme.css` | tema como vem, zero customização | SaaS padrão, a referência |
| [composed-layout](../composed-layout) | `theme.css` | retema **só por token** (`--jpd-*`) | **brutalista** — preto/amarelo, raio 0, mono |
| [no-preview](../no-preview) | `theme.css` | token **+ override de regra** `.jpd-*` | terminal/IDE — quase-preto, verde fósforo |
| [headless-designer](../headless-designer) | `reset.css` | só o reset, aparência escrita à mão | blueprint — azul-marinho, hairline ciano |
| [custom-ui](../custom-ui) | *nenhum* | `.jpd-*` do zero (~190 classes) | app macio — creme/coral, pílulas, sombra |

Os cinco não se parecem de propósito: se dois fossem confundíveis numa
captura de tela, o espectro não estaria demonstrado. A dupla que mais importa
aqui é `composed-layout` × `no-preview` — os dois importam o `theme.css`, mas
este **só** troca token, e aquele soma override de regra. É a diferença
didática entre os dois mecanismos.

Guardado por `test/docsFreshness.test.ts` — trocar o import de um example sem
trocar esta tabela quebra a suíte. O mesmo guard verifica que o `index.css`
daqui sobrescreve `--jpd-accent` e **não escreve nenhuma regra `.jpd-*`**: se
escrevesse, este example deixaria de demonstrar "retema sem tocar em CSS" e
viraria um [custom-ui](../custom-ui) pior.

## Divisão de responsabilidade no canvas

A peça é dona da **geometria da folha** (mm→px, `transform: scale(zoom)`); o
`react-rnd` calcula o delta de arrasto contra esse transform, então
sobrescrevê-lo faz o campo fugir do cursor.

Você é dono do **viewport que rola**, que é o que `className` atinge:

```css
.app-canvas {
  min-width: 0;   /* o canvas tem largura inline fixa e não encolhe */
  flex: 1;
}
```

O `min-width: 0` não é enfeite: item de flex se recusa a encolher abaixo do
conteúdo, e sem ele o canvas empurraria as colunas vizinhas fora da tela.

O drop de campo vindo do explorador entra por `onCanvasDrop` do
`<DesignerProvider>` — passthrough pro container do canvas. Quem traduz o
`FieldNode` solto num schema já vinculado é
[`lib/addField.ts`](src/lib/addField.ts), fora do `App.tsx` de propósito: 80
linhas de cálculo de posição no meio dele esconderiam o assunto, que é o
layout.

## Múltiplas páginas, e o `key`

O `<DesignerProvider>` recebe só a página **ativa** — as peças não sabem que
existem outras. O `App` grava de volta em `template.pages[i]`, preservando o
resto. E o provider leva `key={activePage.id}`: trocar de página é trocar de
documento, e sem o `key` a seleção interna do editor continuaria apontando pra
um schema que não existe mais na página nova.

O header fica **fora** do provider — nada nele lê o estado do editor, e assim
a troca de página não remonta os controles de lá.
