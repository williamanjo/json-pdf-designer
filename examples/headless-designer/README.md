# headless-designer-example

Prova que dá pra montar o **próprio editor** sem usar o componente
`<Designer>` do pacote **e sem nenhuma peça `Designer*`** — inclusive o
próprio **canvas de arrastar/redimensionar**, feito à mão
(`mousedown`/`mousemove`/`mouseup` puro, sem `react-rnd`), a lista de
campos, o painel de propriedades, as abas de página e o explorador de
campos.

É o extremo do espectro. [`custom-ui`](../custom-ui) usa o `<Designer>`
inteiro com casca própria; [`report-builder`](../report-builder) e
[`composed-layout`](../composed-layout) montam o editor com as peças do
pacote (`<DesignerProvider>` + `<DesignerCanvas>` e companhia). Aqui
**nem as peças entram** — só o modelo de dados e o motor de PDF.

## O look: PLANTA TÉCNICA

Os cinco examples têm o **mesmo conjunto de recursos**; o que muda é o
mecanismo de customização e a cara. A cara deste é **planta técnica**, e a
razão de ela poder ser tão extrema é o mecanismo: este example importa **só
o `reset.css`**, que não traz aparência nenhuma. Não há token nem regra de
tema pra herdar — logo não há nada pra brigar, e **100% do que aparece na
tela é decisão deste `index.css`**.

| Eixo | Escolha |
| --- | --- |
| Fundo | azul-marinho em três degraus: `#050f19` (cabeçalho e folha), `#0a1a2b` (mesa), `#0e2236` (painéis) |
| Traço | **uma cor só**, ciano `#4dd0e1`, em três forças — e **nunca mais de 1px**. Nenhuma borda de 2px, nenhuma sombra difusa em lugar nenhum |
| Raio | **0 em tudo** — botão, painel, input, contador, alça |
| Fonte | **mono em tudo**, corpo 12px (`ui-monospace` e a pilha do sistema; **nenhuma webfont** — o example abre offline) |
| Rótulo | **CAIXA ALTA 10px** com `letter-spacing: .08em` — legenda de desenho técnico |
| Canvas | **papel milimetrado** ciano: 1mm fraca, 5mm forte (ver abaixo) |
| Seleção | **quatro alças de canto quadradas** em ciano, não borda arredondada |
| Anotação | âmbar `#ffb74d` pra faixa de cabeçalho/rodapé e marca de `visibleWhen` — numa planta a cota sai em outra cor que o traço |

Maiúscula é só pra **rótulo e legenda**. Parágrafo de ajuda, mensagem de
problema, detalhe de erro e tudo que o usuário digita ficam em caixa normal
— e há reset explícito de `text-transform` pra isso, porque a propriedade
herda: sem ele o valor digitado dentro de um `<label>` em caixa alta
apareceria em maiúsculas, mentindo sobre o que foi escrito.

**Contraste medido** (WCAG 2.1; tudo hex, sem `oklch()` no meio): nenhum
texto abaixo de **6:1** — corpo `#d7e8f2` sobre a mesa dá 13.98:1, o ciano
`#4dd0e1` dá 9.56:1, e o texto de campo **sobre o pixel mais claro da
grade** ainda dá 8.88:1. O hairline de contorno está a 3.64–3.86:1, acima da
régua de 3:1 de contraste não-textual. Uma nota registrada no CSS: ciano
saturado a 10px *vibra* sobre navy mesmo com 9.5:1 — contraste alto não é o
mesmo que confortável —, então o ciano cheio fica em linha, alça e rótulo
curto, e o texto pequeno de leitura usa `#d7e8f2` / `#9fc0d4`.

### O que SÓ este example pode fazer

