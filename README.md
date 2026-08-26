# json-pdf-designer

Editor visual de relatórios em PDF para React — canvas de arrastar/
redimensionar campos, vínculo de campos a um JSON de dados, seção repetida
(data band/mestre-detalhe, tipo Stimulsoft), gráficos, cartões de
indicador (KPI), paginação de verdade, cabeçalho/rodapé repetidos e fundo
tipo letterhead. Um componente React só seu: sem plugin system, sem
propPanel declarativo, sem dependência de UI de terceiros — mudar
qualquer coisa é editar o arquivo.

A geração do PDF (`generatePdf`) é **JS puro** ([pdf-lib](https://github.com/Hopding/pdf-lib))
— o mesmo template desenhado no navegador pode ser gerado tanto no
cliente quanto num backend Node, sem headless browser.

## Por que este pacote

- **Você é dono do código.** Sem sistema de plugins, sem schema
  declarativo de propriedades — o componente `<Designer>` e o resto do
  código-fonte ficam dentro do seu `node_modules`, prontos pra ler e
  editar se precisar de algo que o pacote não previu.
- **Um template = um JSON.** `Template` + `Binding[]` são objetos planos
  serializáveis — salva no banco, versiona, manda por API, sem nenhuma
  classe ou função escondida no meio.
- **Mesma função gera no navegador e no servidor.** `generatePdf` não usa
  DOM nem `canvas` do navegador — só `pdf-lib`/`fontkit`. Dá pra desenhar
  o template numa tela com `<Designer>` e gerar o PDF de verdade num
  backend Node a partir do JSON salvo (ver [Uso em backend](#uso-em-backend-sem-ui) abaixo).

## Campos suportados

| Campo | O que faz |
| --- | --- |
| **Texto** | conteúdo livre com `{token}`/`{FUNÇÃO(...)}`, fonte/cor/alinhamento |
| **Tabela** | colunas a partir de um array, com coluna calculada e rodapé (SUM/COUNT/AVG) |
| **Imagem** | upload direto no canvas, redimensiona junto |
| **Seção** | data band repetido — mestre-detalhe, agrupa outros campos e paginação junto com o corpo |
| **Gráfico** | pizza/rosca ou barra, com legenda configurável (direita/esquerda/topo/base/nas fatias), ordenação e modo de exibição (número/percentual/ambos) |
| **Indicador (KPI)** | cartão colorido com ícone ([Google Material Symbols](https://fonts.google.com/icons), com busca), título, valor e legenda |

Tudo arrasta/redimensiona livre (via [react-rnd](https://github.com/bokuweb/react-rnd)), com grade de 5mm (estilo Stimulsoft) que trava
posição/tamanho por padrão — segura **Shift** durante o arrasto pra soltar
da grade. Seleção múltipla (Ctrl/Cmd+clique ou caixa de seleção),
copiar/colar, atalhos de teclado, tamanho/orientação de página
configuráveis. Detalhe completo de cada recurso em [docs/USAGE.md](docs/USAGE.md).

## Instalação

```bash
npm install json-pdf-designer
```

Peer deps: `react` e `react-dom` (18 ou 19). Importe o CSS do pacote uma
vez, no entrypoint do seu app:

```ts
import "json-pdf-designer/style.css";
```

## Uso básico

```tsx
import { useState } from "react";
import { Designer, generatePdf, downloadPdf, type Template, type Binding } from "json-pdf-designer";
import "json-pdf-designer/style.css";

const initialTemplate: Template = {
  page: { width: 210, height: 297 }, // A4 em mm
  schemas: [],
};

function Report() {
  const [template, setTemplate] = useState<Template>(initialTemplate);
  const [bindings, setBindings] = useState<Binding[]>([]);

  async function handleGenerate() {
    const data = await fetchMyData(); // o JSON real que popula os campos
    const pdfBytes = await generatePdf(template, data, bindings);
    downloadPdf(pdfBytes, "relatorio.pdf");
  }

  return (
    <>
      <Designer
        template={template}
        onChangeTemplate={setTemplate}
        bindings={bindings}
        onChangeBindings={setBindings}
      />
      <button onClick={handleGenerate}>Gerar PDF</button>
    </>
  );
}
```

Guia completo (vínculo de dados, funções de template, seção repetida,
gráfico, KPI, fontes customizadas, API pública inteira) em
**[docs/USAGE.md](docs/USAGE.md)**.

## Uso em backend (sem UI)

Como `generatePdf` é JS puro, dá pra separar o sistema em duas partes:
um **frontend** com o `<Designer>` (onde o template é desenhado e salvo
como JSON) e um **backend/API** que recebe um id de template + dados
reais, busca o template salvo, chama `generatePdf` direto em Node e
manda o PDF por e-mail — sem precisar de headless browser nem duplicar a
lógica de desenho.

```ts
// backend Node — nenhuma dependência de React/DOM
import { generatePdf } from "json-pdf-designer";

const template = await db.reportTemplates.findById(templateId); // { template, bindings }
const pdfBytes = await generatePdf(template.template, data, template.bindings);
// pdfBytes: Uint8Array — anexa em e-mail, salva em disco/S3, retorna na resposta...
```

Só `downloadPdf`, `Designer`, `PdfPreview*` e os componentes de UI são
browser-only (usam `document`/DOM) — todo o resto do pacote (`generatePdf`,
os tipos `Template`/`Binding`/`Schema`, e os helpers de `bindings/`) é
seguro de importar em Node.

Passo a passo completo — modelo de dados a persistir, endpoints
sugeridos, exemplo com fonte customizada carregada do disco e
considerações de segurança — em **[docs/BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md)**.

## Exemplos

- **[examples/report-builder](examples/report-builder)** — designer completo
  (fontes de dados JSON, explorador de campos, 6 templates prontos).
- **[examples/custom-ui](examples/custom-ui)** — versão enxuta com casca
  própria em CSS puro, sem os componentes de UI do pacote.

## Documentação

- **[docs/USAGE.md](docs/USAGE.md)** — instalação, uso, todos os recursos do
  `<Designer>` e API pública completa.
- **[docs/BACKEND_INTEGRATION.md](docs/BACKEND_INTEGRATION.md)** — como
  separar frontend (Designer) de backend (geração + envio por e-mail).
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — decisões de arquitetura
  internas do pacote.
- **[docs/SCOPE.md](docs/SCOPE.md)** — o que o pacote se propõe (e não se
  propõe) a fazer.
- **[docs/ROADMAP.md](docs/ROADMAP.md)** — o que já foi feito e o que ainda
  está planejado.

## Stack

React + TypeScript, [pdf-lib](https://github.com/Hopding/pdf-lib) +
[fontkit](https://github.com/foliojs/fontkit) pra geração do PDF,
[react-rnd](https://github.com/bokuweb/react-rnd) pra arrastar/
redimensionar, [pdf.js](https://github.com/mozilla/pdf.js) pro preview,
Tailwind CSS pro visual do próprio editor. Zero dependência de UI de
terceiros (Material UI, Ant Design etc.) — os componentes visuais do
`<Designer>` são próprios e exportados junto, caso queiram ser
reaproveitados.

## Licença

[MIT](LICENSE)

## Contribuidores

| | Nome | Papel |
| --- | --- | --- |
| <img src="https://avatars.githubusercontent.com/u/69880957?v=4" width="40" height="40"> | [@williamanjo](https://github.com/williamanjo) | Autor original |

Contribuições via pull request são bem-vindas.
