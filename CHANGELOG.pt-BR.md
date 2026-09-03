[English](CHANGELOG.md) | **Português**

# Changelog

Todas as mudanças relevantes deste pacote ficam documentadas aqui.
Formato inspirado, sem seguir à risca, em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
## 3.0.0 (2026-09-02)

Tira o Tailwind do pacote e quebra o `<Designer>` em peças que você mesmo
posiciona. As duas coisas são uma só, não duas: o preset só pôde virar peças
posicionáveis depois que a marcação deixou de carregar strings de utilitária
que dependiam de um build de Tailwind pra existir. No lugar entra um
`theme.css` escrito à mão sobre classes `.jpd-*` e custom properties
`--jpd-*`, um `<DesignerProvider>` com dez peças e dez hooks em volta, e um
registry que troca o Button/Input/Modal que o editor usa por dentro pelos
seus.

### Breaking

- **`json-pdf-designer/style.css` não existe mais — importe
  `json-pdf-designer/theme.css`.** As chaves `./style.css` e
  `./dist/style.css` saíram do `exports`, e **não há alias** — então o import
  antigo agora falha ao resolver em tempo de build
  (`ERR_PACKAGE_PATH_NOT_EXPORTED`).

  ```diff
  - import "json-pdf-designer/style.css";
  + import "json-pdf-designer/theme.css";
  ```

  Uma linha basta: o `theme.css` já importa o reset por dentro.
  - Por quê: o pacote enviava Tailwind compilado, e isso incluía o
    **Preflight** — um reset global caindo no *seu* app, vindo de uma folha
    cujo único trabalho era pintar um editor.
  - Por que não um alias: ele entregaria em silêncio uma folha *diferente*
    (sem Preflight, com internals novos), e você descobriria por uma tela
    renderizando errado. Erro de resolve é a falha melhor, porque acontece
    no build e aponta pra esta entrada.
  - O Tailwind saiu do pacote inteiro: `tailwindcss` e `@tailwindcss/cli`
    fora do `devDependencies`, script `build:css` removido, `src/style.css`
    deletado, e `npm run build` agora é só `tsup`. `theme.css` e `reset.css`
    são escritos à mão e **não minificados**, de propósito — são o contrato
    público que você lê pra aprender os nomes de classe e de token, e o seu
    bundler minifica de qualquer jeito.
- **O `theme.css` não carrega reset global.** Cada classe `.jpd-*` passa a
  carregar o reset de que o elemento dela dependia — o trabalho que o
  Preflight fazia. A única regra com `*` é escopada às raízes do próprio
  editor e envolta em `:where()`, o que lhe dá **especificidade zero**:
  qualquer regra sua ganha dela.
  - O que o Preflight lhe dava de graça, e pode agora estar faltando na
    *sua* marcação: `box-sizing: border-box`, `margin`/`padding: 0` em
    heading, parágrafo e lista, `list-style: none`,
    `font`/`color`/`background` em controle de formulário,
    `svg { display: block }`, `code` em família monoespaçada,
    `table { border-collapse: collapse }` e `appearance: button`. Se o seu
    app se apoiava na folha do pacote pra isso, devolva o que você precisa.
  - Novo export **`json-pdf-designer/reset.css`** — o subconjunto sem
    aparência, pra quem vai estilizar `.jpd-*` do zero e não quer levar o
    tema. Importar os dois é redundante, não é erro.
  - **A armadilha que quase todo mundo erra devolvendo reset à mão:**
    `border: 0` põe `border-style: none`, e aí qualquer `border-width`
    posterior computa **zero**. Tem de ser `border: 0 solid`. O Preflight
    escrevia assim de propósito; as nossas duas folhas também.
- **Dark mode agora tem um hook documentado: `[data-jpd-theme="dark"]`.**
  Ponha no `<html>` ou em qualquer ancestral. **A `.dark` continua
  funcionando**, mantida como alias do que a 2.x usava
  (`@custom-variant dark (&:where(.dark, .dark *))`) — verificado no
  navegador que as duas pintam igual. `[data-jpd-theme="light"]` força
  claro.
  - Sem media query, de propósito: biblioteca não deve virar o seu app
    light-only escuro porque o sistema operacional está. Pra seguir o SO,
    leia `matchMedia` e escreva o atributo você mesmo.
  - **Limitação que vale saber:** uma ilha de dark *escopada* — o atributo
    num container em vez de no `<html>` — não pinta modal portalizado. O
    `<Modal>` renderiza por `createPortal(document.body)`, que é
    exatamente por que os tokens moram no `:root`.
- **Toda classe dentro do `<Designer>` mudou.** A marcação agora é `.jpd-*`
  mais `data-*`, na convenção `jpd-block__element--modifier` com UM nível de
  elemento; estado é atributo `data-*`, nunca classe (a regra: se o JSX
  teria de *concatenar* ou *escolher* uma string de classe, é `data-*`). O
  CSS que você escreveu contra os nomes de classe Tailwind antigos para de
  casar.
  - Verificado nos examples deste próprio repo: o `examples/custom-ui`
    estiliza só os containers *em volta* do editor, sem nenhum seletor
    descendente alcançando a marcação de dentro — então nenhum consumidor
    in-repo quebrou. Essa também é a forma que continua funcionando:
    estilize a sua casca, e mire `.jpd-*` de propósito quando quiser
    redefinir o editor.
- **`Modal`: `maxWidthClass` → `size`.** A prop antiga recebia uma string de
  classe Tailwind, que não sobrevive num pacote sem Tailwind dentro.

  ```diff
  - <Modal title="Campos" maxWidthClass="max-w-3xl" onClose={fechar}>
  + <Modal title="Campos" size="lg" onClose={fechar}>
  ```

  `size` é `"sm" | "md" | "lg" | "xl" | "full"`, com default `"lg"` = 48rem,
  que é o que o `max-w-3xl` dava. Largura arbitrária é
  `style={{ maxWidth: 900 }}`, e o `style` agora chega no painel.
  - Nenhum call site interno passava `maxWidthClass`, e ele não estava
    documentado em doc nenhum — vivia só no código — então a remoção não
    invalida nenhuma prosa que a gente escreveu.
- **`className` deixa de concatenar e passa a fazer merge.** O `cx` deduplica
  por token exato e devolve `undefined` (não `""`) quando não sobra nada,
  então componentes que emitiam `class="… "` com espaço sobrando não emitem
  mais — o `Card` era o pior deles, acrescentando um espaço até sem
  `className` nenhum. Se você faz asserção em cima da marcação, aquele
  espaço acabou.
  - A ordem dos tokens dentro do atributo `class` não decide mais nada. Ela
    nunca decidiu cascata nem com Tailwind, mas sem utilitária nenhuma
    sobrando não há o que decidir: `.jpd-btn` e a sua classe têm a mesma
    especificidade, então quem ganha é a ordem na FOLHA DE ESTILO. Quem
    precisa vencer o `theme.css` carrega o CSS **depois** dele, ou usa
    `style`, que ganha sempre.
- **Os componentes do kit repassam `ref`, então não são mais funções
  simples.** `Button`, `Input`, `Select`, `Textarea`, `Modal`, `Card`,
  `TabPanel` e os outros são componentes `forwardRef`: `Button.name` deixa
  de ser `"Button"`, e chamar `Button(props)` direto para de funcionar. É
  `forwardRef` e não a prop `ref` do React 19 porque o React 18 continua
  peer suportado.
  - **Os 20 ícones são a exceção.** Continuam funções simples, sem ref, e as
    props deles **alargaram** de `{ className }` pra `IconProps` =
    `SVGAttributes`. De propósito não `SVGProps`, que estende
    `ClassAttributes` e aceitaria um `ref` que não vai a lugar nenhum — o
    tipo mentiria.
- **`mono` não adiciona mais `font-mono`, e nenhum componente emite classe
  Tailwind.** No `Input` e no `Textarea`, `mono` virou um atributo
  `data-mono` que o `theme.css` estiliza. O `PaletteSwatches` e o
  `PalettePicker` perderam toda prop cujo *valor* era classe Tailwind
  (`size = "h-4 w-4"`, `swatchSize`, `swatchGap`, `swatchShrink`); como a API
  limpa é a que estreia pública, não há nota de migração pra elas.
  - **Isto aposenta o workflow "Using your own Tailwind installation".** Não
    há mais utilitária no `dist` pra escanear, então toda receita de
    `@source` ou `content` apontando pro pacote é agora conselho
    *ativamente prejudicial*: silenciosamente não produz nada. Traga o seu
    Tailwind, sim — só aponte pros seus próprios arquivos e estilize
    `.jpd-*` com ele.