**1. Papel milimetrado, porque o canvas é dele.** Nos outros quatro examples
o canvas é o `<DesignerCanvas>` do pacote e a folha é branca porque o tema
diz que é. Aqui o canvas é [`src/components/Canvas.tsx`](src/components/Canvas.tsx),
código deste app — então a folha pode ser o que a identidade pedir, e a
identidade pede graticulado: quatro `repeating-linear-gradient` ciano, linha
fraca a cada 1mm (5% de alfa) e forte a cada 5mm (22%).

E **o passo da grade sai da escala do canvas, não de um número mágico no
CSS**. A escala mora em [`src/lib/geometry.ts`](src/lib/geometry.ts):
`PX_PER_MM` (px por mm) e `GRID_MM` (o passo de 5mm em que arrasto e resize
travam). O `Canvas.tsx` publica os dois como custom property no `style`
inline da folha —

```ts
"--bp-grid-minor": `${PX_PER_MM}px`,            // 1mm
"--bp-grid-major": `${GRID_MM * PX_PER_MM}px`,  // 5mm
```

— e os gradientes do `index.css` leem daí. Consequência: mexer em
`PX_PER_MM` move a grade sozinha, e a linha forte continua caindo
**exatamente** onde o snap trava. A grade desenhada e a grade de
comportamento são o mesmo número.

**2. Aparência 100% dele, porque só o reset entra.** O `composed-layout` só
pode trocar valores de `--jpd-*`; o `no-preview` pode sobrescrever regras
`.jpd-*` mas continua partindo do tema; o `custom-ui` escreve as ~190
classes do zero *reproduzindo a linguagem do pacote*. Aqui não há linguagem
de partida: nem grade de espaçamento, nem escala de raio, nem paleta. É o
único dos cinco em que "raio 0 em tudo" e "mono em tudo" não são um
*override* de nada — são simplesmente o que existe.

Detalhe de implementação que o look forçou: as alças de canto são
desenhadas **fora** da caixa do campo (`.canvas-field.selected::after`, com
`inset: -4px`), então o `overflow: hidden` que recortava o conteúdo saiu do
`.canvas-field` e virou um wrapper `.canvas-field-body`. Sem isso as alças
apareceriam cortadas — e sem o wrapper o texto de um campo de 8mm vazaria
por cima do vizinho.

## Como rodar

```bash
npm install
npm run dev
```

Abre em `http://localhost:5175` (porta fixa em `vite.config.ts` — os
outros usam 5173/5174/5176/5177, pra rodar todos ao mesmo tempo sem
conflito).

## O que vem do pacote

| Import | De onde | Por quê |
| --- | --- | --- |
| `generatePdf`, `migrateTemplate`, `expressionErrors`, `dictFor`, `columnLabel`, as classes de erro, `CURRENT_TEMPLATE_VERSION`, `DEFAULT_MAX_PAGES` + todos os tipos | `json-pdf-designer/server` | Motor de PDF (pdf-lib), validação de expressão, dicionário de i18n como VALOR e os tipos — build **sem React nenhum**, prova que o mesmo código roda num backend Node. |
| `PdfPreview` | `json-pdf-designer/preview` | Único componente React usado — mostra o PDF gerado de verdade (pdf.js), num `<canvas>`. Mora no entry `/preview` porque o `pdfjs-dist` (~35MB) é peer OPCIONAL; este example o instala justamente porque usa o preview. |
| `json-pdf-designer/reset.css` | — | **Só o reset, sem o tema** — e este é o único example que faz isso. Ver a seção abaixo. |

Tudo mais é código deste app, do zero — sem nenhum
`Button`/`Card`/`Input`/`Icon*` importado do pacote, sem
`<DesignerProvider>`/`<DesignerCanvas>`/`<DesignerSidebar>`, e sem
`react-rnd` nem qualquer lib de drag/resize de terceiro.

Duas consequências práticas de importar só o `/server`:

