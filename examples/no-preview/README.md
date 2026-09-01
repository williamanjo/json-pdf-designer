# no-preview-example

Gera o PDF e baixa direto — sem tela de preview e, o ponto do example,
**sem o `pdfjs-dist` instalado**.

```bash
npm install
npm run dev   # http://localhost:5176
```

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

## O que funciona

Tudo. O `<Designer>` inteiro (arrastar, redimensionar, painel de
propriedades, vínculo com JSON, imagem de fundo) e a geração do PDF
(texto, tabela, chart, KPI, seção, paginação, fontes) não dependem de
pdf.js — nenhum recurso do pacote fica de fora por não instalar o
`pdfjs-dist`.

A única coisa que o `pdfjs-dist` habilita é **ver o PDF na tela antes de
baixar**. Pra isso, instale e use o `<PdfPreviewModal>` do entry
`/preview` — ver o example `report-builder`.