- **A estrutura de DOM dentro do `<Designer>` também mudou**, não só os
  nomes de classe: cada peça renderiza o wrapper dela, com uma classe
  `jpd-*` na raiz. Se você alcançava a marcação do editor com seletor
  descendente, ou com variante arbitrária do Tailwind tipo `[&_.foo]:…` num
  container, isso pode quebrar. Nada neste repo fazia — a busca por variante
  arbitrária em `examples/` na 2.1.1 volta vazia.
- **Duplo-clique-pra-colapsar é afordância do `DesignerSidebar`, não de cada
  peça.** Dentro do `<Designer>` é idêntico: duplo clique na aba ativa e o
  painel colapsa. O `DesignerTabBar` ESCREVE o flag; o `DesignerSidebar` é
  quem LÊ e colapsa. Então um `<DesignerTabBar>` avulso dá um duplo clique
  sem efeito visível, que é o comportamento certo pra quem não tem o que
  colapsar.
  - Por que não por peça: o truque do `TabPanel` é um grid `1fr`→`0fr`, e
    isso exige um pai `flex column` com `min-block-size: 0`. Peça avulsa não
    garante esse pai, então colapso por peça animaria *errado*, em silêncio,
    em vez de degradar.
- **`sidebarTab` não gateia mais um painel a menos que você peça.** O gate
  por aba é opt-in, por `whenTab`: sem `whenTab`, a peça renderiza
  **sempre**; com `whenTab="pagina"` (ou um array de abas), ela só aparece
  ali. É assim que o `DesignerSidebar` e o `<Designer>` reproduzem o
  comportamento de hoje, então dentro do preset nada mudou.
  - Por quê: se o gate fosse o default, pôr `DesignerPropertyPanel` e
    `DesignerPageSettings` lado a lado no seu layout apagaria um dos dois,
    porque só uma aba pode estar ativa. Seriam peças que *parecem*
    decompostas mas só funcionam dentro de uma sidebar com abas, o que
    anula a feature inteira.
- **O `PdfPreviewModal` não herda primitivos de um `<Designer>` em outro
  lugar da página.** Ele vive no entry `json-pdf-designer/preview` e resolve
  do `UiComponentsProvider` mais próximo — e o provider do `<Designer>`
  embrulha só a subárvore do próprio `<Designer>`. Se você quer o seu Button
  dentro do modal de preview, ponha um `<UiComponentsProvider>` acima do
  modal também (a mesma constante de módulo serve).

- **O `generatePdf` agora lança erros tipados, e o `error.message` está em
  inglês.** É a única quebra desta lista que não tem nada a ver com CSS nem
  com marcação — ela alcança código que nunca importa folha de estilo,
  inclusive um backend usando o entry `json-pdf-designer/server`.

  Até a 2.1.1 toda falha era um `Error` comum, e a mensagem dele era
  **português cravado** — pra todo mundo, inclusive pra quem rodava o editor
  em inglês. O único jeito de distinguir uma falha da outra era casar essa
  frase:

  ```diff
  - // 2.1.1 — casando uma frase em português, num app que pode estar em inglês
  - if (/tamanho inválido/.test(err.message)) mostrarAjudaDeTamanho();
  - else if (/Paginação travada/.test(err.message)) reportarBug(err);
  + // 3.0.0 — casando uma classe
  + if (err instanceof InvalidPageSizeError) mostrarAjudaDeTamanho(err.pageId);
  + else if (err instanceof PaginationStalledError) reportarBug(err);
  ```

  São **18 classes concretas** sob uma base abstrata (`PdfGenerationError`,
  abstrata de propósito — ninguém deve lançar a base). Cada uma carrega um
  `code` literal e os campos estruturados que aquela falha realmente sabe,
  pra nada precisar ser extraído de volta de uma frase:

  ```ts
  class InvalidPageSizeError extends PdfGenerationError {
    readonly code = "invalidPageSize";
    readonly blame = "template";
    constructor(readonly pageId: string, readonly width: number, readonly height: number) { … }
  }
  ```

  - Por que o `message` em inglês: ele é a camada de **diagnóstico** — o
    console, seu rastreador de erro, a string que alguém cola num issue.
    Mensagem que muda de idioma faz o agrupamento de log depender do idioma
    de quem leu, e deixa stack trace impossível de buscar.
  - **Isto ACRESCENTA localização, não tira.** O texto que uma *pessoa* lê
    passa a sair do mesmo dicionário que você já entrega ao editor:

    ```ts
    const problem = describePdfError(err, dictFor(locale));
    // → { code, blame, title, action?, field?, detail } | null
    ```

    `title` e `action` vêm no `locale`; `detail` é a mensagem crua em inglês.
    Ou seja quem usa em inglês para de ver português, e trocar o `locale`
    retraduz.
  - **A armadilha, e é a razão inteira de `describePdfError` ser uma chamada
    separada:** nunca guarde o texto descrito em estado. Guarde o erro cru e
    descreva na *renderização*. Frase traduzida guardada em estado congela no
    idioma em que foi criada, então o seletor de idioma deixa aquele pedaço
    da tela atrás — e nada falha, só renderiza velho. Batemos nisso treze
    vezes nos examples deste próprio repo enquanto os migrávamos, e é por
    isso que os cinco agora guardam um motivo e resolvem o texto no render.

    ```diff
    - catch (err) { setErro(describePdfError(err, dictFor(locale))); }
    + catch (err) { setCaixaDeErro({ err }); }     // o erro cru
    + // …e no corpo do render:
    + const problem = caixaDeErro && describePdfError(caixaDeErro.err, dictFor(locale));
    ```
  - O `describePdfError` devolve **`null`** pra erro que não é do pacote, de
    propósito, em vez de inventar um título pra uma falha que ele não
    entende. Os seus erros ficam com a sua cópia — veja
    `examples/*/src/lib/generationError.ts` pra forma.
  - `blame` é `"data" | "template" | "config" | "package"` — a mesma
    distinção que um backend usa pra escolher entre 4xx e 500, então ela não
    devia existir em duas versões. `blame: "package"` quer dizer que o bug é
    nosso, e não do template de quem chamou.
  - Tudo acima é exportado dos **dois** entries — `json-pdf-designer` e
    `json-pdf-designer/server` — então um servidor classifica a falha sem
    puxar o React.

### A @layer da cascata, e por que não é regressão

O `theme.css` mora dentro de uma `@layer json-pdf-designer`. É isso que faz
o `className` que você passa sempre valer: CSS SEM layer ganha de CSS COM
layer independente de especificidade, então qualquer regra sua vence a nossa
por default, sem briga de especificidade. A ordem de layer é declarada antes
da primeira regra (`@layer json-pdf-designer, utilities;`), então vale não
importa qual folha você importa primeiro.

O efeito colateral é que um seletor de **elemento** solto — `button { … }` no
seu CSS global — também ganha, e alcança o chrome do editor. **Isto não é
novidade da 3.0.0.** Foi medido: o `dist/style.css` da 2.x era output do
Tailwind v4, e o Tailwind v4 também emite `@layer theme` / `@layer base` /
`@layer utilities`, então um seletor de elemento sem layer já vencia lá. A
`@layer` **preserva** a posição de cascata da 2.1.1 em vez de mudá-la. O
conselho é o mesmo de sempre: escope por classe, e mire `.jpd-*` de
propósito quando a intenção for redefinir o editor.

### Adicionado

- **`<DesignerProvider>`** — o provider de estado, e o que torna o resto
  desta lista possível. Props: `template`, `onChangeTemplate`, `bindings`,
  `onChangeBindings`, `onCanvasDrop`, `dataSources`, `gridSizeMm`,
  `expandOnSelect`, `children`. O `Designer.tsx` foi de 986 linhas pra 101,
  porque é só isso que o preset é agora: três providers e duas peças num
  layout de duas colunas.
