[English](CHANGELOG.md) | **Português**

# Changelog

Todas as mudanças relevantes deste pacote ficam documentadas aqui.
Formato inspirado, sem seguir à risca, em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

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
