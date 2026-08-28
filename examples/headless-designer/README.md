# headless-designer-example

Prova que dá pra montar o **próprio editor** sem usar o componente
`<Designer>` do pacote — inclusive o próprio **canvas de arrastar/
redimensionar**, feito à mão (`mousedown`/`mousemove`/`mouseup` puro,
sem `react-rnd`), mais um painel lateral pro conteúdo do campo
selecionado e um botão "Generate PDF".

Ao lado de [`report-builder`](../report-builder) (usa `<Designer>` + kit
de UI pronto) e [`custom-ui`](../custom-ui) (usa `<Designer>` + casca
própria), este é o terceiro ponto do espectro: **nem o `<Designer>`
entra** — só as peças de baixo nível do pacote.

## Como rodar

```bash
npm install
npm run dev
```

Abre em `http://localhost:5175` (porta fixa em `vite.config.ts` — as
outras duas usam 5173/5174, pra rodar as três ao mesmo tempo sem
conflito).

## O que vem do pacote

| Import | De onde | Por quê |
| --- | --- | --- |
| `generatePdf`, `Schema`/`TextSchema`/`TableSchema`/`Template` | `json-pdf-designer/server` | Motor de PDF (pdf-lib) + tipos — build **sem React nenhum**, prova que o `generatePdf` funciona igual num backend Node. |
| `PdfPreview` | `json-pdf-designer` (entry principal) | Único componente React usado — mostra o PDF gerado de verdade (pdf.js), num `<canvas>`. |
| `json-pdf-designer/style.css` | — | Só estiliza o texto de erro/contagem de página do `<PdfPreview>` — o resto da casca é CSS puro (`src/index.css`). |

Tudo mais (o canvas de arrastar/redimensionar, a lista de campos, o
painel de conteúdo, o textarea de dados JSON, o botão de gerar) é
código deste app, do zero — sem nenhum `Button`/`Card`/`Input`
importado do pacote, e sem `react-rnd` nem qualquer lib de drag/resize
de terceiro.

## O que tem

- Adicionar campo de **texto** ou **tabela** (botões "+ Text field" /
  "+ Table field").
- **Canvas de verdade**: arrastar um campo move ele (x/y), a alcinha no
  canto inferior direito redimensiona (largura/altura) — tudo em mm,
  convertido pra px só na tela (`PX_PER_MM` em `App.tsx`).
- Clicar num campo (no canvas ou na lista lateral) seleciona ele — o
  painel "Selected field" mostra posição/tamanho (só leitura, editável
  arrastando) e o conteúdo (editável digitando).
- Texto: conteúdo livre, aceita `{path}`/`{FUNÇÃO(...)}` igual o resto
  do pacote (ver `renderTemplate` em `docs/USAGE.md` da raiz).
- Tabela: colunas do cabeçalho (separadas por vírgula) e linhas (uma por
  linha do textarea, células separadas por vírgula) — simplificado de
  propósito, sem editor de vínculo (`Binding`).
- Um textarea com o JSON de dados (sem fontes múltiplas, sem
  explorador de campos — cola o JSON direto).
- "Generate PDF" chama `generatePdf(template, data, [])`, muda pra aba
  "Preview" e mostra o resultado com `<PdfPreview>`; "Download PDF"
  baixa o arquivo.

## O que NÃO tem (de propósito)

Isto é uma prova de conceito, não um editor completo — sem editor de
vínculo (`Binding`), sem seção/gráfico/KPI, sem undo/redo, sem
salvar/carregar projeto, sem múltiplas fontes de dados. Quem quiser
essas features de volta, o caminho é usar `<Designer>` mesmo
(`report-builder`/`custom-ui`).