- **Dez peças posicionáveis**: `DesignerCanvas`, `DesignerTabBar`,
  `DesignerFieldList`, `DesignerToolbar`, `DesignerPageSettings`,
  `DesignerPropertyPanel`, `DesignerFilterPanel`, `DesignerBindingEditor`,
  `DesignerInspector` e `DesignerSidebar` — a última uma conveniência que
  compõe as sete peças de conteúdo com o gate de aba do preset.
  - Toda peça aceita `className` (merge, a sua vem depois), `style` (o seu
    ganha) e `whenTab`. Várias aceitam `parts`, que endereça os elementos
    *de dentro* por papel, mais flags como `heading`, `hint`, `header` e
    `position`.
  - O `DesignerPropertyPanel` recebe `section="dados" | "estilo"` como
    **prop**, em vez de ler a aba ativa — então duas instâncias com sections
    diferentes renderizam juntas.
  - Nunca posicionáveis, de propósito: `FieldBox/*` e os painéis
    `PropertyPanel{Text,Table,…}`, que são despachados por `schema.type`. Um
    `<DesignerTextPanel/>` avulso não tem resposta pra "qual schema?" que
    não seja "o selecionado", e aí ele é só um `DesignerPropertyPanel` pior.
- **Dez hooks públicos.** Acessores `useDesignerData`,
  `useDesignerActions`, `useDesignerSelection`, `useDesignerUi`,
  `useDesignerConfig`; seletores `useDesignerSelectedSchema`,
  `useDesignerFieldListSchemas`, `useDesignerBulkEdit`,
  `useDesignerTabWarnings`, `useDesignerFilterColumns`.
  - Os cinco contextos são divididos por **frequência de mudança**, então
    cada peça lê só o que usa. O `useDesignerActions` nunca troca de
    identidade — é o load-bearing, o motivo pelo qual uma peça memoizada
    consegue segurar um mutador sem re-renderizar a cada mudança de
    template — enquanto o `useDesignerData` muda a cada edição.
  - Usados fora do provider, eles **lançam**, com mensagem nomeando o
    provider, em vez de devolver `null`. Peça sem estado não tem fallback
    nenhum, então um `null` silencioso deixaria você olhando um buraco na
    tela.
- **`UiComponentsProvider` / `useUiComponents` / `defaultUiComponents`** —
  troca os primitivos que o editor usa *por dentro*. **Doze slots**:
  `Button`, `Input`, `ColorInput`, `Select`, `Textarea`, `Checkbox`,
  `Modal`, `Card`, `CardHeader`, `CardTitle`, `Badge`, `TabPanel`. Todo tipo
  `*Props` é exportado pra que um adapter seja umas cinco linhas, tipado nas
  duas pontas, e o exemplo escreve com `satisfies UiComponentsOverride`. O
  `<Designer components={…}>` é açúcar pra montar o provider.
  - `undefined` numa chave significa **herda** do provider de cima, não
    volta-ao-default. Pra ter o nosso de volta, nomeie:
    `{ Modal: defaultUiComponents.Modal }`.
  - **A pegadinha pra ler antes de escrever um adapter:** o slot recebe as
    props *como o chamador as escreveu*, e os defaults moram dentro dos
    nossos componentes. O `<Button>` desestrutura
    `{ variant = "primary", size = "sm" }` na assinatura *dele*, então um
    chamador que escreve `<Button>ok</Button>` manda `variant: undefined`
    pro seu adapter — medido: cinco dos seis botões da Toolbar chegam sem
    `variant`. O seu adapter precisa dos próprios defaults. Os do editor
    são Button primary/sm, Modal `lg`, e `TabPanel.collapsed` sem default.
  - **Identidade instável é a aresta mais afiada.** Objeto inline cria um
    tipo de componente novo a cada render e o React remonta o que você
    slotou — o sintoma é o campo perder o foco a cada tecla. Hoiste o mapa
    pra constante de módulo. Fora de produção o provider avisa no console,
    uma vez.
  - `components={{ Button: MuiButton }}` **não** type-checka direto (o
    `variant` do MUI conflita com o nosso), e nenhum truque resolve — o
    adapter é a resposta. `label` é a prop que morde: um slot que descarta
    `label` remove o nome acessível de uns dezesseis controles. O
    `TextField` do MUI tem `label` compatível; o `Input` do Chakra não tem.
    E o `Textarea` é o único slot em que ignorar a `ref` quebra algo: o
    modal de fórmula passa uma ref pra reposicionar o caret depois que você
    aceita uma sugestão.
  - Não slotáveis: `PageCanvas`/`Ruler`/`FieldBox` (são a maquete do PDF —
    padding de primitivo estranho quebra o WYSIWYG), a barra de abas (a
    2.1.1 inteira foi gasta encaixando seis abas em 290px; o `min-width` de
    um Button slotado desfaz isso), o input de rename do `FieldList` (que
    depende de `autoFocus` mais commit no `onBlur`), o input de arquivo
    escondido, o glifo "ƒx" e os ícones.
- **`Checkbox`** — fecha a lacuna de três `<input type="checkbox">` crus no
  editor, e é o décimo segundo slot.
- **Componentes do kit agora públicos**: `PalettePicker`, `PaletteSwatches`,
  `MaterialIcon`, `CollapsibleSection`, `ClearFieldButton`. Todos eles — e
  tudo que já era público — aceitam `className`, `style` e `...rest`, sob
  uma regra: **`className`/`style`/`...rest` vão pro elemento que dá NOME ao
  componente; todo outro elemento que ele renderiza é endereçado por
  `parts`, por papel.** Então `Input.className` continua no `<input>`
  (igual à 2.x) e o `<label>` que embrulha é `parts.root`;
  `Modal.className` é o painel e o fundo escurecido é `parts.overlay`. O
  `parts` aceita só `className`/`style` — sem handler, sem ref — com atalho
  de string (`parts={{ label: "minha-classe" }}`) e forma de objeto quando
  você precisa de `style`. O `mergeStyle` dá a vitória ao seu `style`.
  - O `BulkLocked` fica interno de propósito: ele significa "travado porque
    você selecionou vários do mesmo tipo", que é um *modo* do `<Designer>`.
    Fora daquele contexto o componente não quer dizer nada.
- **Uma superfície de erro tipada**: `PdfGenerationError` (abstrata) mais 18
  classes concretas, `PDF_ERROR_CODES` (os 18 códigos como tupla `const`),
  `PdfErrorCode`, `PdfErrorBlame`, `AnyPdfError` e `isPdfError(err)`, que
  estreita `unknown` pra `AnyPdfError`. Tudo dos dois entries. O porquê de as
  mensagens antigas de `Error` terem que sair está na seção Breaking.
- **`describePdfError(err, dict)` → `PdfProblem | null`** — uma chamada que
  transforma um erro capturado em
  `{ code, blame, title, action?, field?, detail }` com a cópia já no idioma
  do dicionário. Use junto com `dictFor(locale)`, também exportado dos dois
  entries.
  - Ela é exaustiva, então "caiu no ramo genérico porque eu não reconheci"
    deixou de ser um estado possível do pacote — e um código novo em
    `PDF_ERROR_CODES` para de compilar até ter cópia nos dois idiomas.
  - O `PdfProblemCode` tem **19** membros enquanto o `PDF_ERROR_CODES` tem
    18, e o extra não é descuido: `"expression"` cobre o `ExpressionError`,
    que é uma hierarquia própria em vez de uma das 18 (ele já carrega um
    `localize(dict)`, então descrevê-lo de novo aqui daria duas frases
    diferentes pra mesma falha). É também o código de problema que você
    dificilmente verá vindo do `generatePdf` — a geração é tolerante de
    propósito, e expressão inválida renderiza como campo vazio. Ele aparece
    quando você chama a API estrita, por exemplo o `parse` num backend que
    valida o template antes de salvar.
- **`json-pdf-designer/reset.css`** como export próprio — ver a entrada de
  Breaking acima.
- **Props novas do `<Designer>`, todas opcionais**: `gridSizeMm`,
  `expandOnSelect`, `className`, `style`, `components`. As sete props que ele
  sempre teve seguem inalteradas.
