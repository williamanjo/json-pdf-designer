# Gerador de Relatórios

App para montar relatórios em PDF **arrastando campos da resposta de uma
query/API** para dentro de um designer visual, e depois gerar o PDF
preenchido com dados reais. O designer em si (canvas, campos, seções,
tabelas, vínculo com o JSON, geração do PDF) é a lib
[`json-pdf-designer`](../..) — este app é a casca em volta dela: fonte de
dados, explorador de campos e os botões de gerar/salvar/carregar,
montados com os **componentes de UI prontos do próprio pacote**
(`Button`/`Card`/`Input` do entry principal, mais o `PdfPreviewModal` de
`json-pdf-designer/preview` — ver a [documentação da lib](../../docs/USAGE.md)).

Este exemplo é também o que exercita a **API pública inteira** do pacote, não
só o `<Designer>` e o `generatePdf`: a localização de erro
(`describePdfError`, sobre as classes exportadas — `PageLimitError`,
`UnsupportedGlyphError`, `ExpressionError`), a validação de
expressões (`expressionErrors`, `fieldWarning`, `dictFor`), o versionamento de
formato (`CURRENT_TEMPLATE_VERSION`, `migrateTemplate`) e o teto de páginas
(`DEFAULT_MAX_PAGES`). As duas seções abaixo — "Painel de problemas" e "Quando
a geração falha" — descrevem o que cada uma faz aqui. Existe
um segundo exemplo, [`../custom-ui`](../custom-ui), que faz a mesma coisa
só que com CSS 100% próprio, sem usar nenhum desses componentes — pra
comparar as duas abordagens.

## Estilo: o tema como vem

Este example importa `json-pdf-designer/theme.css` e **não customiza nada** —
é o ponto "baterias incluídas" do espectro, e serve de referência: se o editor
aqui parece diferente do que a doc mostra, o tema regrediu.

| Example | CSS do pacote | Estratégia |
|---|---|---|
| **report-builder** (este) | `theme.css` | tema como vem, zero customização |
| [composed-layout](../composed-layout) | `theme.css` | retema **só por token** (`--jpd-*`) |
| [no-preview](../no-preview) | `theme.css` | **dark mode**, com toggle |
| [headless-designer](../headless-designer) | `reset.css` | só o reset, aparência à mão |
| [custom-ui](../custom-ui) | *nenhum* | `.jpd-*` do zero (~190 classes) |

A casca deste app (header, painel de JSON, page tabs) tem Tailwind próprio —
o que é normal, e independente: o Tailwind saiu do PACOTE na 3.0.0, não dos
apps que o usam. Guardado por `test/docsFreshness.test.ts`.

## Montado com as peças, não com o preset

Na 3.0.0 este app deixou de renderizar `<Designer>` e passou a montar o
editor com as peças, em
[`src/components/DesignerPanel.tsx`](src/components/DesignerPanel.tsx):

```tsx
<I18nProvider locale={locale}>
  <DesignerProvider template={…} onChangeTemplate={…} bindings={…} onChangeBindings={…} …>
    <SelectedFieldBar />
    <DesignerCanvas className="min-w-0 flex-1" />
    <DesignerSidebar className="w-80 flex-shrink-0" />
  </DesignerProvider>
</I18nProvider>
```

**O layout ficou idêntico ao do preset, de propósito** — as mesmas duas
colunas, canvas e sidebar com abas, na mesma largura. Quem quiser ver um
layout que o preset não sabe fazer, é o
[`composed-layout`](../composed-layout); aqui a migração não foi por
causa do layout.

Ela foi por causa de UMA coisa: içar o `<DesignerProvider>` acima da
casca deste app, pra que a
[`<SelectedFieldBar>`](src/components/SelectedFieldBar.tsx) — que é
desenhada por este app, com Tailwind próprio, e não pelo editor — possa
**ler a seleção do editor** por hook:

```tsx
const { selected } = useDesignerSelectedSchema();
const { removeSchema, bringToFront, sendToBack } = useDesignerActions();
```

Isso era impossível na 2.x: o `<Designer>` era dono da seleção e não
havia prop pra consultá-la nem pra dirigi-la de fora. Vale nas duas
direções, e é o detalhe que importa: o `removeSchema` da barra é o
mutador do pacote, que passa pelo `setState` **deste app** — então o
`Ctrl+Z` daqui desfaz uma remoção feita pela barra, sem nenhuma
integração extra. O `useDesignerActions()` nunca troca de identidade, de
propósito, pra uma peça memoizada poder consumir mutador sem
re-renderizar a cada edição do template.