- **`fieldWarning` não existe aqui.** Ela é exportada pelo entry `.` (o com
  React), não pelo `/server`. Então as duas regras que ela aplica (vínculo
  faltando em section/chart, filtro com condição sem valor) estão
  reescritas em [src/lib/templateProblems.ts](src/lib/templateProblems.ts),
  reusando as MENSAGENS do dicionário do pacote (`dictFor(locale).warnings`)
  pra não inventar texto próprio nem perder a tradução.
- **Não há `<I18nProvider>`.** Ele também mora no entry com React. O idioma
  é aplicado por nós: `dictFor(locale)` devolve o dicionário como valor e os
  painéis leem os rótulos dele (ver "O seletor troca as duas camadas"
  abaixo). O `<PdfPreview>`, por não estar dentro de um provider, mostra a
  linha "N página(s)" sempre no idioma default do pacote — é o preço honesto
  de não importar nada do entry React.

  Isso é **escolha, não impedimento técnico**: medido, importar o
  `I18nProvider` do entry `.` só aqui *compila* — o tree-shaking descarta o
  `<Designer>` e traz ~10 módulos (o `src/i18n/` do pacote), e o `react-rnd`,
  que este example nem instala, não é resolvido. O motivo de não fazer é de
  identidade: este é o **único** dos cinco examples que não toca no entry
  React, e é assim que a tabela acima e o `docs/USAGE.md` o descrevem. Trocar
  a demonstração inteira por uma linha de contagem traduzida não paga.

## O seletor troca as duas camadas

O `<select>` do topo alimenta **um** estado — `useState<Locale>("en")`, com o
`Locale` que vem do pacote — e desse estado saem **dois** dicionários:

```ts
const t = dictFor(locale);    // do PACOTE  (json-pdf-designer/server)
const tt = shellDict(locale); // da CASCA   (src/i18n.ts, deste app)
```

Um clique, duas responsabilidades, zero sincronização manual. E como o
`Locale` é o tipo **do pacote**, no dia em que ele ganhar um terceiro idioma
o `Record<Locale, ShellDict>` do `src/i18n.ts` **deixa de compilar** até a
casca ser traduzida junto. Isso é desejável.

Este é o example em que a divisão pesa mais: ele não renderiza o
`<Designer>`, então **quase tudo na tela é casca própria** — e a régua pra
decidir de qual dicionário cada rótulo sai é *de quem é o conceito*:

| Camada | Sai de | Exemplos |
| --- | --- | --- |
| Conceito do **pacote** | `dictFor(locale)` | tipo de campo (`Texto`/`Tabela`/`Indicador`/`Gráfico`), geometria (`X (mm)`, `Largura (mm)`), `Mostrar só quando`, propriedades de texto/KPI/gráfico, `Vinculado: …`, `Remover coluna X`, `Falta vínculo no JSON`, `Filtro com condição sem valor`, e **cada mensagem de erro de expressão** |
| Conceito **deste app** | `shellDict(locale)` | cabeçalho e seus botões, abas de vista, `Fontes de dados (JSON)`, explorador de campos, `Problemas do template`, banner de erro de geração, `Página N` |

Duplicar um rótulo do pacote aqui criaria **duas traduções pra
dessincronizar** — por isso o `templateProblems.ts` monta as mensagens com
`expressionErrors(schema, binding, dictFor(locale))` em vez de escrever texto
próprio, e por isso a miniatura de um gráfico no canvas diz
`Gráfico (Pizza)` com as duas palavras vindas de `t`.

O inverso também vale, e é o erro mais fácil de cometer: **usar um rótulo do
pacote pra significar outra coisa é pior que traduzir à mão.** Um caso real
neste example — a dica do painel de campos. A do pacote
(`t.fieldsPanel.selectHint`) termina em *"…ou adicione um novo:"*, porque no
`<Designer>` ela fica logo acima dos botões de adicionar campo. Aqui esses
botões estão na barra **sobre o canvas**, do outro lado da tela: o rótulo do
pacote prometeria uma ação que aquele painel não tem. Então o título do
painel (`Campos`) continua vindo de `t` — é o mesmo conceito — e só a dica
virou entrada nossa (`tt.fields.selectHint`).