- **`examples/composed-layout`** (porta 5177) — o app que só funciona porque
  o gate de aba é opt-in: toolbar full-width em cima, lista de campos à
  esquerda, canvas no meio, e uma coluna à direita com cinco painéis
  empilhados que dentro do `<Designer>` seriam abas diferentes. Nenhuma peça
  recebe `whenTab`. Medido: oito peças no DOM ao mesmo tempo, e zero
  `.jpd-tabs`.
  - O `examples/report-builder` migrou pras peças com um layout
    **idêntico**, e o que a migração comprou foi o `<SelectedFieldBar>` — a
    casca do próprio app lendo a seleção do editor por hook, o que era
    impossível na 2.x (o comentário antigo em `App.tsx` dizia exatamente
    isso: o `<Designer>` era dono da seleção e não havia prop pra dirigi-la
    de fora). Verificado: "remover" na barra do próprio app leva o template
    de três campos pra dois, e o Ctrl+Z do app desfaz (dois de volta pra
    três) — ou seja o mutador do pacote passa pelo `setState` do consumidor,
    e o undo/redo dele vê.
  - O `examples/custom-ui` fica no `<Designer>` de propósito: é o teste de
    regressão do caminho de uma linha, e não importa **nenhum** CSS do
    pacote, estilizando `.jpd-*` do zero — esse é o modo SEM FOLHA DE ESTILO
    do pacote. O `examples/no-preview` é outra coisa: ele importa o
    `theme.css` normalmente, e é o melhor smoke test da PERDA DO PREFLIGHT,
    porque não tem pipeline de Tailwind em ponta nenhuma — o `report-builder` tem o próprio, então emite Preflight
    por conta e **não** reproduz uma perda de reset. Testar nele primeiro dá
    falso verde.

### Corrigido

- **O `aria-label` do botão de fechar do `Modal` era o título do diálogo.**
  Leitor de tela anunciava "Editor de fórmula" como o nome do botão que
  fecha o editor de fórmula. Agora tem nome próprio, traduzido
  (`t.modal.close`).
- **O `fitTo` do canvas nunca usou o viewport do canvas.** Ele procurava por
  `[data-scroll-root], [class*="overflow-auto"], [class*="overflow-y-auto"]`
  — mas o `data-scroll-root` não era escrito em lugar nenhum, e o wrapper
  usava `overflow-x-auto`, que não contém nenhuma das duas strings como
  substring. Medido na 2.1.1: "ajustar largura" dava 113% com **338px de
  página fora da viewport**. Com o atributo no lugar: 67%, e zero overflow.
- **A régua não tinha dark mode.** O fundo escurecia
  (`dark:bg-gray-800`), mas o tick e o número eram atributos SVG de
  apresentação com hex fixo (`stroke="#94a3b8"`, `fill="#64748b"`) — tick
  escuro sobre fundo escuro. Os três vêm de token agora
  (`--jpd-ruler-bg`, `--jpd-ruler-tick`, `--jpd-ruler-label`), então andam
  juntos.
- **A faixa de abas do modal de fórmula transbordava, só em pt-BR.** Medido
  no `examples/no-preview` num viewport de 1280px: "Campos do item" (96,7px)
  mais "Caminhos de dado" (108,8px) dá **205,4px dentro de uma coluna de
  176px**, e a faixa tinha `overflow: visible` — então os botões pintavam por
  cima da coluna do editor ao lado. Em inglês as mesmas duas abas
  ("Item fields" / "Data paths") somam 151px e cabem com folga, e é por isso
  que o bug só existia traduzido. A faixa agora é
  `jpd-tabs jpd-tabs--scroll` (`overflow-x: auto` mais
  `min-inline-size: 0`), então ela mede `scrollWidth` 207 contra
  `clientWidth` 176 e **rola em vez de cortar**.
  - Só *aquela* instância recebe o modificador. O `.jpd-tabs` do painel
    lateral não pode receber `overflow`, porque cortaria o popover do
    `.jpd-tabs__more`.
- **Os ícones perdiam o `display: block`.** Sem Preflight, todo `<svg>`
  inline volta pra inline-baseline e ganha vão de descendente dentro de uma
  linha flex — uns 23 call sites, incluindo o `<IconX/>` dentro dos botões
  do próprio kit. Corrigido no base de `icons.tsx`, onde o `jpd-icon` agora
  entra em todo ícone em vez de em cada call site.
- **A borda do input de rename não tinha cor de dark.** O input inline do
  `FieldList` carregava `border-sky-400` sem nenhum `dark:border-*` —
  sky-400 sobre gray-800.
- **A seta do seletor de paleta da tabela não tinha cor de dark.** Ela era
  preservada por uma prop `staticArrow` que existia só pra manter vivo um
  detalhe não intencional. A prop morreu e a seta segue o tema.
- **O `gridSizeMm` não era honrado nem pelo colar nem pelo nascimento de
  campo.** O `PageCanvas` já recebia a prop, mas o `computeSpawnPosition`, o
  `nextFreeY` e o caminho do colar usavam a constante direto: com
  `gridSizeMm={3}`, o arrasto alinhava em 3 enquanto nascer e colar
  alinhavam em 5, então campo novo já nascia fora da sua grade. Os
  **quatro** caminhos recebem o passo agora, e o `<Designer gridSizeMm>`
  existe.
- **O `.jpd-tabs__strip` perdeu o `::-webkit-scrollbar { display: none }`**
  na migração — o `.jpd-scroll-x` antigo tinha as duas regras e só uma
  atravessou. `scrollbar-width` sozinho não cobre Safari nem Chromium < 121,
  e numa faixa de 28px de altura a barra come metade da altura.
- **Template sem tamanho de página estourava no layout em vez de falhar como
  problema de template.** O `assertFinitePageSize` morava dentro do render,
  que roda *depois* do `layoutDocument` — e o layout lê o tamanho direto
  (`pageDef.page.height - footerHeight`). Então um template cujo `page` não
  existia — JSON editado à mão, arquivo de outra ferramenta, formato que a
  migração não cobre — lançava
  `TypeError: Cannot read properties of undefined (reading 'height')` de
  dentro do layout, antes de o guard estar na pilha. O guard estourava
  justamente na entrada que ele existe pra recusar.
  - A mensagem feia não era o custo real. Um `TypeError` não é erro nosso,
    então `describePdfError` devolve `null` pra ele, e o consumidor
    classifica a falha como `blame: "package"` — "não é culpa sua, reporte"
    — quando o problema era o template dele. É a confusão que a superfície
    de erro tipada existe pra acabar.
  - Agora o tamanho de toda página é conferido de antemão, antes do layout,
    sobre a lista NORMALIZADA de páginas (`pages` é opcional; ausente, os
    campos planos são a página implícita, que é o template mais comum que
    existe). Conferir todas de uma vez também significa que quem carrega um
    arquivo descobre que a página 7 está errada sem esperar seis páginas
    boas renderizarem.
- **O texto sobre a folha não tinha cor própria, então no dark ele ficava
  ilegível.** O `.jpd-page` é a maquete do PDF, e a folha é sempre papel
  branco — o PDF não tem dark mode. Só que ele declarava apenas
  `background-color`, então todo texto de campo sem cor própria herdava o
  `--jpd-text` do *tema*: cinza-claro sobre branco. Medido no
  `examples/no-preview`, as células vazias `—` de uma tabela davam
  **1.54:1** — texto que existe e não se lê. Agora o `.jpd-page` também
  declara `color: var(--jpd-canvas-ink)` (**17,75:1**), um token que de
  propósito não tem versão dark. Campo com `fontColor` no schema continua
  sobrescrevendo inline, como sempre.
- **O gatilho do seletor de paleta caía na cor de botão do sistema.** Ele é
  um `<button>` que *tem* classe, então o reset por elemento
  (`:not([class])`) não o alcança — de propósito, pra o reset nunca
  repintar o botão do próprio consumidor — e ele também não estava na lista
  por classe do `reset.css`. Sem `background-color` próprio ele caía no
  `ButtonFace` do sistema, que com `color-scheme: dark` é cinza-escuro: o
  rótulo dava **3,45:1** e a seta **1,25:1**. Agora ele declara
  `background-color: var(--jpd-surface-field)`, como todo outro controle.
- **O `reset.css` lia três tokens que só o `theme.css` declara.**
  `--jpd-font-sans`, `--jpd-font-mono` e `--jpd-text-placeholder`, todos sem
  fallback — e como o `reset.css` é export público por si, usado avulso cada
  `var()` caía em nada e a regra morria calada. O pior dos três era o
  `<code>` do `withInlineCode`, que sai sem classe e cuja monoespaçada vinha
  só do Preflight.

