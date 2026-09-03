# json-pdf-designer

[![npm version](https://img.shields.io/npm/v/json-pdf-designer.svg)](https://www.npmjs.com/package/json-pdf-designer)
[![npm downloads](https://img.shields.io/npm/dm/json-pdf-designer.svg)](https://www.npmjs.com/package/json-pdf-designer)
[![CI](https://github.com/williamanjo/json-pdf-designer/actions/workflows/ci.yml/badge.svg)](https://github.com/williamanjo/json-pdf-designer/actions/workflows/ci.yml)
[![tipos](https://img.shields.io/badge/tipos-inclu%C3%ADdos-blue)](https://github.com/williamanjo/json-pdf-designer)
[![ESM + CJS](https://img.shields.io/badge/module-ESM%20%2B%20CJS-blue)](#em-resumo)
[![Docs](https://img.shields.io/badge/docs-website-blue)](https://williamanjo.github.io/json-pdf-designer/)
[![licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-green)](LICENSE)

**Português** | [English](README.md)

**Desenhe um relatório PDF no navegador e gere ele em qualquer lugar.**

Editor visual de relatórios para React — canvas com arrastar/redimensionar,
campos vinculados a uma fonte de dados JSON, seções repetidas (faixa de
dados / master-detail), tabelas com colunas calculadas e totais, gráficos,
cartões de KPI, paginação de verdade, cabeçalho/rodapé repetidos e fundo
de papel timbrado.

O template que você desenha é **um objeto JSON serializável**, e a função
que o renderiza (`generatePdf`) é JavaScript puro sobre
[pdf-lib](https://github.com/Hopding/pdf-lib) — sem DOM, sem `canvas`, sem
navegador headless. Ou seja: o template desenhado na tela renderiza pelo
mesmo caminho de código no navegador, numa API Node ou num worker de fila
— não existe uma segunda implementação pra divergir.

```
 ┌─ navegador ───────────┐     ┌─ seu armazenamento ─┐     ┌─ Node / worker ───────┐
 │ <Designer/>           │     │ { template,         │     │ generatePdf(...)      │
 │       ↓               │ ──▶ │   bindings }        │ ──▶ │       ↓               │
 │ Template + Binding[]  │     │ (JSON puro)         │     │ Uint8Array → S3/email │
 └───────────────────────┘     └─────────────────────┘     └───────────────────────┘
```

## Em resumo

| | |
| --- | --- |
| **Tamanho da instalação** | 3 dependências de runtime (`pdf-lib`, `fontkit`, `tiny-inflate`). Os 5 peers são **opcionais** — um backend que só gera não instala nenhum deles |
| **Requisitos** | Node ≥ 18 · React 18 ou 19 (só pro editor) · TypeScript opcional, tipos incluídos |
| **Formatos de módulo** | ESM **e** CJS, com `.d.ts` em todos os entry points |
| **Entry points** | `json-pdf-designer` (editor + geração) · `/server` (geração, sem React) · `/preview` (PDF na tela, mantém o `pdfjs-dist` fora de quem nunca faz preview) · `/theme.css` · `/reset.css` |
| **Tipos de campo** | texto, tabela, imagem, seção (faixa repetida), gráfico, cartão de KPI |
| **Expressões** | 11 funções, parseadas pra AST — sem `eval`, sem `new Function` |
| **Composição** | 10 peças posicionáveis do editor · 10 hooks de estado · 12 primitivos de UI substituíveis |
| **Estilo** | 190 classes `.jpd-*` estáveis, 123 tokens `--jpd-*`, CSS escrito à mão, sem build do seu lado |

## Por que este pacote

- **Um template = um JSON, e ele continua abrindo.** `Template` +
  `Binding[]` são objetos serializáveis simples — guarde num banco,
  versione, mande por API, sem classe nem função escondida no meio. O
  formato em si é versionado (`Template.version` + `migrateTemplate`),
  então um template que já está no banco de um cliente continua abrindo
  depois que o pacote evolui.
- **Uma função, dois runtimes.** O `generatePdf` nunca toca no DOM nem no
  `canvas` do navegador — só `pdf-lib`/`fontkit`. Desenhe na tela com o
  `<Designer>` e gere o PDF de verdade a partir do JSON salvo num backend
  Node (ver [Uso no backend](#uso-em-backend-sem-ui)) sem duplicar uma
  linha de lógica de desenho.
- **Componível até o primitivo.** O `<Designer>` é um preset sobre 10
  peças que você posiciona, 10 hooks que leem o mesmo estado e 12
  primitivos internos de UI que você pode trocar pelos do seu design
  system. O CSS do editor é contrato publicado, não detalhe de
  implementação — retematizar é redeclarar tokens.
- **Problema de dado degrada; problema estrutural falha alto.** Um
  caminho que não existe no JSON renderiza vazio, e uma expressão
  quebrada esvazia *aquele campo* — uma vírgula fora de lugar não custa
  um relatório de 200 páginas. Mas um documento que passaria do teto de
  páginas lança em vez de te entregar um PDF truncado com cara de
  completo, e um caractere sem glifo na fonte é erro, não lacuna
  silenciosa. Toda falha é uma classe tipada com `code` e `blame`, então
  um backend escolhe o status HTTP sem casar mensagem. A tabela completa
  do que degrada e do que falha está em
  [O que pode e o que não pode derrubar uma geração](docs/USAGE.pt-BR.md#o-que-pode-e-o-que-não-pode-derrubar-uma-geração).
- **O código está ali.** Sem sistema de plugin pra aprender e sem schema
  declarativo de propriedades pra brigar — o `<Designer>` e tudo abaixo
  dele chega legível no seu `node_modules`, então a saída de emergência
  pra qualquer coisa que o pacote não previu é ler o arquivo.

## Feito pra ser dependência

Concreto, e conferível neste repositório:

- **1030 testes em 72 arquivos**, com peso onde está o risco: 19 arquivos
  cobrem só geração de PDF e paginação, mais 7 no parser de expressão, 8
  no kit de UI, 6 nas fronteiras de estado do editor, 5 em tabelas, 4 em
  vínculo de dados.
- **O CI testa o artefato publicado, não a fonte.** Ele roda `npm pack`,
  instala o tarball num diretório limpo e afirma que sai PDF de verdade —
  *e* que uma falha volta como classe tipada com texto localizado. É isso
  que pega `exports` errado, arquivo fora do `files`, ou um import que
  arrasta React em silêncio pro build `/server`.
- **Peer opcional é verificado, não só declarado.** O mesmo passo de CI
  falha se `pdfjs-dist`, `react-rnd`, `react` ou `react-dom` aparecerem
  numa instalação só de backend.
- **Formato de template versionado com a cadeia de migração já
  montada.** O `Template.version` mais o `migrateTemplate` normalizam
  qualquer coisa que venha de banco ou de arquivo, e uma versão nova de
  formato que chegue sem o passo de migração lança
  `TemplateMigrationMissingError` em vez de deformar o template em
  silêncio. Só existiu uma versão de formato até agora, então a cadeia
  está vazia de propósito — o ponto é a costura existir e estar testada
  antes de ser necessária.
- **Semver honesto.** A 3.0.0 tirou o Tailwind do pacote e renomeou toda
  classe interna; as quebras estão enumeradas com diff de migração no
  [CHANGELOG](CHANGELOG.pt-BR.md), e o caminho antigo da folha de estilo
  falha em tempo de build de propósito, em vez de resolver pra algo
  sutilmente diferente.
- **Cinco aplicações de exemplo** que também servem de teste de
  regressão — inclusive uma instalada *sem* o peer opcional de preview e
  uma que estiliza o editor inteiro do zero, sem nenhum CSS do pacote.

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

Importe o tema do pacote uma vez, no entrypoint do seu app:

```ts
import "json-pdf-designer/theme.css";
```

Uma linha é tudo: CSS escrito à mão, sem Tailwind e sem etapa de build
do seu lado, e ela já importa o reset de que precisa por dentro. Se você
prefere estilizar o editor você mesmo, importe
`json-pdf-designer/reset.css` no lugar — o mesmo reset, sem nenhuma
aparência. Veja [Estilo e tema](docs/USAGE.pt-BR.md#estilo-e-tema).

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
import "json-pdf-designer/theme.css";

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

## Compondo o editor

O `<Designer>` é um **preset**: ele monta o estado e dispõe um canvas ao
lado de uma sidebar com abas. As sete props dele não mudaram, então nada
disto é obrigatório — mas quando esse layout não é o que você quer, dá
pra montar o mesmo editor peça por peça:

```tsx
import { DesignerProvider, DesignerCanvas, DesignerSidebar } from "json-pdf-designer";

<DesignerProvider template={template} onChangeTemplate={setTemplate} bindings={bindings} onChangeBindings={setBindings}>
  <DesignerCanvas />
  <DesignerSidebar />
</DesignerProvider>
```

É exatamente isso que o `<Designer>` renderiza. São 10 peças
posicionáveis — canvas, barra de abas, lista de campos, toolbar,
configuração de página, painel de propriedades, painel de filtro, editor
de vínculo, inspetor, mais a conveniência `DesignerSidebar`, que empilha
as de conteúdo — e cada uma aceita `className` (faz merge), `style` (o
seu ganha) e um `whenTab` **opt-in**. O opt-in é a parte que sustenta
tudo: sem ele a peça renderiza SEMPRE, e é isso que permite cinco
painéis que seriam cinco abas ficarem lado a lado numa coluna só.

Dez hooks `useDesigner*` leem o mesmo estado, então a casca do seu app
pode mostrar a seleção atual ou disparar um mutador que o editor
enxerga — é exatamente o que o
[report-builder](examples/report-builder) faz com eles. E o
[examples/composed-layout](examples/composed-layout) monta o layout que
o preset não sabe fazer; a lista completa de peças, `parts` e hooks está
em [docs/USAGE.pt-BR.md](docs/USAGE.pt-BR.md).

## Estilo

O CSS do editor é escrito à mão e publicado como contrato, então
reestilizar não é forkar. Todo elemento carrega uma classe estável
`jpd-block__element--modifier`, estado mora em atributo `data-*`, e
cor/espaçamento/raio/tipografia vêm de custom properties `--jpd-*`:

```css
/* sua folha — trocar de tema é redeclarar token */
:root { --jpd-accent: #7c3aed; --jpd-accent-solid: #7c3aed; }
```

Dark mode é atributo que você escreve, não media query:
`data-jpd-theme="dark"` no `<html>` (a classe `.dark` continua valendo
como alias). Biblioteca não deve decidir que é light-only porque o SO
está escuro — se você quer seguir o SO, leia `matchMedia` e escreva o
atributo.

Tudo que é nosso mora numa `@layer json-pdf-designer`, então qualquer
regra sua ganha da nossa sem briga de especificidade. Mesma moeda, outro
lado: um seletor de elemento solto como `button { … }` também ganha e
alcança o chrome do editor — escope por classe. E não importar nossa
folha é modo suportado: o [examples/custom-ui](examples/custom-ui)
estiliza cada `.jpd-*` do zero. Detalhe completo, tokens inclusive, em
[Estilo e tema](docs/USAGE.pt-BR.md#estilo-e-tema).

Vindo da 2.x: o `json-pdf-designer/style.css` não existe mais e não tem
alias, então o import antigo falha no resolve, em build. É deliberado —
alias entregaria em silêncio uma folha diferente, e erro de resolve
aponta pro [CHANGELOG](CHANGELOG.pt-BR.md).

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
  (fontes de dados JSON, explorador de campos, 6 templates prontos),
  montado com as peças pra que a barra do próprio app leia a seleção do
  editor.
- **[examples/composed-layout](examples/composed-layout)** — o editor
  montado peça por peça, sem `<Designer>`: toolbar na largura toda em
  cima e cinco painéis empilhados numa coluna que o preset mostraria
  como cinco abas.
- **[examples/custom-ui](examples/custom-ui)** — o caminho de uma linha
  com `<Designer>` e **nenhum CSS do pacote**: cada classe `.jpd-*`
  estilizada do zero em CSS puro.
- **[examples/headless-designer](examples/headless-designer)** — sem
  `<Designer>` nenhum: um canvas de arrastar/redimensionar montado à mão
  sobre `generatePdf` + tipos de `json-pdf-designer/server`, mais o
  `PdfPreview`.
- **[examples/no-preview](examples/no-preview)** — gera e baixa o PDF sem
  tela de preview e **sem o `pdfjs-dist` instalado**, provando que a entry
  principal nunca precisa do peer opcional. É também o smoke test do tema
  **sem pipeline de Tailwind em ponta nenhuma** — nem no app, nem no
  pacote.

Todos os cinco rodam ao vivo no navegador em
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
redimensionar, [pdf.js](https://github.com/mozilla/pdf.js) pro preview, e
CSS escrito à mão (`theme.css`) pro visual do próprio editor — sem
Tailwind no pacote e sem etapa de build de CSS no seu app. Zero
dependência de UI de terceiros (Material UI, Ant Design etc.) — os
componentes visuais do `<Designer>` são próprios e exportados junto, e os
12 primitivos que ele usa por dentro (`Button`, `Input`, `Modal`, …) dão
pra trocar pelos seus via `<Designer components={...}>`.

## Contribuindo

Pull requests são bem-vindos. O gate que uma mudança tem que passar é o
mesmo que o CI roda, e dá pra rodar tudo local:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

O `prepublishOnly` encadeia exatamente esses quatro, então nada chega ao
npm sem eles. Duas convenções que vale conhecer antes de abrir um PR:

- **Correção de bug vem com o teste que teria pegado ele.** Várias
  suítes aqui são varreduras de fonte guardando invariantes que não
  produzem erro nenhum quando quebram — uma classe sem estilo, um token
  de dark mode faltando, uma string traduzida guardada em estado. Se
  você adicionar uma, mute o código pra provar que o guard realmente
  falha.
- **Só número medido.** Os números na doc e no CHANGELOG existem pra
  serem reproduzíveis; se você mudar um comportamento que algum número
  descreve, meça de novo em vez de ajustar a prosa.

| | Nome | Papel |
| --- | --- | --- |
| <img src="https://avatars.githubusercontent.com/u/69880957?v=4" width="40" height="40"> | [@williamanjo](https://github.com/williamanjo) | Autor e mantenedor |

## Licença

[MIT](LICENSE) — livre para uso comercial, sem exigência de atribuição
no que você gera.