### O que NÃO troca de idioma

O `locale` é o idioma da **interface**, não do **documento**. Continuam como
foram escritos, nos dois idiomas:

- o conteúdo dos seis templates de [`data/templates/`](src/data/templates) e
  o `label` de cada um no dropdown — `Lei Kandir`, `Relatório Financeiro` são
  **nomes de documento**, não rótulos de UI;
- o JSON de amostra, os nomes de campo (`kandir_tabela`), os caminhos de dado
  (`rows.total`) e os cabeçalhos de coluna que saem **impressos** no PDF;
- o conteúdo inicial de um campo novo (`Hello {company.name}`, `col_1`) — é o
  começo do documento, e quem gerou um relatório em português não quer o
  título do KPI virando inglês por ter mexido na UI;
- `report.pdf` (nome de arquivo) e `source_1` (nome de fonte, que vai pro
  projeto salvo) — identificadores;
- `Português` e `English` no próprio seletor, cada um no idioma que nomeia.

### Um detalhe de implementação: o banner de erro retraduz

O `lib/generationError.ts` guarda no estado o **código** da falha
(classificado por `instanceof` na classe de erro do pacote), não a frase — o
texto sai de `tt.genErrors[code]` na renderização. Consequência: trocar o
idioma **com o banner aberto** retraduz o banner, sem gerar o PDF de novo.

## E é o único example que usa o `reset.css` avulso

`json-pdf-designer/reset.css` é o subconjunto **sem aparência** do
`theme.css`: ele devolve só o que o Preflight do Tailwind dava de graça até a
2.x — `box-sizing`, `margin: 0` em heading/parágrafo/lista, `font: inherit` em
controle de formulário, `svg { display: block }`, `code` monoespaçado. Zero
cor, zero espaçamento, zero borda.

Serve aqui porque este app não renderiza o `<Designer>`: ele monta o editor
próprio e do pacote usa **só o `<PdfPreview>`**, cuja superfície de estilo são
quatro nomes — `.jpd-error`, `.jpd-error--md`, `.jpd-preview__count` e o token
`--jpd-shadow-page-preview`. Escrever a aparência desses quatro à mão são as
~5 regras no fim de [src/index.css](src/index.css). Para o editor **inteiro** o
custo seria outro: ver o [custom-ui](../custom-ui), que paga ~190 classes.

**Todo painel novo aqui tem a aparência escrita por nós**, em CSS puro — o
reset não dá nenhuma. É por isso que o `index.css` deste example é grande
enquanto a parte que cobre o pacote são cinco regras.

### A pegadinha do modo só-reset

`PdfPreview.tsx` faz isto:

```ts
canvas.style.boxShadow = "var(--jpd-shadow-page-preview)";
```

Ou seja: **o componente lê um token direto no `style` inline.** O `reset.css`
não declara token de aparência nenhum, então quem usa só o reset **tem de
declarar esse token** — sem ele o `var()` fica inválido, a declaração morre
calada, e a página aparece sem sombra sem nada avisar.

Este example declara, e há um teste em `test/docsFreshness.test.ts` que
falha se a declaração desaparecer.

O **valor** é escolha de identidade, não do pacote: aqui é uma **linha ciano
dura** (`0 0 0 1px #4dd0e1` — spread sem blur), a mesma que contorna a folha
do canvas, pra a página do PDF entrar no desenho como mais uma peça cotada.
A sombra difusa do tema seria a única mancha macia de uma tela feita só de
hairline.

As outras três classes do `<PdfPreview>` também são deste arquivo: a linha
de contagem (`.jpd-preview__count`) sai como **legenda** — mono, caixa alta,
ciano —, e `.jpd-error` / `.jpd-error--md` usam o vermelho de falha da
paleta em dois degraus de tamanho. Do `<PdfPreview>` o `reset.css` cobre
exatamente uma coisa: o `margin: 0` do `.jpd-error`.