### Não quebra, e vale dizer em voz alta

- **As sete props que o `<Designer>` sempre teve são idênticas**:
  `template`, `onChangeTemplate`, `bindings`, `onChangeBindings`,
  `onCanvasDrop`, `dataSources`, `locale`. Tudo o que é novo nele é
  opcional.
- **As chaves de localStorage de ordem e visibilidade de aba são
  preservadas** — `json-pdf-designer:tab-order` e
  `json-pdf-designer:hidden-tabs`. O layout de abas do usuário sobrevive ao
  upgrade; verificado no navegador.
- **`PageCanvas`, `Toolbar`, `FieldList`, `PropertyPanel`, `BindingEditor`,
  `FilterTab` e `TemplateInspector` mantêm as props de hoje** e continuam
  exportados dos módulos deles, então o caminho headless por props segue
  funcionando exatamente como funcionava.
- **O `react-rnd` continua só necessário pro canvas.** A peça é dona da
  geometria da folha (mm→px, `transform: scale(zoom)`) porque o react-rnd
  calcula o delta de arrasto contra esse transform — sobrescreva e o campo
  foge do cursor. Você é dono do viewport que *rola*, que é o que o
  `className` atinge, e da largura da sidebar (os 320px moram no CSS do
  preset, não na peça). O zoom continua estado interno do `<PageCanvas>` e
  nunca subiu pro contexto.
- **O `server.ts` está intocado** — `server.d.ts` byte-idêntico no build. O
  install de backend sem React é exatamente o que era na 2.0.0.


## 2.1.1 (2026-09-01)

### Corrigido

- **A barra de abas do painel lateral rola, em vez de cortar uma aba.** Com as
  seis abas à mostra (Campos/Dados/Estilo/Filtro/Página/Inspetor) a barra
  precisava de mais que os 320px do painel — medido: 335px de abas em 290px de
  espaço em português, com o "Inspetor" cortado em 45px, e o "×" de fixar (que
  só a aba ativa desenha) respondendo pelos últimos 12px. Agora a faixa rola na
  horizontal, sem barra de rolagem visível (ela comeria metade de uma faixa de
  30px de altura) e com a aba ativa trazida pra vista sempre que muda —
  inclusive quando quem muda é outra coisa, como selecionar um campo, que troca
  pra "Dados" por conta própria. O "+" que reabre aba escondida fica **fora** da
  faixa que rola, pra não ser a primeira coisa a sair de alcance.
  - Alargar o painel conforme a contagem de abas era a outra saída, e é pior:
    Dados/Estilo/Filtro aparecem e desaparecem conforme o tipo do campo
    selecionado, então o canvas pularia a cada troca de seleção.

## 2.1.0 (2026-09-01)

Fase 1 da roadmap pós-2.0.0: a fundação de que o resto depende —
versionamento do formato de template, depois AST de expressões, depois uma
passada de layout unificada. Em cima dela, o que a AST destravou: visibilidade
condicional, uma superfície de falha tipada, e um editor de expressão com lista
de campos e autocomplete.

### Adicionado

- **Editor de expressão (`ƒx`)** — o botão `ƒx` agora abre uma janela com os
  campos a que o schema está vinculado à esquerda e um editor multilinha no
  centro, com autocomplete das funções e operadores do formato mais validação
  ao vivo. O editor guarda o **valor do campo em si**, com as chaves, aberto já
  com o que estava lá — a edição é no lugar, então prefixo literal (o `FAT-` de
  `FAT-{fatura}`) fica onde está. As sugestões aparecem só dentro das chaves;
  fora delas é texto literal.
  - **Chave desbalanceada agora é acusada** — nada mais fazia isso. O
    resolvedor de template casa `/\{([^{}]+)\}/g`, então uma `{` sem par
    simplesmente não casa e aquele trecho sai como **texto literal** no PDF
    (`{CURRENCY(total` impresso na cara). Não é erro de sintaxe de expressão (o
    parser nunca vê) nem falha de geração; era um campo saindo errado em
    silêncio. `braceError(template, t?)` e `tokenAtCaret(template, caret)` são
    exportados pra quem monta editor próprio.
  - Disponível em quatro alvos: fórmula de coluna de tabela, cada célula da
    linha de totais, título/valor/legenda do KPI e conteúdo de um campo de
    texto. Antes disso só a fórmula de coluna tinha algo, e era um campo de uma
    linha numa sidebar de 320px.
  - A lista de campos tem dois grupos, porque resolvem em escopos diferentes:
    campos **de cada item** do array vinculado (`total`, sem prefixo — o que
    funciona dentro de uma linha) e os **caminhos completos** (`faturas.total` —
    o que uma agregação precisa). Confundir um com o outro era dos erros mais
    fáceis de cometer.
  - O autocomplete oferece as 11 funções com a dica de cada uma mais
    `AND`/`OR`/`NOT`, e põe os espaços que um operador precisa em volta — então
    não consegue produzir o operador de um lado só descrito abaixo.
  - Erro de sintaxe bloqueia o salvar; operador suspeito só avisa (chave JSON
    com `/` no nome é uso legítimo).
  - O `Modal` entra na lista de componentes de UI exportados.
- **`suspiciousOperator(source)` / `templateSuspiciousOperators(template)`** —
  operador com espaço em **exatamente um lado** agora é apontado. Não é erro de
  sintaxe e não pode virar um: operador só é operador cercado de espaço dos
  dois lados, e é isso que mantém `{my-key}`, `{fatura/2}` e `{a==2}`
  acessíveis como caminho de dado. Mas `{fatura /}` — `/` com `}` do lado
  direito — virava em silêncio a chave `"fatura /"`, resolvia pra vazio, e nada
  acusava. Agora acusa.
  - A checagem roda sobre os **tokens** `ident`, não sobre a string crua, e é
    isso que a deixa sem falso positivo: operador de verdade já é token `op`,
    texto entre aspas já é token `string`, e sinal de negativo (`-1` depois de
    vírgula) já é token `number` — nenhum deles chega na checagem.
  - `SchemaExpressionError` ganhou `severity: "error" | "warning"`. Erro
    significa que o campo renderiza vazio com certeza; aviso significa que
    compila mas quase certamente não é o que o autor quis. O `fieldWarning`
    reporta o erro primeiro.
- **Visibilidade condicional (`schema.visibleWhen`)** — uma expressão, sem
  chaves, avaliada contra o JSON de verdade na hora de gerar; o campo só é
  desenhado quando ela é verdadeira.

  ```ts
  { type: "text", content: "Desconto PJ", visibleWhen: 'cliente.tipo == "empresa"' }
  { type: "table", visibleWhen: "NOT cancelado" }
  ```

  - Funciona em **todo** tipo de campo, inclusive tabela e seção repetida, e
    nas faixas repetidas — a condição de um cabeçalho/rodapé pode usar
    `pageNumber`/`pageCount`, então "só na última página" é
    `pageNumber == pageCount`.
  - **Fluxo:** esconder um item devolve a **altura** dele e nada mais. O que
    vem depois sobe exatamente isso, e o espaçamento autorado nos dois lados
    continua valendo. Esconder um campo de uma linha que tem vizinhos visíveis
    deixa o buraco, porque a linha continua existindo pros outros; escondendo
    todos, a linha inteira sai.
  - Ausente (ou em branco) = sempre visível, então nenhum template existente é
    afetado.
  - Condição **inválida** conta como **visível**, nunca escondida: um erro de
    digitação não pode fazer um campo desaparecer do relatório em silêncio. O
    editor avisa (ver abaixo) e o campo continua aparecendo até alguém
    consertar.
  - O `<Designer>` tem um campo "Mostrar só quando" pra isso, ao lado de
    X/Y/largura/altura, com o erro de sintaxe aparecendo ao vivo embaixo.
- **`AND` / `OR` / `NOT`** nas expressões — `{a > 1 AND NOT cancelado}`. `AND`
  liga mais forte que `OR`, parênteses agrupam, e os dois curto-circuitam.
  Mesma regra lexical de todo operador: **só cercado de espaço**, então uma
  chave JSON chamada `AND` continua acessível como `{AND}`. Case-insensitive,
  igual nome de função.