Um detalhe de montagem: o `<I18nProvider>` aparece explícito porque
`locale` era prop do preset. Montando na mão, o idioma é
responsabilidade de quem monta.

## O seletor de idioma troca as DUAS camadas

O `<select>` do header alimenta **um** `useState<Locale>` — e esse valor
único vai pros dois dicionários: o do pacote (via `<I18nProvider>`) e o
da casca deste app, em [`src/i18n.ts`](src/i18n.ts). Um clique, duas
camadas, zero sincronização manual:

```tsx
const [locale, setLocale] = useState<Locale>("en");
const tx = t(locale);                    // dicionário DESTE app
// …
<I18nProvider locale={locale}>…</I18nProvider>   // dicionário do PACOTE
```

O dicionário próprio é `{ pt, en: typeof pt }` — chave faltando **não
compila**, e o tipo `Locale` vem do pacote, então um idioma novo no
pacote quebra o build deste example até alguém traduzir. Mensagem com
número ou nome é função na entrada do dicionário
(`problemsEmpty: (n) => …`), nunca concatenação no JSX.

Três regras que o código segue, e que valem copiar:

- **O que é do pacote sai do pacote.** O tipo do campo na
  [`<SelectedFieldBar>`](src/components/SelectedFieldBar.tsx) vem de
  `useT().fieldTypeLabels` (ela vive dentro do `<I18nProvider>`, então
  também lê o idioma por `useLocale()` em vez de receber prop); a
  mensagem de expressão/vínculo do painel de problemas vem de
  `dictFor(locale)` em [`templateProblems.ts`](src/lib/templateProblems.ts);
  o nome da aba "Página" citado numa mensagem de erro vem de
  `dictFor(locale).tabBar.page`. Nada disso é duplicado aqui.
- **DADO não traduz.** Conteúdo dos templates prontos e do JSON de
  amostra, nome de campo (`tabela_vendas`), path (`rows.total`), nome de
  fonte (`principal`), rótulo dos exemplos do dropdown ("Lei Kandir") e
  o texto que sai no PDF ficam como estão. O idioma da interface não é o
  idioma do documento — trocar pra inglês não traduz o relatório de
  ninguém. `Português`/`English` no seletor também ficam cada um no
  próprio idioma.