### Onde este example fica no espectro

| Example | CSS do pacote | Estratégia | Look |
|---|---|---|---|
| [report-builder](../report-builder) | `theme.css` | tema como vem, zero customização | SaaS padrão (a referência) |
| [composed-layout](../composed-layout) | `theme.css` | retema **só por token** (`--jpd-*`) | brutalista: preto e amarelo |
| [no-preview](../no-preview) | `theme.css` | token + **override de regra `.jpd-*`**, com toggle de tema | terminal/IDE: quase-preto e verde fósforo |
| **headless-designer** (este) | `reset.css` | só o reset, aparência escrita à mão | **planta técnica: azul-marinho e ciano** |
| [custom-ui](../custom-ui) | *nenhum* | `.jpd-*` do zero (~190 classes) | app macio: creme e coral, pílulas |

## O que tem

Os cinco examples cobrem o **mesmo conjunto de recursos** — o que muda é
como o editor é montado e como ele é estilizado. Aqui todos os recursos
são implementados na UI própria:

1. **Fontes de dados JSON, várias e mescladas** —
   [`DataSourcePanel`](src/components/DataSourcePanel.tsx) +
   [`lib/sources.ts`](src/lib/sources.ts). Cada arquivo/bloco colado é uma
   fonte; soltar `.json` na zona de drop acrescenta várias de uma vez. Na
   hora de gerar, todas são juntadas num objeto (nível superior, a última
   vence em chave repetida); fonte com JSON inválido fica de fora e aparece
   marcada, sem impedir as outras.
2. **Explorador de campos, com arrastar pro canvas** —
   [`FieldTree`](src/components/FieldTree.tsx) +
   [`lib/jsonExplorer.ts`](src/lib/jsonExplorer.ts). O drop é o **nosso**
   canvas: ele conhece a escala (`PX_PER_MM`), então o campo nasce **onde
   você soltou**, em mm, em vez de empilhar no primeiro Y livre. E o drop
   olha em QUE campo caiu — soltar um array em cima de um gráfico ou de uma
   tabela **revincula aquele campo**, e soltar uma coluna em cima de uma
   tabela já vinculada ao mesmo array **acrescenta a coluna** (cabeçalho e
   `binding.columns` no mesmo passo). É o substituto do editor de vínculo
   que este example não tem.
3. **6 templates prontos** — dropdown "Load example…"
   ([`data/templates/`](src/data/templates)). `Template` é só dado, então os
   mesmos seis arquivos do `report-builder` funcionam aqui sem mudar nada
   além do specifier de import (`/server`).
4. **Undo/redo** (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y) —
   [`hooks/useUndoRedo.ts`](src/hooks/useUndoRedo.ts), operando no estado
   deste App. Empilha `template` e `bindings` **juntos**: várias operações
   mudam os dois no mesmo clique (revincular uma tabela sincroniza `head` E
   `binding.columns`) e quebrar isso em dois passos de undo desalinharia os
   dois de novo.
5. **Autosave** no `localStorage` —
   [`hooks/useAutosave.ts`](src/hooks/useAutosave.ts), debounced. O botão
   "Reset" limpa a entrada, senão o estado gravado voltaria no próximo F5.
6. **Salvar/carregar projeto** (`.json`) —
   [`lib/projectFile.ts`](src/lib/projectFile.ts). O carregamento valida a
   forma e passa por `migrateTemplate` antes de virar estado.
7. **Múltiplas páginas** — [`PageTabs`](src/components/PageTabs.tsx) +
   [`lib/pages.ts`](src/lib/pages.ts). As abas trocam a página que o
   **nosso** canvas desenha; o motor não sabe de aba nenhuma — `pages` é só
   um array no `Template`, e `generatePdf` gera todas. O template inicial já
   abre com duas.
