# json-pdf-designer

[![npm version](https://img.shields.io/npm/v/json-pdf-designer.svg)](https://www.npmjs.com/package/json-pdf-designer)
[![npm downloads](https://img.shields.io/npm/dm/json-pdf-designer.svg)](https://www.npmjs.com/package/json-pdf-designer)
[![CI](https://github.com/williamanjo/json-pdf-designer/actions/workflows/ci.yml/badge.svg)](https://github.com/williamanjo/json-pdf-designer/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-website-blue)](https://williamanjo.github.io/json-pdf-designer/pt-BR/)

**Português** | [English](README.md)

Editor visual de relatórios em PDF para React — canvas de arrastar/
redimensionar campos, vínculo de campos a um JSON de dados, seção repetida
(data band/mestre-detalhe), gráficos, cartões de
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
  classe ou função escondida no meio. O formato do template em si é
  versionado (`Template.version` + `migrateTemplate`), então template que
  já está num banco continua carregando depois que o pacote andar.
- **Mesma função gera no navegador e no servidor.** `generatePdf` não usa
  DOM nem `canvas` do navegador — só `pdf-lib`/`fontkit`. Dá pra desenhar
  o template numa tela com `<Designer>` e gerar o PDF de verdade num
  backend Node a partir do JSON salvo (ver [Uso em backend](#uso-em-backend-sem-ui) abaixo).
- **Problema de dado degrada; problema estrutural falha alto.** Caminho
  que não existe no JSON renderiza vazio, e expressão quebrada esvazia
  *aquele campo* — uma vírgula esquecida não pode custar um relatório de
  200 páginas. Mas documento que passaria do teto de páginas estoura em
  vez de te entregar um PDF truncado com cara de completo, e caractere sem
  glifo na fonte é erro, não um vão silencioso. A tabela inteira do que
  degrada e do que falha está em
  [O que pode e o que não pode derrubar uma geração](docs/USAGE.pt-BR.md#o-que-pode-e-o-que-não-pode-derrubar-uma-geração).

## Interface em inglês ou português

O `<Designer>` (botões, abas, avisos) fala inglês por padrão — passe
`locale="pt-BR"` pra virar português:

```tsx
<Designer locale="pt-BR" template={template} onChangeTemplate={setTemplate} bindings={bindings} onChangeBindings={setBindings} />
```

Isso só muda a UI do editor — não muda como o PDF gerado formata
data/moeda (isso é `{DATE(...)}`/`{CURRENCY(...)}` escrito no próprio
template, ver [docs/USAGE.pt-BR.md](docs/USAGE.pt-BR.md)).

## Campos suportados

| Campo | O que faz |
| --- | --- |
| **Texto** | conteúdo livre com `{token}`/`{FUNÇÃO(...)}`, fonte/cor/alinhamento |
| **Tabela** | colunas a partir de um array, coluna calculada, rodapé (SUM/COUNT/AVG), largura por coluna, linha zebrada, alinhamento/arredondamento por bloco e paletas de cor prontas |
| **Imagem** | upload direto no canvas, redimensiona junto |
| **Seção** | data band repetido — mestre-detalhe, agrupa outros campos e paginação junto com o corpo |
| **Gráfico** | pizza/rosca ou barra, legenda configurável (direita/esquerda/topo/base/nas fatias), ordenação, modo de exibição (número/percentual/ambos), formato de valor (número/moeda), paleta de cores pronta (Padrão/Clássica/Moderna/Vibrante/Pastel/Escala de cinza) ou 100% personalizada (cor a cor), e filtro avançado (grupos em OU, condições em E) |
| **Indicador (KPI)** | cartão colorido com ícone ([Google Material Symbols](https://fonts.google.com/icons), com busca), título, valor e legenda — cada um opcional e reposicionável livremente no cartão |

Tudo arrasta/redimensiona livre (via [react-rnd](https://github.com/bokuweb/react-rnd)), com grade de 5mm que trava
posição/tamanho por padrão — segura **Shift** durante o arrasto pra soltar
da grade. Seleção múltipla (Ctrl/Cmd+clique ou caixa de seleção),
copiar/colar, atalhos de teclado, tamanho/orientação de página
configuráveis. Painel lateral em abas — **Campos**, **Página** (sempre
acessíveis) e **Dados**/**Estilo**/**Filtro** (só enquanto um campo está
selecionado, conforme o tipo dele) — abas reordenáveis por arraste e
fixáveis (escondidas no "×", reabertas no "+"). Detalhe completo de cada
recurso em [docs/USAGE.pt-BR.md](docs/USAGE.pt-BR.md).

## Expressões

O conteúdo de um campo é um **template**: texto literal mais `{...}`
resolvido contra o JSON.

```
Fatura {fatura} — {CURRENCY(qtd * preco, "R$")}
{IF(total > 1000, "prioritário", "normal")}
{UPPER(cliente.nome)} · {DATE(emitidoEm, "DD/MM/YYYY")}
```

Dentro das chaves: caminhos, aritmética (`*` e `/` ligam mais forte que
`+` e `-`, parênteses agrupam), comparações, `AND`/`OR`/`NOT`, e 11
funções (`SUM`/`COUNT`/`AVG`/`CONCAT`/`UPPER`/`LOWER`/`TRIM`/`DATE`/
`CURRENCY`/`NUMBER`/`IF`). É tudo parseado pra uma AST — sem `eval`, sem
`new Function`.

Uma regra é incomum, e é ela que deixa uma chave JSON ter hífen ou
espaço: **operador só é operador cercado de espaço dos dois lados.**

```
{minha-chave}   o caminho "minha-chave", não "minha menos chave"
{a - b}         subtração
{a -b}          o caminho "a -b" — provavelmente não é o que você quis
```

A última linha era invisível: o campo simplesmente saía em branco. Agora
o editor acusa, junto com erro de sintaxe e chave desbalanceada (uma `{`
sem par sai impressa como texto no PDF).

**Visibilidade condicional.** Todo campo tem um `visibleWhen` opcional —
a mesma linguagem de expressão, sem chaves — e só é desenhado quando ela
é verdadeira. Vale pra todo tipo de campo, seção e tabela incluídas, e
pras faixas repetidas, onde `pageNumber == pageCount` quer dizer "só na
última página". Esconder um campo devolve a altura dele; o que vem
depois sobe.

```ts
{ type: "text", content: "Desconto corporativo", visibleWhen: 'cliente.tipo == "empresa"' }
{ type: "table", name: "vencidas", visibleWhen: "NOT pago" }
```

**Pra escrever uma.** O botão `ƒx` ao lado de uma coluna de tabela, de
uma célula de totais, de um campo de KPI ou de um campo de texto abre um
editor com os campos a que aquele campo está vinculado à esquerda,
autocomplete das funções e operadores no centro, e validação ao vivo. A
validação também é API pública (`expressionError`, `suspiciousOperator`,
`braceError`, `templateExpressionErrors`), então um backend pode recusar
um template com expressão quebrada *antes* de salvar.

## Instalação

```bash
npm install json-pdf-designer react react-dom react-rnd
```

Todos os peer deps são **opcionais** (`peerDependenciesMeta`), então
instale o que você usa: `react`/`react-dom` (18 ou 19) e `react-rnd` pro
`<Designer>`, `pdfjs-dist` se você renderiza o preview do PDF, `wawoff2` só
pra fonte `.woff2`. Um backend que só chama `generatePdf` de
`json-pdf-designer/server` não precisa de nenhum — ver
[docs/USAGE.pt-BR.md](docs/USAGE.pt-BR.md).

Importe o CSS do pacote uma vez, no entrypoint do seu app:

```ts
import "json-pdf-designer/style.css";
```

Já tem seu próprio Tailwind (v3 ou v4) configurado e prefere que ELE
gere as classes do Designer em vez de carregar uma segunda folha de
estilo — ex: pra evitar Preflight/reset duplicado — veja
[Usando sua própria instalação do Tailwind](docs/USAGE.pt-BR.md#usando-sua-própria-instalação-do-tailwind).

Só gera PDF num backend/API Node, sem UI de editor? Importe de
`json-pdf-designer/server` em vez disso — um build do `generatePdf` e
companhia sem React nenhum, sem precisar de `react`/`react-dom`. Veja
[Uso só no servidor](docs/USAGE.pt-BR.md#uso-só-no-servidor-sem-precisar-de-react).

Quer a prévia do PDF na tela? Ela mora num entry point próprio,
`json-pdf-designer/preview` (`PdfPreview`, `PdfPreviewModal`,
`configurePdfWorker`) — é isso que mantém o `pdfjs-dist` (~35MB) fora de
uma instalação que nunca dá prévia. A entry principal não tem caminho
até ele; o [exemplo no-preview](examples/no-preview) é a prova.

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
**[docs/USAGE.pt-BR.md](docs/USAGE.pt-BR.md)**.

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
considerações de segurança — em **[docs/BACKEND_INTEGRATION.pt-BR.md](docs/BACKEND_INTEGRATION.pt-BR.md)**.

## Exemplos

- **[examples/report-builder](examples/report-builder)** — designer completo
  (fontes de dados JSON, explorador de campos, 6 templates prontos).
- **[examples/custom-ui](examples/custom-ui)** — versão enxuta com casca
  própria em CSS puro, sem os componentes de UI do pacote.
- **[examples/headless-designer](examples/headless-designer)** — sem
  `<Designer>` nenhum: um canvas de arrastar/redimensionar montado à mão
  sobre `generatePdf` + tipos de `json-pdf-designer/server`, mais o
  `PdfPreview`.
- **[examples/no-preview](examples/no-preview)** — gera e baixa o PDF sem
  tela de preview e **sem o `pdfjs-dist` instalado**, provando que a entry
  principal nunca precisa do peer opcional.

Os quatro rodam ao vivo no navegador em
**[o playground](https://williamanjo.github.io/json-pdf-designer/playground/)**
— sem precisar instalar nada localmente.

## Documentação

**[williamanjo.github.io/json-pdf-designer/pt-BR](https://williamanjo.github.io/json-pdf-designer/pt-BR/)**
— documentação completa renderizada (inglês/português), guia de
instalação, todos os recursos do `<Designer>` e a API pública completa.

Markdown cru, se preferir ler direto no repositório:

- **[docs/USAGE.pt-BR.md](docs/USAGE.pt-BR.md)** — instalação, uso, todos os recursos do
  `<Designer>` e API pública completa.
- **[docs/BACKEND_INTEGRATION.pt-BR.md](docs/BACKEND_INTEGRATION.pt-BR.md)** — como
  separar frontend (Designer) de backend (geração + envio por e-mail).
- **[docs/ARCHITECTURE.pt-BR.md](docs/ARCHITECTURE.pt-BR.md)** — decisões de arquitetura
  internas do pacote.
- **[CHANGELOG.pt-BR.md](CHANGELOG.pt-BR.md)** — o que mudou, versão por versão.

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