- **Não guarde texto traduzido no estado.** O estado guarda o *motivo*
  (`"invalidJson"`, o erro cru de `generatePdf`), e a frase é escolhida
  no render — senão a mensagem que já está na tela fica congelada no
  idioma em que foi gerada e não troca com o seletor.

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço que o Vite mostrar (ex: http://localhost:5173).

## Como usar

1. **Cole um exemplo da resposta da sua query** na caixa "Fontes de dados
   (JSON)" à esquerda — dá pra colar mais de uma fonte, cada uma vira um
   objeto próprio, juntados na hora de gerar. Serve só pra descobrir os
   campos disponíveis, pode ser um exemplo pequeno.
2. O painel **"Campos do JSON"** lista tudo que foi encontrado (clique em
   "Resync campos" depois de colar/editar um JSON grande). Arraste um
   campo simples pro canvas pra criar um texto já vinculado; um array de
   objetos vira uma tabela, com seletor de colunas antes de soltar.
3. Ajuste posição, tamanho, cores e vínculo no designer — tudo isso é o
   editor do `json-pdf-designer` (arrastar, redimensionar, seções
   repetidas, tabela com totais, etc — ver a [documentação dessa lib](../../docs/USAGE.md) pra lista
   completa do que dá pra fazer).
4. Quando o layout estiver pronto, cole a **resposta real** da sua API nas
   fontes de dados e clique em **"Gerar PDF"** — abre uma prévia (pdf.js)
   antes de baixar.
5. Use **"Salvar projeto"** pra exportar template + vínculos num JSON, e
   **"Carregar projeto"** pra continuar depois (arquivo validado antes de
   aplicar — projeto malformado mostra erro em vez de quebrar o editor).
   O trabalho também fica **salvo automaticamente no navegador**
   (localStorage, debounced) — um F5 sem querer não perde o que tava
   sendo editado.
6. **Ctrl/Cmd+Z** desfaz, **Ctrl/Cmd+Shift+Z** (ou **Ctrl/Cmd+Y**) refaz —
   template e vínculos mudam juntos num histórico só, então uma ação que
   afeta os dois (ex: vincular uma tabela) desfaz de uma vez, sem
   desalinhar. **Ctrl/Cmd+C**/**Ctrl/Cmd+V** copia/cola campo(s)
   selecionado(s) (do próprio editor, ver a [documentação da lib](../../docs/USAGE.md)).

## Painel de problemas

O painel **"Problemas do template"**, à esquerda, é o outro lado de uma decisão
de projeto do pacote: uma expressão com erro de sintaxe **não derruba a
geração**, ela resolve para vazio (uma vírgula esquecida não pode custar um
relatório de 200 páginas). O preço é que o campo sai em branco sem explicação
nenhuma no PDF. Este painel é onde a explicação aparece — antes de gerar.

Ele é montado com dois exports do pacote, em [`src/lib/templateProblems.ts`](src/lib/templateProblems.ts):

- `expressionErrors(schema, binding)` — erros de sintaxe em `content`,
  `visibleWhen`, fórmulas de coluna e rodapé, com a posição do caractere.
  Vermelho: **esse campo vai sair vazio**.
- `fieldWarning(schema, binding, dictFor(locale))` — configuração incompleta
  (tabela sem vínculo, seção sem array, coluna sem caminho). Âmbar: o campo
  renderiza, mas provavelmente não com o que se esperava. É o mesmo aviso que
  o `<Designer>` mostra no campo; `dictFor` existe para poder pedir o
  dicionário do idioma fora de um componente React.

Clicar num problema navega até a página onde o campo está.

## Quando a geração falha

Falha de geração **não** vira `err.message` cru na tela — a mensagem lançada
pelo pacote é inglês fixo, diagnóstico de desenvolvedor. Quem traduz é o
próprio pacote: `describePdfError(err, dictFor(locale))` devolve
`{ code, blame, title, action?, field?, detail }` já no idioma da UI, ou `null`
se o erro não é dele. [`src/lib/generationError.ts`](src/lib/generationError.ts)
é só a borda: chama `describePdfError` e trata o `null`.

`blame` (`data` | `template` | `config` | `package`) vem do pacote e é o que
muda o tom do banner — a mesma decisão que um backend toma para escolher entre
413, 400 e 500. `code` é string literal, então dá para abrir ramo próprio com
`switch` e o TypeScript cobra exaustividade.

| Onde | Quem classifica | Exemplo |
| --- | --- | --- |
| falha do pacote | `describePdfError` (18 códigos + `expression`) | `pageLimit`, `unsupportedGlyph`, `invalidPageSize`, `unsupportedImageFormat` |
| ramo próprio deste app | `switch (problem.code)` | `expression` — a ação aponta para o **painel de problemas**, que o pacote não sabe que existe |
| erro nosso | classe própria | `FontLoadError` ([`src/lib/font.ts`](src/lib/font.ts)) — o asset de fonte é deste example |
| resto | genérico honesto | arquivo de projeto inválido, falha de leitura, erro de fora do pacote |

Nada disso casa texto de mensagem. Uma versão anterior deste arquivo
classificava com regex na frase em português (`/tamanho inválido/`); quando a
mensagem do pacote virou inglês, as regexes pararam de casar e **toda** falha
caiu no ramo "erro inesperado" em silêncio. É o motivo pelo qual `code` existe.

O `generatePdf` deste app passa `maxPages: DEFAULT_MAX_PAGES` explicitamente,
para deixar claro que o teto existe e que estourá-lo dá erro em vez de um PDF
truncado que parece completo. O cabeçalho mostra `formato v{CURRENT_TEMPLATE_VERSION}`
e o teto em vigor. Para ver o banner funcionando, baixe `maxPages` para `1` no
`handleGenerate` e gere o exemplo "Painel de Vendas".

Uma ressalva: `UnsupportedGlyphError` só dispara com a fonte **padrão**. Este
app carrega uma fonte customizada via `fontBytes` (para acentuação completa), e
nesse caso um caractere que a fonte não cobre é desenhado como `.notdef` — um
branco — **sem erro**. Ver [modos de falha](../../docs/USAGE.pt-BR.md).

## Exemplos prontos

O dropdown **"Carregar exemplo…"** no topo troca template + fonte de dados
por um caso pronto, cobrindo os principais recursos do designer:

- **Lei Kandir** — texto com fundo/borda, tabela com linha de totais e
  cabeçalho colorido (documento real, "Demonstrativo de Retenções").
- **Recibo Simples** — só texto, sem tabela nem seção.
- **Pedidos com Itens** — seção repetida (data band) com uma tabela
  ANINHADA de verdade dentro (mestre-detalhe: um pedido, N itens). Também
  demonstra **`visibleWhen`**: a linha de total geral tem
  `visibleWhen: "COUNT(pedidos) > 0"` e, no mesmo `y`, um aviso "nenhum pedido
  no período" com a condição oposta (`"NOT COUNT(pedidos) > 0"`) — esvazie o
  array `pedidos` na fonte de dados e gere de novo para ver a troca.
- **Boletim de Turma** — seção repetida só com texto (sem tabela nenhuma).
- **Relatório Financeiro** — duas tabelas soltas empilhadas (sem seção),
  cada uma com sua própria linha de totais. Tem um alerta de déficit com
  `visibleWhen` composto (`"... > ... AND COUNT(despesas) > 0"`), o caso que
  precisou da AST de expressões para funcionar.
- **Painel de Vendas** — 6 cartões de indicador (KPI) em grade e dois
  gráficos de pizza lado a lado sobre o mesmo array (um por valor, outro
  por quantidade).

## Formato esperado do JSON

O app lida com qualquer JSON, mas o caso mais comum é:

```json
{
  "rows": [
    { "count": "2015", "status": "ERRO" },
    { "count": "98014", "status": "INSERIDA" }
  ],
  "pagination": { "page": 1, "totalRows": 3 }
}
```

- `rows` (array de objetos) vira **uma tabela**, cujas colunas são as
  chaves de cada objeto — ou uma **seção repetida** (uma repetição por
  item), se você criar a seção vinculada a esse array em vez de uma
  tabela solta.
- Qualquer outro valor simples (`pagination.totalRows`, por exemplo) vira
  um **campo de texto**.
- Não importa se a resposta é paginada ou não — o app só usa o que existir.

## Estrutura do código

```
src/
  data/
    initialTemplate.ts -> template/binding/sample do estado inicial do app (não é um exemplo do dropdown)
    templates/         -> um arquivo por exemplo do dropdown (kandir.ts, recibo.ts...) — template +
                          binding + sample + label, tudo junto; index.ts monta o mapa EXAMPLES
    samples/           -> só os JSON de amostra (um por template, incluindo o do initialTemplate)
  lib/
    jsonExplorer.ts    -> varre o JSON de exemplo e monta a lista de campos
    font.ts            -> carrega a fonte customizada (acentuação completa)
    uid.ts             -> id único (schema/fonte nova) — compartilhado com components/
    sources.ts         -> junta N fontes JSON num objeto só antes de gerar/explorar campos
    pages.ts           -> `ensurePages`: garante Template.pages presente e não-vazio (autosave
                          ou exemplo salvo antes das abas de página existirem)
    projectFile.ts     -> exporta/valida o JSON de "Salvar/Carregar projeto"
    templateProblems.ts-> varre o template com expressionErrors/fieldWarning do pacote
    generationError.ts -> traduz erro de geração por instanceof na classe exportada
  i18n.ts              -> dicionário da CASCA (pt/en), alimentado pelo mesmo `locale` do editor
  hooks/
    useUndoRedo.ts     -> histórico de template+bindings (Ctrl+Z/Shift+Z/Y)
    useAutosave.ts     -> localStorage debounced + leitura do autosave anterior
  components/
    FieldTree.tsx      -> árvore de campos arrastável + seletor de colunas
    DesignerPanel.tsx  -> monta o editor com as peças (<DesignerProvider> + canvas + sidebar)
    SelectedFieldBar.tsx -> barra do campo selecionado, lendo o editor pelos hooks públicos
    PageTabs.tsx       -> abas de página (uma TemplatePage por aba, no mesmo Template)
    DataSourcePanel.tsx-> textarea(s) de fonte de dados (múltiplas, com nome)
    ProblemsPanel.tsx  -> lista os problemas do template (vermelho = renderiza vazio)
    GenerationErrorBanner.tsx -> banner de falha de geração, com "ver detalhe"
  App.tsx              -> estado + junta tudo acima — fontes, campos, botões de
                           gerar/salvar/carregar (a lógica de cada peça mora nos módulos acima)
```

`Button`/`Card`/`CardTitle`/ícones vêm **direto do pacote**
(`import { ... } from "json-pdf-designer"`) e o `PdfPreviewModal` vem do
entry separado `json-pdf-designer/**preview**` — ele depende do `pdfjs-dist`,
que é peer OPCIONAL, e por isso não sai do entry principal (é o que o
[no-preview](../no-preview) existe pra provar).

Não há cópia local de componente de UI nenhum — ver a
[documentação da lib](../../docs/USAGE.md).

## Pontos de atenção / próximos passos possíveis

- Campo novo (botão "+ texto/tabela/imagem/seção") sempre nasce **centrado**
  na página — não empilha em cima do último criado; depois é só arrastar
  dentro do canvas pra reposicionar.
- Pra gerar o PDF no servidor (Node) em vez do navegador, `generatePdf` do
  `json-pdf-designer` roda em Node ou browser sem mudança nenhuma (pdf-lib é
  JS puro) — só a leitura de arquivo (fonte customizada, imagem de fundo)
  muda de fonte.