8. **Painel de problemas** —
   [`ProblemsPanel`](src/components/ProblemsPanel.tsx) +
   [`lib/templateProblems.ts`](src/lib/templateProblems.ts). Expressão
   inválida resolve pra vazio na geração em vez de derrubar o PDF; este
   painel é onde isso deixa de ser invisível. Clicar num problema vai pra
   página **e seleciona o campo** — aqui dá, porque a seleção é estado deste
   App (no `report-builder` o clique só chega até a página, já que lá o
   `<Designer>` é dono da seleção).
9. **Erro de geração traduzido** —
   [`GenerationErrorBanner`](src/components/GenerationErrorBanner.tsx) +
   [`lib/generationError.ts`](src/lib/generationError.ts). Decide o texto
   por `instanceof` nas classes de erro exportadas (`PageLimitError`,
   `UnsupportedGlyphError`, `ExpressionError`), não por `err.message` cru —
   a mesma decisão que um backend toma pra escolher entre 413, 400 e 500.
10. **Seletor de idioma** — no topo, e ele troca **as duas camadas**: os
    rótulos que vêm do pacote **e** a casca deste app. Ver a seção abaixo.
11. **Preview de PDF** — `<PdfPreview>` inline, na aba "Preview" (o
    `report-builder` usa o `PdfPreviewModal`; mesmo recurso, outra
    apresentação). "Download PDF" baixa o arquivo.

E o que já era daqui:

- **Canvas de verdade, à mão** ([`Canvas.tsx`](src/components/Canvas.tsx)):
  arrastar move (x/y), a alça no canto redimensiona — tudo em mm,
  convertido pra px só na tela, travando numa grade de 5mm. Campo travado
  (`locked`) não arrasta e não mostra alça de resize. Como a folha é
  desenhada aqui, ela é **papel milimetrado** (a mesma grade de 5mm do snap,
  desenhada; ver "O que SÓ este example pode fazer"), e o campo selecionado
  ganha **quatro alças de canto quadradas** em ciano — a de baixo à direita
  é a que redimensiona; as outras três são marca de seleção.
- As **faixas de cabeçalho/rodapé/margem** da página desenhadas no canvas:
  um campo entra no cabeçalho do PDF só por cair dentro da faixa (ver
  `zones.ts` do pacote), então a faixa precisa aparecer pra isso deixar de
  ser mágica. É também onde `{pageNumber}`/`{pageCount}` resolvem.
- **Painel de propriedades** ([`PropertiesPanel.tsx`](src/components/PropertiesPanel.tsx)):
  nome, trava, geometria por número, `visibleWhen`, e o que faz sentido por
  tipo (conteúdo/fonte/cor/alinhamento no texto, colunas na tabela,
  título/valor/legenda/cores no KPI, tipo/exibição no gráfico).
- **JSON de amostra inline e pequeno**
  ([`data/initialTemplate.ts`](src/data/initialTemplate.ts)) — de propósito
  com objeto aninhado em dois níveis, dois arrays de objetos e um array de
  valores simples, pra o explorador de campos ter forma de verdade pra
  mostrar.

## O que NÃO tem (de propósito)

- **Editor de vínculo (`Binding`) próprio.** Vínculo aqui se cria e se troca
  arrastando um array/coluna do explorador em cima do campo (recurso 2). Um
  editor de vínculo de verdade — filtro, agregação, coluna calculada — é a
  peça `<DesignerBindingEditor />`; ver [`composed-layout`](../composed-layout).
- **Campos de imagem e seção.** Eles geram normalmente se vierem de um
  template carregado, mas o painel deste example não os edita: seria um
  uploader de imagem e um editor de grupo escritos à mão, e nenhum dos dois
  demonstra nada que os outros nove recursos já não demonstrem. O
  `report-builder` cobre os dois.