- **A validação de expressão virou API pública** — `expressionError(source)`,
  `templateExpressionErrors(template)` (nas duas entries) e
  `expressionErrors(schema, binding)` / `fieldWarning(schema, binding, t)`
  (entry principal). Um backend pode recusar um template com expressão quebrada
  *antes* de salvar; uma UI de editor própria pode apontar do jeito que o
  `<Designer>` aponta.
  - O `t` do `fieldWarning` agora é **opcional** (inglês por padrão), e
    **`dictFor(locale)`** devolve um dicionário de tradução como valor comum.
    O `fieldWarning` era exportado mas exigia um `Dict` que só saía do
    `useT()`, dentro de um componente React — então o lugar onde ele era mais
    útil, uma passagem de validação fora do editor, não conseguia chamar. Achado
    escrevendo essa passagem no `examples/report-builder`.

- **`Template.version` e `migrateTemplate()`** — um `Template` é um formato de
  documento, não uma estrutura interna: uma vez que ele vive num banco,
  sobrevive a qualquer versão deste pacote. `version` acompanha o **formato
  JSON** (não o pacote npm), `TemplateVersion` é uma união de um só membro
  hoje pra que adicionar `| 2` faça o compilador apontar todo lugar que
  precisa decidir, e `migrateTemplate(input)` normaliza um template vindo de
  banco/arquivo/API pro formato que este build entende.
  - `version` ausente é tratada como formato 1 — exato pra todo template salvo
    antes do campo existir, já que nenhuma mudança de forma aconteceu desde
    então.
  - `version` maior do que este build entende **estoura**, em vez de gerar um
    PDF que descarta em silêncio campos que ele não conhece.
  - O `generatePdf` chama internamente, no ponto único por onde todo template
    passa, então nunca se gera PDF de um template não migrado.
  - As migrações moram numa cadeia só (`src/template/migrate.ts`), um degrau
    por versão — nunca `if (version === 1) … if (version === 2) …` espalhado
    pelos chamadores. A cadeia está vazia hoje porque existe um formato; ela
    existe agora porque adicionar depois de haver template em banco de
    produção custa muito mais.
  - Exportado por `json-pdf-designer` e por `json-pdf-designer/server`.

### Corrigido

- **Editar a célula da tabela no canvas agora atualiza a fórmula da coluna
  também.** A célula **é** a fórmula da coluna — o `generate.ts` resolve a
  linha a partir de `schema.content` — e o painel `ƒx` lê
  `binding.columns[i].formula`. Editar pelo `ƒx` já gravava nos dois; editar a
  célula direto gravava só o content, então o painel seguia mostrando a fórmula
  antiga: dois valores pra mesma coisa, com o que aparecia sendo o que **não**
  chega no PDF. Mesmas regras nos dois sentidos (célula esvaziada volta a ser a
  coluna crua).
- **Fórmula de coluna de tabela não é mais acusada de expressão quebrada.**
  O `bindingExpressionErrors` validava `column.formula` como expressão pura,
  mas o render resolve com `renderTemplate` — fórmula é *template*, então
  `"FAT-{fatura}"` está correto e estava sendo apontado. Dois dos templates de
  exemplo que o próprio pacote entrega acenderam por causa disso. Agora é
  validado como template, igual ao que roda de verdade.

- **Expressão mal-formada não derruba mais o PDF inteiro.** A geração voltou a
  ser tolerante: um `{...}` inválido resolve pra vazio, então uma vírgula
  sobrando deixa *aquele campo* em branco em vez de fazer o `generatePdf`
  falhar e não sair documento nenhum. Esse era o raio de alcance antes da AST,
  e trocar "um campo em branco" por "nenhum relatório" não era melhoria.
  - O parser em si continua estrito — é ele que alimenta o aviso novo no campo
    (`"Expressão inválida em \"content\" — renderiza vazio"`), que é onde o
    problema deve aparecer: no editor, antes de gerar.
  - `CONCAT(a,)` — vírgula sobrando antes do `)` — voltou a ser tolerado, como
    era antes da AST.
- **Relatório grande não é mais truncado em silêncio.** Dois contadores de
  iteração (1000 fatias de tabela, 20000 repetições de seção) limitavam volume
  *sem avisar*: 60 mil linhas de tabela saíam como 40.998, e 20 mil repetições
  de seção saíam como 18.667, num PDF que parecia completo. Omitir linha de um
  relatório sem dizer nada é o pior resultado possível.
  - Eles também protegiam de um laço que não pode acontecer: o da tabela sempre
    quebra em `capacity <= 0`, e o da seção sempre consegue colocar o item na
    página seguinte (numa página recém-aberta o cursor *é* o headerHeight, e aí
    `needsNewPageForItem` é falso). Contar iteração era medir a coisa errada.
  - O limite agora é em **página** — o recurso escasso de verdade, venha a
    página de tabela, de seção ou de várias páginas-design — vale 5000 por
    default, é configurável com `generatePdf(..., { maxPages })`, e estourá-lo
    lança `PageLimitError` nomeando o campo que estava sendo paginado e dizendo
    o que fazer. Volumes que antes eram cortados (60 mil linhas → 1464 páginas)
    agora saem completos.
  - Uma passada de paginação que não consome conteúdo nem abre página também
    estoura agora: isso é bug de aritmética do pacote, e girar até um contador
    esgotar escondia isso.
- **Os erros de geração são exportados como classes** — `PageLimitError`,
  `UnsupportedGlyphError`, `ExpressionSyntaxError`/`ExpressionDepthError` (sob
  `ExpressionError`) e `DEFAULT_MAX_PAGES`, nas duas entries. Um backend
  responde 413 pra um e 400 pra outro sem precisar casar mensagem de erro.

- **Caractere de controle no dado não derruba mais o PDF.** Um `\n` no nome de
  um cliente — de um textarea, de um endereço com quebra, de um import de CSV —
  fazia o documento inteiro falhar com `WinAnsi cannot encode "\n"`. Caracteres
  de controle (C0, DEL, C1) agora viram espaço antes de medir ou desenhar, em
  todo caminho que chega ao papel: campo de texto, célula de tabela, KPI,
  rótulo de gráfico e as faixas repetidas. Eles não têm glifo em fonte
  *nenhuma*, nem numa Unicode completa passada em `fontBytes` — então não é
  perda de conteúdo, é a única renderização possível. Era o crash de maior
  impacto do pacote: o gatilho é o **dado**, que quem montou o template não
  controla.
- **Glifo ausente agora diz qual campo e qual caractere.** Emoji/CJK sem fonte
  customizada continua falhando — descartar caractere de um documento que
  alguém assina seria pior — mas o erro agora é
  `Campo "cliente_nome": o caractere "🎉" (U+1F389) não existe na fonte usada …`
  em vez do `WinAnsi cannot encode` cru do pdf-lib, que não nomeava nada.
  Cobre os cinco caminhos (texto, célula de tabela, KPI, rótulo de gráfico e
  tabela aninhada em seção repetida), e um emoji fora do BMP é reportado como um
  caractere, não como duas metades de par surrogate.
- **Fundo de página corrompido lança um `Error` de verdade.** O pdf-lib/pako
  lançava uma **string** crua ali (`"The input is not a PNG file!"`), então o
  `catch (e) { e.message }` de quem chama recebia `undefined`. Mesmo tratamento
  que o campo de imagem já tinha.
- **Vínculo de imagem agora chega ao PDF.** O `drawImageField` lia
  `schema.content` e ignorava o valor resolvido, então o editor deixava vincular
  um campo de imagem ao JSON e o gerador desenhava sempre a imagem de design.
  Valor vinculado que não é data URI (path errado, URL http, texto solto) deixa
  o campo vazio em vez de falhar.
- **Número degenerado não produz mais um `TypeError` opaco do pdf-lib.**
  `fontSize` NaN cai num default (uma medida perdida não pode custar o
  documento); **tamanho de página** inválido falha com
  `Página "…": tamanho inválido (width=NaN, …)` — é estrutural, e não há default
  sensato pra adivinhar.

- **Expressão aninhada demais também não derruba mais o PDF.** O guarda de
  profundidade lançava um `Error` cru, e a camada tolerante só pegava
  `ExpressionSyntaxError` — então o único caso pra que o guarda existe (template
  malformado ou malicioso) era justamente o que a tolerância não cobria. Os
  erros agora são uma hierarquia pequena de classes (`ExpressionError` →
  `ExpressionSyntaxError` / `ExpressionDepthError`), então a camada tolerante
  pega os dois por TIPO em vez de casar a mensagem de erro com regex, e o que
  *não* é problema de template continua subindo.
  - A garantia original está intacta e continua testada: aninhamento excessivo
    é um erro claro e limitado, não um stack overflow do V8. Ela agora mora na
    API estrita (`parse`, `expressionError`), enquanto a geração renderiza o
    campo vazio e o editor aponta — a mesma troca que os erros de sintaxe
    fazem.
