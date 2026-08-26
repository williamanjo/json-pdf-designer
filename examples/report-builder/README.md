# Gerador de Relatórios

App para montar relatórios em PDF **arrastando campos da resposta de uma
query/API** para dentro de um designer visual, e depois gerar o PDF
preenchido com dados reais. O designer em si (canvas, campos, seções,
tabelas, vínculo com o JSON, geração do PDF) é a lib
[`json-pdf-designer`](../..) — este app é a casca em volta dela: fonte de
dados, explorador de campos e os botões de gerar/salvar/carregar,
montados com os **componentes de UI prontos do próprio pacote**
(`Button`/`Card`/`Input`/`PdfPreviewModal` — ver a [documentação da lib](../../docs/USAGE.md)). Existe
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

## Exemplos prontos

O dropdown **"Carregar exemplo…"** no topo troca template + fonte de dados
por um caso pronto, cobrindo os principais recursos do designer:

- **Lei Kandir** — texto com fundo/borda, tabela com linha de totais e
  cabeçalho colorido (documento real, "Demonstrativo de Retenções").
- **Recibo Simples** — só texto, sem tabela nem seção.
- **Pedidos com Itens** — seção repetida (data band) com uma tabela
  ANINHADA de verdade dentro (mestre-detalhe: um pedido, N itens).
- **Boletim de Turma** — seção repetida só com texto (sem tabela nenhuma).
- **Relatório Financeiro** — duas tabelas soltas empilhadas (sem seção),
  cada uma com sua própria linha de totais.
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
  hooks/
    useUndoRedo.ts     -> histórico de template+bindings (Ctrl+Z/Shift+Z/Y)
    useAutosave.ts     -> localStorage debounced + leitura do autosave anterior
  components/
    FieldExplorer.tsx  -> painel arrastável + seletor de colunas
    DesignerPanel.tsx  -> embrulha o <Designer> do json-pdf-designer
    DataSourcePanel.tsx-> textarea(s) de fonte de dados (múltiplas, com nome)
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
