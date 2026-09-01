# Gerador de Relatórios

App para montar relatórios em PDF **arrastando campos da resposta de uma
query/API** para dentro de um designer visual, e depois gerar o PDF
preenchido com dados reais. O designer em si (canvas, campos, seções,
tabelas, vínculo com o JSON, geração do PDF) é a lib
[`json-pdf-designer`](../..) — este app é a casca em volta dela: fonte de
dados, explorador de campos e os botões de gerar/salvar/carregar,
montados com os **componentes de UI prontos do próprio pacote**
(`Button`/`Card`/`Input`/`PdfPreviewModal` — ver a [documentação da lib](../../docs/USAGE.md)).

Este exemplo é também o que exercita a **API pública inteira** do pacote, não
só o `<Designer>` e o `generatePdf`: as classes de erro exportadas
(`PageLimitError`, `UnsupportedGlyphError`, `ExpressionError`), a validação de
expressões (`expressionErrors`, `fieldWarning`, `dictFor`), o versionamento de
formato (`CURRENT_TEMPLATE_VERSION`, `migrateTemplate`) e o teto de páginas
(`DEFAULT_MAX_PAGES`). As duas seções abaixo — "Painel de problemas" e "Quando
a geração falha" — descrevem o que cada uma faz aqui. Existe
um segundo exemplo, [`../custom-ui`](../custom-ui), que faz a mesma coisa
só que com CSS 100% próprio, sem usar nenhum desses componentes — pra
comparar as duas abordagens.

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
   `<Designer>` do `json-pdf-designer` (arrastar, redimensionar, seções
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
   selecionado(s) (do próprio `<Designer>`, ver a [documentação da lib](../../docs/USAGE.md)).

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

Falha de geração **não** vira `err.message` cru na tela. O pacote exporta os
erros como classes justamente para que quem chama possa decidir o texto, e
[`src/lib/generationError.ts`](src/lib/generationError.ts) faz essa tradução com
`instanceof`, devolvendo título + o que fazer + de quem é a culpa (dado,
template, configuração ou bug do pacote). É a mesma decisão que um backend toma
para escolher entre 413, 400 e 500:

| Classe | Culpa | Mensagem |
| --- | --- | --- |
| `PageLimitError` | dado | "O relatório passou de N páginas" — filtre o período ou aumente `maxPages` |
| `UnsupportedGlyphError` | dado | o caractere não existe na fonte; qual campo e qual caractere |
| `ExpressionError` | template | erro de sintaxe que escapou do painel de problemas |

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
    projectFile.ts     -> exporta/valida o JSON de "Salvar/Carregar projeto"
    templateProblems.ts-> varre o template com expressionErrors/fieldWarning do pacote
    generationError.ts -> traduz erro de geração por instanceof na classe exportada
  hooks/
    useUndoRedo.ts     -> histórico de template+bindings (Ctrl+Z/Shift+Z/Y)
    useAutosave.ts     -> localStorage debounced + leitura do autosave anterior
  components/
    FieldExplorer.tsx  -> painel arrastável + seletor de colunas
    DesignerPanel.tsx  -> embrulha o <Designer> do json-pdf-designer
    DataSourcePanel.tsx-> textarea(s) de fonte de dados (múltiplas, com nome)
    ProblemsPanel.tsx  -> lista os problemas do template (vermelho = renderiza vazio)
    GenerationErrorBanner.tsx -> banner de falha de geração, com "ver detalhe"
  App.tsx              -> estado + junta tudo acima — fontes, campos, botões de
                           gerar/salvar/carregar (a lógica de cada peça mora nos módulos acima)
```

`Button`/`Card`/`CardTitle`/ícones/`PdfPreviewModal` usados por este app
vêm **direto do pacote** (`import { ... } from "json-pdf-designer"`) —
não tem cópia local de nenhum componente de UI (ver a [documentação da lib](../../docs/USAGE.md)).

## Pontos de atenção / próximos passos possíveis

- Campo novo (botão "+ texto/tabela/imagem/seção") sempre nasce **centrado**
  na página — não empilha em cima do último criado; depois é só arrastar
  dentro do canvas pra reposicionar.
- Pra gerar o PDF no servidor (Node) em vez do navegador, `generatePdf` do
  `json-pdf-designer` roda em Node ou browser sem mudança nenhuma (pdf-lib é
  JS puro) — só a leitura de arquivo (fonte customizada, imagem de fundo)
  muda de fonte.