- **Literal numérico mantém as casas que o autor escreveu.** `{2.50}` volta a
  renderizar `"2.50"` (não `"2.5"`), `{007}` renderiza `"007"`. Dentro de uma
  conta o valor é coagido normalmente, então `{2.50 + 0}` continua `2.5`.
- **A posição do erro de sintaxe agora é o offset exato.** Cada token guarda o
  próprio início, então a posição está certa mesmo com espaço entre tokens e
  com token repetido — nem `indexOf` (primeira ocorrência) nem soma de tamanhos
  (ignora o espaço) acertavam isso.

- **Precedência de operador nas expressões de template.** `{a + b * c}` agora
  avalia como `a + (b * c)`. O motor anterior dobrava da esquerda pra direita,
  como calculadora de bolso, então com `a=2 b=3 c=4` produzia **20** em vez de
  **14** — número errado num relatório financeiro, sem erro nenhum.
- **Agrupamento por parêntese.** `{(a + b) * c}` agora funciona. O motor
  anterior não tinha noção de agrupamento: o padrão de chamada de função não
  casava com um `(` no início, a passada aritmética não sabia agrupar, e o
  resultado virava **`0`**, em silêncio.
- **Texto numa expressão aritmética não estoura mais.** `{"x" + 1}` devolve
  vazio, a convenção do formato pra "não deu pra resolver". Antes, a passada
  aritmética desistia, o fallback reprocessava a mesma string, e a recursão
  corria até o guarda de aninhamento estourar — com uma mensagem sobre
  profundidade que não tinha nada a ver com o problema.
- **Divisão por zero não estoura mais.** `{a / zero}` devolve vazio, pelo mesmo
  motivo. Esse é uma entrada plausível de verdade: um denominador que zera numa
  linha.

### Alterado

- **O motor de expressões agora é parse → AST → evaluate**
  (`src/expressions/`), substituindo o reescritor recursivo de strings que
  reparseava a mesma string em cada nível de aninhamento. As quatro correções
  acima vêm da estrutura, não de remendo em cima dela.
  - `resolveToken(token, data)` mantém assinatura e retorno `string`, então
    nada a jusante mudou e a suíte de testes que já existia rodou sem
    alteração como prova de não-regressão.
  - A regra lexical do formato agora é explícita e testada: **um operador só é
    operador quando cercado de espaço em branco dos dois lados**. `{my-key}` e
    `{my key}` continuam paths (chave JSON com hífen e com espaço é comum),
    `{a - b}` é subtração. O motor anterior tinha isso por acidente, via
    regex; um tokenizador convencional quebraria `{my-key}` em três tokens e
    devolveria 0.
  - Valores intermediários agora são `string | number` em vez de sempre
    string. A coerção acontece na fronteira de cada operador — é isso que faz
    a precedência funcionar.
  - Erro de sintaxe (aspas não fechadas, parêntese aberto) agora estoura com a
    posição, em vez de devolver `0` ou vazio em silêncio.
  - Continua sem `eval`/`new Function`: um template pode vir de fonte não
    confiável, e o avaliador percorre a AST.
- **A paginação é decidida numa travessia só**
  (`src/pdf/layout/layoutDocument.ts`), substituindo as duas que existiam
  antes: o `generate.ts` decidia quebra de página *e* desenhava no mesmo laço,
  enquanto o `countBodyPages` percorria o corpo inteiro uma segunda vez só pra
  saber o total, porque `{pageCount}` precisa do número antes do primeiro
  traço. Só as decisões atômicas eram compartilhadas (`pagination.ts`); o
  avanço de cursor, o laço de fatiar tabela e a repetição de seção estavam
  escritos duas vezes, e uma mudança em só uma das cópias significaria "o
  dry-run disse 7 páginas, o desenho fez 8".
  - `layoutDocument(template, data, bindings, inputs)` devolve um
    `LayoutDocument`: páginas, cada uma com `Placement`s já posicionados e com
    valor já resolvido. A contagem de páginas é `pages.length` — não pode
    discordar do desenho porque É o desenho.
  - O `countBodyPages` deixou de existir. O `generate.ts` não tem mais nenhuma
    decisão de paginação; o `render/*` recebe valores resolvidos em vez de
    resolvê-los.
  - O cursor depois de uma tabela agora avança por
    `computeTableSlice().heightMm` em vez do Y que o `drawTableSlice` devolvia
    — o layout não precisa mais desenhar pra saber onde continuar.
  - A medição de seção foi pro `layout/sectionLayout.ts` e as métricas de
    tabela pro `pdf/tableMetrics.ts`, então o `layout/` não importa mais do
    `render/` e é de fato livre de pdf-lib.
  - Conferido contra o build da v2.0.0 em 11 templates (tabelas de 1/35/36/37/
    120/600 linhas, linha de totais, `repeatHeader: false`, fluxo
    texto-tabela-texto, seção mestre-detalhe, `Template.pages`): contagem de
    páginas idêntica em todos, e content streams byte-a-byte iguais exceto uma
    coordenada Y que difere em 1,4e-13 mm — ruído de ida e volta de float que o
    caminho novo tem um passo a menos.
- **Comparação solta agora renderiza `"true"`/`"false"`** — `{a > 1}` antes
  renderizava vazio, porque o motor antigo tratava a coisa inteira como path e
  não achava nada. É de propósito: a saída antiga era acidental, e uma
  comparação que avalia pra algo é a base de que o `visibleWhen` precisa.
  Comparação dentro de `{IF(...)}` se comporta exatamente como antes.

## 2.0.0 (2026-09-01)

Entrega o split do `pdfjs-dist` que estava em "Planejado" — mais a
segunda metade que aquela entrada não considerava: o fundo de página
vindo de PDF também passava pelo pdf.js, direto do `<Designer>`, então o
novo entry point sozinho não teria liberado o entry principal. Esse
recurso sai nesta release (fundo de página agora é só imagem), o que
deixa o preview como o único lugar em que o pdf.js é usado.

### Breaking

- **O `pdfjs-dist` não é mais instalado automaticamente** — saiu de
  `dependency` obrigatória pra **peer dependency opcional**
  (`peerDependenciesMeta["pdfjs-dist"].optional: true`), o mesmo
  tratamento que o `wawoff2` recebeu na 1.6.2. Só projetos que renderizam
  preview do PDF precisam dele; rode `npm install pdfjs-dist` no seu
  projeto se for o caso.
  - Por quê: o pdf.js tem ~35MB instalado, e como `dependency` do entry
    principal todo consumidor pagava por ele — inclusive apps que só
    renderizam o `<Designer>` e nunca dão preview em nada.
- **O `react-rnd` também não é mais instalado automaticamente** — mesma
  mudança, e é ela que de fato torna real o install de backend sem React.
  Ele era `dependency` normal, então descia em todo install, e como os peers
  `react`/`react-dom` *dele* **não** são opcionais, o npm instalava o stack
  React inteiro (`react`, `react-dom`, `react-draggable`, `re-resizable`,
  `scheduler`, `prop-types`, …: ~8,7MB) até num projeto que só importa
  `json-pdf-designer/server`. O `optional: true` que este pacote já tinha
  nos próprios peers react estava sendo derrotado um nível abaixo.
  - Se você usa o `<Designer>`, instale junto com o react:
    `npm install react react-dom react-rnd`. Só o `PageCanvas.tsx` usa
    (arrastar/redimensionar), e nada alcançável do `/server` usa.
  - Um install de backend hoje resolve `fontkit`, `pdf-lib` e
    `tiny-inflate` mais as árvores deles, e nada de React.
- **`PdfPreview`, `PdfPreviewModal` e `configurePdfWorker` foram pro novo
  entry point `json-pdf-designer/preview`.** Atualize o import:

  ```diff
  - import { PdfPreviewModal, configurePdfWorker } from "json-pdf-designer";
  + import { PdfPreviewModal, configurePdfWorker } from "json-pdf-designer/preview";
  ```

  Todo o resto — `<Designer>`, `generatePdf`, `downloadPdf`, os
  componentes de UI, os tipos — continua exatamente onde estava. Um
  `import()` lazy nos arquivos antigos não resolveria: re-exportados do
  grafo do entry principal, qualquer bundler resolvendo
  `"json-pdf-designer"` ainda precisava resolver o `pdfjs-dist` em tempo
  de build.
- **Fundo de página não pode mais ser um PDF — só imagem.** O upload de
  fundo aceita PNG/JPEG, e o botão passa a dizer "Imagem de fundo" em vez
  de "PDF/imagem de fundo". Rasterizar a 1ª página de um PDF enviado era a
  *outra* coisa que o pdf.js fazia neste pacote, e o
  `src/pdf/backgroundImage.ts` o importava direto enquanto o `<Designer>`
  importa *ele* — então o split de entry acima teria deixado o pdf.js no
  grafo do entry principal de qualquer jeito. Tirar o recurso é o que de
  fato libera o entry principal, e deixa renderizar o preview como o único
  uso de pdf.js no pacote inteiro.
  - Migração: se você usa um papel timbrado que só existe em PDF, exporte
    a página pra PNG uma vez e envie esse arquivo. Templates existentes
    não são afetados — `Template.backgroundImage` sempre foi um PNG data
    URI, então um fundo capturado de PDF antes desta release continua
    funcionando exatamente igual.
  - O `fileToBackgroundImage(file)` (interno) não trata mais
    `application/pdf`; o `src/pdf/rasterizePdfPage.ts` deixou de existir.

### Adicionado

- **`examples/no-preview`** — quarto app de exemplo: `<Designer>` +
  `generatePdf` + `downloadPdf`, direto pro download, sem tela de preview,
  e **sem `pdfjs-dist` em nenhum campo de dependência**. É o app que prova
  que o entry principal funciona sem o peer opcional, e ele builda na CI —
  então um import de pdf.js vazando de volta pro entry principal quebra o
  build do Pages.
- **`test/entryBoundaries.test.ts`** — percorre o grafo de código a partir
  de `src/index.ts`, `src/server.ts` e `src/preview.ts` e falha se o
  `pdfjs-dist` for alcançável a partir dos dois primeiros, ou se
  `react`/`react-dom`/`react-rnd` for alcançável a partir do `/server`.
  Dois casos de controle impedem que um walker quebrado faça os outros
  passarem por vacuidade. A checagem do tarball na CI também garante que o
  `pdfjs-dist` fica ausente do `node_modules` depois de instalar o pacote
  empacotado.

## 1.6.4 (2026-08-31)

Resposta a uma auditoria externa de código — conferi as afirmações
contra o código de verdade antes de agir em cima delas (ver o
plano/auditoria pra veredito completo; várias afirmações estavam
desatualizadas ou exageradas, ex: a divergência de versão npm/GitHub
reportada não existe mais, e a preocupação de segurança "sem eval/new
Function" já estava satisfeita). Esta versão cobre as partes que se
confirmaram reais e que valia a pena corrigir agora, mais algumas
features de acompanhamento e uma reorganização interna feitas na mesma
leva.

### Corrigido

- **`{SUM(a) - SUM(b)}` agora subtrai de verdade.** Antes, o regex de
  chamada de função casava gulosamente a expressão inteira como UMA
  chamada só (capturando `"a) - SUM(b"` como argumento), renderizando
  silenciosamente `"0"` em vez da diferença. Duas chamadas de função
  combinadas por operador no mesmo `{...}` agora caem corretamente pra
  aritmética em vez disso.

### Segurança

- **Limite de profundidade de recursão em `{FUNCAO(...)}` aninhadas** —
  antes sem limite nenhum; um template com milhares de parênteses
  aninhados (ex: `{CURRENCY(CURRENCY(CURRENCY(...)))}`) podia derrubar
  o processo com um estouro de call stack não tratado. Agora lança um
  erro claro e capturável além de ~40 níveis de aninhamento — bem mais
  do que qualquer template legítimo precisa.
- **Limites de tamanho/contagem de imagem** — `ImageSchema.content` e
  `Template.backgroundImage` agora respeitam um teto de 15MB
  decodificado por imagem e 200 imagens distintas por documento (os
  dois lançam erro claro em vez de aceitar qualquer coisa
  silenciosamente). O upload de fundo pelo navegador
  (`fileToBackgroundImage`) também rejeita arquivo maior que 20MB antes
  de tentar processar. Importa mais pra quem aceita template de fonte
  não confiável (multi-tenant).

### Adicionado

- **Suíte de testes golden/torture**
  (`test/pdf/generate.torture.test.ts` + `test/pdf/fixtures/`) — roda o
  pipeline `generatePdf` de verdade (não uma página falsa, um documento
  `pdf-lib` real) contra templates propositalmente extremos: tabela
  vazia, tabela de 600 linhas espalhada por muitas páginas físicas,
  seção maior que uma página inteira, dado vinculado ausente/null, e a
  fronteira real de codificação de texto (acentuação pt-BR funciona com
  a fonte padrão, emoji/CJK corretamente precisam de `fontBytes` —
  agora travado como teste explícito e intencional, não um crash
  sem documentação).
- **CI agora verifica o tarball publicado, não só o código-fonte** — um
  passo novo roda `npm pack`, instala o `.tgz` resultante num
  consumidor descartável, e chama `generatePdf` de
  `json-pdf-designer/server` de verdade. Pega regressão de
  `exports`/`files`/`.d.ts` que só aparece no que é publicado de fato
  (ver `test/pack-consumer/`).
- **Função de template `{IF(condição, "então", "senão")}`** —
  `condição` é uma comparação (`status == "paid"`, `total > 100`;
  operadores `==`, `!=`, `>`, `>=`, `<`, `<=`, sempre cercados de
  espaço, reaproveitando a mesma lógica de eq/gt/lt que os filtros de
  chart/KPI já usam) ou um path/expressão isolada checado como
  verdadeiro/falso (string vazia, `"0"` e `"false"` contam como falso).
  Só o lado escolhido é resolvido de verdade, então
  `{IF(temDesconto, valorDesconto, "0")}` não quebra mesmo quando
  `valorDesconto` não existe no dado no lado falso. Adicionada ao
  seletor de função do editor de vínculo e do editor de fórmula de
  coluna de tabela, junto de `SUM`/`CONCAT`/etc.
- **Inspetor de Template** — nova aba opcional/removível na barra
  lateral (mesmo padrão de mostrar/esconder/reordenar de "Dados"/
  "Estilo"/"Filtro"/"Página") mostrando uma árvore somente-leitura de
  todo campo da página atual, agrupada por zona (Header/Body/Footer/
  margens, reaproveitando `classifyZone`/`isRedZone` já existentes em
  `src/zones.ts` — sem lógica de classificação nova). Cada linha mostra
  tipo do campo, posição, seção-pai (se membro de seção), um resumo
  curto do vínculo, e o z-index (mesma ordem que enviar-pra-trás/trazer-
  pra-frente já usa). Clicar numa linha seleciona o campo no canvas,
  reaproveitando a seleção já existente — sem mecanismo de seleção
  paralelo.

### Alterado

- **`src/pdf/` reorganizado em `layout/` e `render/`** — refatoração
  interna pura, sem mudança de API pública. `generate.ts` agora é só um
  orquestrador fino; a matemática de paginação (`buildBodyItems`,
  `boundsOf`/`gapAfter`, `normalizePageDefs`, `countBodyPages`) foi pra
  `src/pdf/layout/`, e o desenho de verdade no `pdf-lib` (antes
  `drawTable.ts`/`drawSection.ts`/`drawChart.ts`/`drawKpi.ts`, mais dois
  arquivos novos separados de `generate.ts` pra texto/imagem) foi pra
  `src/pdf/render/` como `renderTable.ts`/`renderSection.ts`/
  `renderChart.ts`/`renderKpi.ts`/`renderText.ts`/`renderImage.ts`,
  despachados por `render/index.ts`. Verificado como movimentação pura:
  mesma contagem de testes passando antes e depois, e o tamanho do
  bundle final ficou inalterado. Só importa pra quem importava um desses
  arquivos internos direto (não fazem parte dos entry points públicos do
  pacote) — atualize o caminho do import se for o caso.

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
